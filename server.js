const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const app = express();
app.use(cors({ origin: "*", methods: ["GET","POST","PUT","DELETE"], allowedHeaders: ["Content-Type","Authorization"] }));
app.use(express.json());

// ── CONNECTION POOL ───────────────────────────────────────
const db = mysql.createPool({
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
}).promise();

// ── CREATE TABLES ─────────────────────────────────────────
async function createTables() {
  try {
    await db.query(`CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      is_admin TINYINT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log("✅ Users table ready!");

    await db.query(`CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      category VARCHAR(50) NOT NULL,
      price DECIMAL(10,2) NOT NULL,
      original_price DECIMAL(10,2),
      rating DECIMAL(3,1) DEFAULT 4.5,
      reviews INT DEFAULT 0,
      badge VARCHAR(20),
      image TEXT,
      description TEXT,
      stock INT DEFAULT 10,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log("✅ Products table ready!");

    await db.query(`CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      total DECIMAL(10,2) NOT NULL,
      shipping_address TEXT,
      status VARCHAR(50) DEFAULT 'confirmed',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    console.log("✅ Orders table ready!");

    await db.query(`CREATE TABLE IF NOT EXISTS order_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT NOT NULL,
      price DECIMAL(10,2) NOT NULL
    )`);
    console.log("✅ Order items ready!");

    await db.query(`CREATE TABLE IF NOT EXISTS cart (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      quantity INT DEFAULT 1
    )`);
    console.log("✅ Cart table ready!");

    // Insert admin
    const bcrypt = require("bcryptjs");
    const pwd = bcrypt.hashSync("admin123", 10);
    await db.query(
      "INSERT IGNORE INTO users (name,email,password,is_admin) VALUES (?,?,?,?)",
      ["Admin", "admin@electronex.com", pwd, 1]
    );
    console.log("✅ Admin ready!");

    // Insert products
    const [rows] = await db.query("SELECT COUNT(*) as count FROM products");
    if (rows[0].count === 0) {
      const products = [
        ["iPhone 16 Pro Max","smartphones",1199,1299,4.9,2341,"New","https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500&q=80","The most powerful iPhone ever.",15],
        ["MacBook Pro M4","laptops",2499,2699,4.8,1876,"Hot","https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&q=80","Supercharged by M4 Pro chip.",8],
        ["Sony WH-1000XM6","headphones",399,449,4.7,3102,"Sale","https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80","Industry-leading noise cancellation.",22],
        ["Apple Watch Ultra 3","smartwatches",799,849,4.8,987,"New","https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&q=80","Most rugged Apple Watch.",12],
        ["Samsung Galaxy S25 Ultra","smartphones",1099,1199,4.7,1654,"Hot","https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=500&q=80","Galaxy AI-powered flagship.",19],
        ["ASUS ROG Zephyrus G16","laptops",2199,2399,4.7,512,"Hot","https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500&q=80","Ultimate gaming laptop.",4],
        ["AirPods Pro 3","headphones",249,279,4.6,4210,"New","https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=500&q=80","Personalized Spatial Audio.",34],
        ["Samsung Galaxy Watch 7","smartwatches",299,349,4.5,1123,"Sale","https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80","Advanced health monitoring.",17],
      ];
      await db.query(
        "INSERT INTO products (name,category,price,original_price,rating,reviews,badge,image,description,stock) VALUES ?",
        [products]
      );
      console.log("✅ Products inserted!");
    }

    console.log("✅ All tables ready!");
  } catch (err) {
    console.error("❌ Table error:", err.message);
  }
}

createTables();

// ── VERIFY TOKEN ──────────────────────────────────────────
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
};

// ── ROUTES ────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));
app.use("/api/products", require("./routes/products"));
app.use("/api/orders", require("./routes/orders"));

// ── CART ROUTES ───────────────────────────────────────────
app.get("/api/cart", verifyToken, async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT c.id, c.quantity, p.id as product_id, p.name, p.price, p.image, p.category 
       FROM cart c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?`,
      [req.user.id]
    );
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/api/cart", verifyToken, async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    await db.query(
      "INSERT INTO cart (user_id,product_id,quantity) VALUES (?,?,?)",
      [req.user.id, product_id, quantity || 1]
    );
    res.json({ message: "Added to cart!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/api/cart/:id", verifyToken, async (req, res) => {
  try {
    await db.query("DELETE FROM cart WHERE id=? AND user_id=?", [req.params.id, req.user.id]);
    res.json({ message: "Removed!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/api", (req, res) => {
  res.json({ message: "✅ ElectroNex API Running!" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});