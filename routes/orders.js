const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
};

// PLACE ORDER
router.post("/", verifyToken, async (req, res) => {
  const { items, address, total } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: "No items" });
  try {
    const [result] = await db.query(
      "INSERT INTO orders (user_id,total,shipping_address,status) VALUES (?,?,?,?)",
      [req.user.id, total, JSON.stringify(address), "confirmed"]
    );
    const orderId = result.insertId;
    const orderNumber = `ENX-${10000 + orderId}`;
    const itemValues = items.map(i => [orderId, i.id, i.qty, i.price]);
    await db.query("INSERT INTO order_items (order_id,product_id,quantity,price) VALUES ?", [itemValues]);
    res.status(201).json({ message: "Order placed!", orderId, orderNumber });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET MY ORDERS
router.get("/my", verifyToken, async (req, res) => {
  try {
    const [results] = await db.query(
      `SELECT o.*, GROUP_CONCAT(p.name SEPARATOR ', ') as product_names
       FROM orders o
       LEFT JOIN order_items oi ON o.id = oi.order_id
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE o.user_id = ? GROUP BY o.id ORDER BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET ALL ORDERS (Admin)
router.get("/all", verifyToken, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Admin only" });
  try {
    const [results] = await db.query(
      `SELECT o.*, u.name as user_name, u.email as user_email
       FROM orders o LEFT JOIN users u ON o.user_id = u.id
       ORDER BY o.created_at DESC`
    );
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE STATUS
router.put("/:id/status", verifyToken, async (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Admin only" });
  try {
    await db.query("UPDATE orders SET status=? WHERE id=?", [req.body.status, req.params.id]);
    res.json({ message: "Status updated!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;