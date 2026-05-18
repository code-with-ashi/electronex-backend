const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const isAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ error: "Admin only" });
    req.user = decoded; next();
  } catch { res.status(401).json({ error: "Invalid token" }); }
};

// GET ALL PRODUCTS
router.get("/", async (req, res) => {
  const { category, search, sort } = req.query;
  let query = "SELECT * FROM products WHERE 1=1";
  const params = [];
  if (category) { query += " AND category=?"; params.push(category); }
  if (search) { query += " AND name LIKE ?"; params.push(`%${search}%`); }
  if (sort === "price-asc") query += " ORDER BY price ASC";
  else if (sort === "price-desc") query += " ORDER BY price DESC";
  else if (sort === "rating") query += " ORDER BY rating DESC";
  else query += " ORDER BY id DESC";
  try {
    const [results] = await db.query(query, params);
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET SINGLE PRODUCT
router.get("/:id", async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM products WHERE id=?", [req.params.id]);
    if (results.length === 0) return res.status(404).json({ error: "Not found" });
    res.json(results[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ADD PRODUCT
router.post("/", isAdmin, async (req, res) => {
  const { name, category, price, original_price, badge, image, description, stock } = req.body;
  try {
    const [result] = await db.query(
      "INSERT INTO products (name,category,price,original_price,badge,image,description,stock) VALUES (?,?,?,?,?,?,?,?)",
      [name, category, price, original_price, badge, image, description, stock || 10]
    );
    res.status(201).json({ message: "Product added!", id: result.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE PRODUCT
router.delete("/:id", isAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM products WHERE id=?", [req.params.id]);
    res.json({ message: "Deleted!" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;