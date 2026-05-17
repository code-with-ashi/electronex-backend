// routes/orders.js - Orders APIs
const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Middleware to verify token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ── PLACE ORDER ───────────────────────────────────────────
router.post("/", verifyToken, (req, res) => {
  const { items, address, total, shipping } = req.body;
  const userId = req.user.id;

  if (!items || items.length === 0)
    return res.status(400).json({ error: "No items in order" });

  // Insert order
  db.query(
    "INSERT INTO orders (user_id, total, shipping_address, status) VALUES (?, ?, ?, ?)",
    [userId, total, JSON.stringify(address), "confirmed"],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      const orderId = result.insertId;

      // Insert order items
      const itemValues = items.map(item => [orderId, item.id, item.qty, item.price]);
      db.query(
        "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?",
        [itemValues],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({
            message: "Order placed successfully!",
            orderId,
            orderNumber: `ENX-${10000 + orderId}`,
          });
        }
      );
    }
  );
});

// ── GET MY ORDERS ─────────────────────────────────────────
router.get("/my", verifyToken, (req, res) => {
  db.query(
    `SELECT o.*, 
      GROUP_CONCAT(p.name SEPARATOR ', ') as product_names,
      GROUP_CONCAT(oi.quantity SEPARATOR ', ') as quantities
     FROM orders o
     LEFT JOIN order_items oi ON o.id = oi.order_id
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE o.user_id = ?
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [req.user.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// ── GET ALL ORDERS (Admin) ────────────────────────────────
router.get("/all", verifyToken, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Admin only" });

  db.query(
    `SELECT o.*, u.name as user_name, u.email as user_email
     FROM orders o
     LEFT JOIN users u ON o.user_id = u.id
     ORDER BY o.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// ── UPDATE ORDER STATUS (Admin) ───────────────────────────
router.put("/:id/status", verifyToken, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Admin only" });

  const { status } = req.body;
  db.query("UPDATE orders SET status = ? WHERE id = ?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Order status updated!" });
  });
});

module.exports = router;