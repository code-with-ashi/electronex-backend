// routes/products.js - Products APIs
const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
require("dotenv").config();

// Middleware to check admin
const isAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ error: "Admin only" });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ── GET ALL PRODUCTS ──────────────────────────────────────
router.get("/", (req, res) => {
  const { category, search, sort } = req.query;
  let query = "SELECT * FROM products WHERE 1=1";
  const params = [];

  if (category) { query += " AND category = ?"; params.push(category); }
  if (search) { query += " AND name LIKE ?"; params.push(`%${search}%`); }
  if (sort === "price-asc") query += " ORDER BY price ASC";
  else if (sort === "price-desc") query += " ORDER BY price DESC";
  else if (sort === "rating") query += " ORDER BY rating DESC";
  else query += " ORDER BY id DESC";

  db.query(query, params, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// ── GET SINGLE PRODUCT ────────────────────────────────────
router.get("/:id", (req, res) => {
  db.query("SELECT * FROM products WHERE id = ?", [req.params.id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: "Product not found" });
    res.json(results[0]);
  });
});

// ── ADD PRODUCT (Admin) ───────────────────────────────────
router.post("/", isAdmin, (req, res) => {
  const { name, category, price, original_price, rating, reviews, badge, image, description, stock } = req.body;
  db.query(
    "INSERT INTO products (name, category, price, original_price, rating, reviews, badge, image, description, stock) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [name, category, price, original_price, rating || 4.5, reviews || 0, badge, image, description, stock || 10],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ message: "Product added!", id: result.insertId });
    }
  );
});

// ── UPDATE PRODUCT (Admin) ────────────────────────────────
router.put("/:id", isAdmin, (req, res) => {
  const { name, category, price, original_price, badge, image, description, stock } = req.body;
  db.query(
    "UPDATE products SET name=?, category=?, price=?, original_price=?, badge=?, image=?, description=?, stock=? WHERE id=?",
    [name, category, price, original_price, badge, image, description, stock, req.params.id],
    (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: "Product updated!" });
    }
  );
});

// ── DELETE PRODUCT (Admin) ────────────────────────────────
router.delete("/:id", isAdmin, (req, res) => {
  db.query("DELETE FROM products WHERE id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Product deleted!" });
  });
});

module.exports = router;