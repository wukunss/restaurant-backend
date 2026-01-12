/*
 * 数据库初始化脚本
 * 运行此脚本创建 orders 表
 */
const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "nozomi.proxy.rlwy.net",
  port: 54260,
  user: "root",
  password: "LMKWxISgopCDlLVRndjOAQBnFwkVHdWx",
  database: "railway"
});

// 创建 orders 表
const createTableSQL = `
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(50) UNIQUE NOT NULL COMMENT '订单编号',
  openid VARCHAR(100) NOT NULL COMMENT '用户OpenID',
  dishes TEXT NOT NULL COMMENT '菜品信息JSON',
  total_price DECIMAL(10,2) NOT NULL COMMENT '订单总价',
  status VARCHAR(20) DEFAULT 'unpaid' COMMENT '订单状态: unpaid/paid',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';
`;

console.log("正在连接 Railway 数据库...");

db.connect((err) => {
  if (err) {
    console.error("❌ 数据库连接失败:", err.message);
    process.exit(1);
  }

  console.log("✅ 数据库连接成功!");
  console.log("正在创建 orders 表...");

  db.query(createTableSQL, (err, result) => {
    if (err) {
      console.error("❌ 创建表失败:", err.message);
      db.end();
      process.exit(1);
    }

    console.log("✅ orders 表创建成功!");

    // 验证表是否存在
    db.query("SHOW TABLES LIKE 'orders'", (err, result) => {
      if (err) {
        console.error("验证失败:", err.message);
      } else if (result.length > 0) {
        console.log("✅ 表结构验证通过!");

        // 查看表结构
        db.query("DESCRIBE orders", (err, columns) => {
          if (!err) {
            console.log("\n📋 表结构:");
            console.table(columns);
          }
          db.end();
          console.log("\n🎉 数据库初始化完成!");
        });
      }
    });
  });
});
