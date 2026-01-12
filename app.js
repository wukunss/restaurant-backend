/*
 * @Description: Wukun Create File
 * @Version: 1.0
 * @Autor: Wukun
 * @Date: 2026-01-12 09:27:41
 * @LastEditors: Wukun
 * @LastEditTime: 2026-01-12 17:00:30
 */
const express = require("express");
const mysql = require("mysql2");
const CryptoJS = require("crypto-js");
const app = express();
app.use(express.json());

// 1. 数据库配置（Railway云数据库）
const db = mysql.createConnection({
  host: "nozomi.proxy.rlwy.net",
  port: 54260,
  user: "root",
  password: "LMKWxISgopCDlLVRndjOAQBnFwkVHdWx",
  database: "railway"
});

// 2. 微信配置
const WX_CONFIG = {
  appid: "wx68267f14257bbaf2",
  appsecret: "d2d6bcb84ceec139bc9d1b5d073c9789", // 在微信公众平台获取
  mchid: "733987928",
  apiKey: "d2d6bcb84ceec139bc9d1b5d073c9789"
};

// 3. 获取用户 openid 接口
app.post("/api/getOpenid", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.json({ code: -1, msg: "缺少 code 参数" });
  }

  try {
    // 调用微信接口获取 openid
    const https = require('https');
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_CONFIG.appid}&secret=${WX_CONFIG.appsecret}&js_code=${code}&grant_type=authorization_code`;

    https.get(url, (response) => {
      let data = '';
      response.on('data', (chunk) => { data += chunk; });
      response.on('end', () => {
        const result = JSON.parse(data);
        if (result.openid) {
          res.json({ code: 0, openid: result.openid, session_key: result.session_key });
        } else {
          res.json({ code: -1, msg: result.errmsg || "获取 openid 失败" });
        }
      });
    }).on('error', (err) => {
      res.json({ code: -1, msg: "请求微信接口失败" });
    });
  } catch (error) {
    res.json({ code: -1, msg: "服务器错误" });
  }
});

// 4. 生成订单接口
app.post("/api/createOrder", async (req, res) => {
  const { dishes, totalPrice, openid } = req.body;
  const orderNo = Date.now() + "" + Math.floor(Math.random() * 1000);

  // 1. 保存订单到数据库
  const orderSql = "INSERT INTO orders (order_no, openid, dishes, total_price, status) VALUES (?, ?, ?, ?, ?)";
  db.query(orderSql, [orderNo, openid, JSON.stringify(dishes), totalPrice, "unpaid"], async (err) => {
    if (err) return res.json({ code: -1, msg: "生成订单失败" });

    // 2. 调用微信支付统一下单获取 prepay_id
    try {
      const prepayId = await getWxPayPrepayId(orderNo, totalPrice, openid);
      const payInfo = createWxPayParams(prepayId);
      res.json({ code: 0, orderNo, payInfo });
    } catch (error) {
      res.json({ code: -1, msg: "获取支付参数失败: " + error.message });
    }
  });
});

// 5. 调用微信支付统一下单 API (V2版本,更简单)
async function getWxPayPrepayId(orderNo, totalPrice, openid) {
  const https = require('https');
  const xml2js = require('xml2js');

  // 构建请求参数
  const params = {
    appid: WX_CONFIG.appid,
    mch_id: WX_CONFIG.mchid,
    nonce_str: Math.random().toString(36).substr(2, 15),
    body: '餐厅订单',
    out_trade_no: orderNo,
    total_fee: Math.round(totalPrice * 100), // 单位:分
    spbill_create_ip: '127.0.0.1',
    notify_url: 'https://restaurant-backend-w69y.onrender.com/api/pay/callback',
    trade_type: 'JSAPI',
    openid: openid
  };

  // 生成签名
  const signStr = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&') + `&key=${WX_CONFIG.apiKey}`;
  params.sign = CryptoJS.MD5(signStr).toString().toUpperCase();

  // 构建 XML 请求体
  const builder = new xml2js.Builder({ rootName: 'xml', headless: true });
  const xmlData = builder.buildObject(params);

  // 发送请求
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.mch.weixin.qq.com',
      path: '/pay/unifiedorder',
      method: 'POST',
      headers: { 'Content-Type': 'text/xml' }
    }, (response) => {
      let data = '';
      response.on('data', chunk => { data += chunk; });
      response.on('end', () => {
        xml2js.parseString(data, (err, result) => {
          if (err || result.xml.return_code[0] !== 'SUCCESS') {
            reject(new Error(result?.xml?.return_msg?.[0] || '统一下单失败'));
          } else {
            resolve(result.xml.prepay_id[0]);
          }
        });
      });
    });
    req.on('error', reject);
    req.write(xmlData);
    req.end();
  });
}

// 6. 生成小程序支付参数
function createWxPayParams(prepayId) {
  const timeStamp = Math.floor(Date.now() / 1000) + "";
  const nonceStr = Math.random().toString(36).substr(2, 15);
  const packageVal = `prepay_id=${prepayId}`;

  // 生成支付签名
  const signStr = `appId=${WX_CONFIG.appid}&nonceStr=${nonceStr}&package=${packageVal}&signType=MD5&timeStamp=${timeStamp}&key=${WX_CONFIG.apiKey}`;
  const paySign = CryptoJS.MD5(signStr).toString().toUpperCase();

  return {
    timeStamp,
    nonceStr,
    package: packageVal,
    signType: 'MD5',
    paySign
  };
}

// 5. 支付回调接口（微信支付成功后会调用此接口）
app.post("/api/pay/callback", (req, res) => {
  // 验证回调签名（关键：防止伪造回调）
  // 解析回调参数，更新订单状态为"paid"
  const orderNo = req.body.out_trade_no;
  const updateSql = "UPDATE orders SET status = 'paid' WHERE order_no = ?";
  db.query(updateSql, [orderNo], (err) => {
    if (err) return res.send("<xml><return_code><![CDATA[FAIL]]></return_code></xml>");
    // 告诉微信支付回调处理成功
    res.send("<xml><return_code><![CDATA[SUCCESS]]></return_code></xml>");
  });
});

// 启动后端服务
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`后端服务运行在端口 ${PORT}`);
});