// server.js - Main Backend Server
const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
require("dotenv").config();

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());

// ── DATABASE SETUP ────────────────────────────────────────
// First connect without database to create it
const db = mysql.createConnection(
  process.env.MYSQL_URL || {
    host: process.env.MYSQLHOST || process.env.DB_HOST,
    user: process.env.MYSQLUSER || process.env.DB_USER,
    password: process.env.MYSQLPASSWORD || process.env.DB_PASSWORD,
    database: process.env.MYSQLDATABASE || process.env.DB_NAME,
    port: process.env.MYSQLPORT || 3306,
  }
);

setupDb.connect((err) => {
  if (err) {
    console.error("❌ MySQL Connection Failed:", err.message);
    process.exit(1);
  }
  console.log("✅ MySQL Connected!");

  // Create database
  setupDb.query(`CREATE DATABASE IF NOT EXISTS electronex`, (err) => {
    if (err) { console.error("❌ DB Create Error:", err.message); return; }
    console.log("✅ Database 'electronex' ready!");

    setupDb.query(`USE electronex`, (err) => {
      if (err) return;

      // Create users table
      setupDb.query(`
        CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          is_admin TINYINT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => { if (err) console.error("Users table error:", err.message); else console.log("✅ Users table ready!"); });

      // Create products table
      setupDb.query(`
        CREATE TABLE IF NOT EXISTS products (
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
        )
      `, (err) => { if (err) console.error("Products table error:", err.message); else console.log("✅ Products table ready!"); });

      // Create orders table
      setupDb.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          total DECIMAL(10,2) NOT NULL,
          shipping_address TEXT,
          status VARCHAR(50) DEFAULT 'confirmed',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `, (err) => { if (err) console.error("Orders table error:", err.message); else console.log("✅ Orders table ready!"); });

      // Create order_items table
      setupDb.query(`
        CREATE TABLE IF NOT EXISTS order_items (
          id INT AUTO_INCREMENT PRIMARY KEY,
          order_id INT NOT NULL,
          product_id INT NOT NULL,
          quantity INT NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          FOREIGN KEY (order_id) REFERENCES orders(id)
        )
      `, (err) => { if (err) console.error("Order items table error:", err.message); else console.log("✅ Order items table ready!"); });

      // Create cart table
      setupDb.query(`
        CREATE TABLE IF NOT EXISTS cart (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          quantity INT DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `, (err) => { if (err) console.error("Cart table error:", err.message); else console.log("✅ Cart table ready!"); });

      // Insert dummy products
      setupDb.query("SELECT COUNT(*) as count FROM products", (err, results) => {
        if (!err && results[0].count === 0) {
          const products = [
            ["iPhone 16 Pro Max", "smartphones", 1199, 1299, 4.9, 2341, "New", "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500&q=80", "The most powerful iPhone ever with A18 Pro chip.", 15],
            ["MacBook Pro M4", "laptops", 2499, 2699, 4.8, 1876, "Hot", "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=500&q=80", "Supercharged by M4 Pro chip for ultimate performance.", 8],
            ["Sony WH-1000XM6", "headphones", 399, 449, 4.7, 3102, "Sale", "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80", "Industry-leading noise cancellation.", 22],
            ["Apple Watch Ultra 3", "smartwatches", 799, 849, 4.8, 987, "New", "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=500&q=80", "The most rugged Apple Watch for extreme adventures.", 12],
            ["Samsung Galaxy S25 Ultra", "smartphones", 1099, 1199, 4.7, 1654, "Hot", "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=500&q=80", "Galaxy AI-powered flagship with 200MP camera.", 19],
            ["ASUS ROG Zephyrus G16", "laptops", 2199, 2399, 4.7, 512, "Hot", "https://images.unsplash.com/photo-1603302576837-37561b2e2302?w=500&q=80", "Ultimate gaming laptop with RTX 4090.", 4],
            ["AirPods Pro 3", "headphones", 249, 279, 4.6, 4210, "New", "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=500&q=80", "Personalized Spatial Audio with dynamic head tracking.", 34],
            ["Samsung Galaxy Watch 7", "smartwatches", 299, 349, 4.5, 1123, "Sale", "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80", "Advanced health monitoring with BioActive Sensor.", 17],
            ["Google Pixel 9 Pro", "smartphones", 999, 1099, 4.6, 876, null, "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500&q=80", "Google AI at its best with Gemini built-in.", 21],
            ["Dell XPS 15 Plus", "laptops", 1799, 1999, 4.6, 743, "Sale", "https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=500&q=80", "Stunning OLED display meets Intel Core Ultra performance.", 6],
            ["Bose QuietComfort 45", "headphones", 329, 379, 4.5, 2187, null, "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500&q=80", "Premium noise cancelling with legendary Bose sound.", 28],
            ["Garmin Fenix 8 Pro", "smartwatches", 899, 999, 4.8, 634, "New", "https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?w=500&q=80", "Multi-sport GPS smartwatch with solar charging.", 9],
          ];

          setupDb.query(
            "INSERT INTO products (name, category, price, original_price, rating, reviews, badge, image, description, stock) VALUES ?",
            [products],
            (err) => {
              if (err) console.error("Products insert error:", err.message);
              else console.log("✅ Dummy products inserted!");
            }
          );

          // Insert admin user
          const bcrypt = require("bcryptjs");
          const adminPassword = bcrypt.hashSync("admin123", 10);
          setupDb.query(
            "INSERT IGNORE INTO users (name, email, password, is_admin) VALUES (?, ?, ?, ?)",
            ["Admin", "admin@electronex.com", adminPassword, 1],
            (err) => {
              if (!err) console.log("✅ Admin user created! Email: admin@electronex.com | Password: admin123");
            }
          );
        }
      });

      setupDb.end();

      // Now start the real app with database
      const db = require("./db");

      // ── ROUTES ──────────────────────────────────────────
      app.use("/api/auth", require("./routes/auth"));
      app.use("/api/products", require("./routes/products"));
      app.use("/api/orders", require("./routes/orders"));

      // ── CART ROUTES (inline) ─────────────────────────────
      const jwt = require("jsonwebtoken");

      const verifyToken = (req, res, next) => {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) return res.status(401).json({ error: "No token" });
        try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
        catch { res.status(401).json({ error: "Invalid token" }); }
      };

      app.get("/api/cart", verifyToken, (req, res) => {
        db.query(
          `SELECT c.id, c.quantity, p.* FROM cart c 
           JOIN products p ON c.product_id = p.id 
           WHERE c.user_id = ?`,
          [req.user.id],
          (err, results) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json(results);
          }
        );
      });

      app.post("/api/cart", verifyToken, (req, res) => {
        const { product_id, quantity } = req.body;
        db.query(
          "INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?",
          [req.user.id, product_id, quantity || 1, quantity || 1],
          (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Added to cart!" });
          }
        );
      });

      app.delete("/api/cart/:id", verifyToken, (req, res) => {
        db.query("DELETE FROM cart WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "Removed from cart!" });
        });
      });

      // ── TEST ROUTE ───────────────────────────────────────
      app.get("/api", (req, res) => {
        res.json({ message: "✅ ElectroNex API is running!", version: "1.0.0" });
      });

      // ── START SERVER ─────────────────────────────────────
      const PORT = process.env.PORT || 5000;
      app.listen(PORT, () => {
        console.log(`\n🚀 ElectroNex Backend running at http://localhost:${PORT}`);
        console.log(`📦 API ready at http://localhost:${PORT}/api`);
        console.log(`\n📋 Available APIs:`);
        console.log(`   POST http://localhost:${PORT}/api/auth/register`);
        console.log(`   POST http://localhost:${PORT}/api/auth/login`);
        console.log(`   GET  http://localhost:${PORT}/api/products`);
        console.log(`   POST http://localhost:${PORT}/api/orders`);
        console.log(`   GET  http://localhost:${PORT}/api/orders/my`);
      });
    });
  });
});