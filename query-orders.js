/*
 * 查询数据库中的订单
 */
const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "nozomi.proxy.rlwy.net",
  port: 54260,
  user: "root",
  password: "LMKWxISgopCDlLVRndjOAQBnFwkVHdWx",
  database: "railway"
});

console.log("查询 orders 表中的所有订单...\n");

db.connect((err) => {
  if (err) {
    console.error("数据库连接失败:", err.message);
    process.exit(1);
  }

  db.query("SELECT * FROM orders ORDER BY created_at DESC", (err, results) => {
    if (err) {
      console.error("查询失败:", err.message);
      db.end();
      process.exit(1);
    }

    console.log(`✅ 找到 ${results.length} 条订单记录:\n`);

    results.forEach((order, index) => {
      console.log(`订单 ${index + 1}:`);
      console.log(`  订单号: ${order.order_no}`);
      console.log(`  用户ID: ${order.openid}`);
      console.log(`  菜品: ${order.dishes}`);
      console.log(`  总价: ¥${order.total_price}`);
      console.log(`  状态: ${order.status}`);
      console.log(`  创建时间: ${order.created_at}`);
      console.log("-----------------------------------\n");
    });

    db.end();
  });
});
