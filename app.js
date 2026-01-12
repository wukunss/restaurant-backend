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
app.post("/api/createOrder", (req, res) => {
  const { dishes, totalPrice, openid } = req.body;
  // 生成唯一订单号（时间戳+随机数）
  const orderNo = Date.now() + "" + Math.floor(Math.random() * 1000);
  // 1. 保存订单到数据库
  const orderSql = "INSERT INTO orders (order_no, openid, dishes, total_price, status) VALUES (?, ?, ?, ?, ?)";
  db.query(orderSql, [orderNo, openid, JSON.stringify(dishes), totalPrice, "unpaid"], (err) => {
    if (err) return res.json({ code: -1, msg: "生成订单失败" });

    // 2. 调用微信支付「统一下单」接口
    const payInfo = createWxPayParams(orderNo, totalPrice, openid);
    res.json({ code: 0, orderNo, payInfo });
  });
});

// 4. 生成微信支付参数（核心：签名生成）
function createWxPayParams(orderNo, totalPrice, openid) {
  const timeStamp = Math.floor(Date.now() / 1000) + "";
  const nonceStr = Math.random().toString(36).substr(2, 15);
  const packageVal = "prepay_id=wx202601121234567890"; // 实际需调用微信支付API获取prepay_id，此处简化
  
  // 生成支付签名（微信支付要求的MD5签名）
  const signStr = `appId=${WX_CONFIG.appid}&nonceStr=${nonceStr}&package=${packageVal}&signType=MD5&timeStamp=${timeStamp}&key=${WX_CONFIG.apiKey}`;
  const paySign = CryptoJS.MD5(signStr).toString().toUpperCase();

  return {
    timeStamp,
    nonceStr,
    package: packageVal,
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