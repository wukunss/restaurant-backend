/*
 * @Description: Wukun Create File
 * @Version: 1.0
 * @Autor: Wukun
 * @Date: 2026-01-12 09:27:41
 * @LastEditors: Wukun
 * @LastEditTime: 2026-01-12 09:27:43
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

// 2. 微信支付配置（替换为你的商户信息）
const WX_CONFIG = {
  appid: "你的小程序appid",
  mchid: "你的商户号",
  apiKey: "你的商户API密钥（在微信商户平台设置）"
};

// 3. 生成订单接口
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