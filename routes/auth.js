const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
require("dotenv").config();

// REGISTER
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: "All fields required" });
  try {
    const [existing] = await db.query("SELECT * FROM users WHERE email=?", [email]);
    if (existing.length > 0) return res.status(400).json({ error: "Email already registered" });
    const hashed = bcrypt.hashSync(password, 10);
    const [result] = await db.query(
      "INSERT INTO users (name,email,password,is_admin) VALUES (?,?,?,?)",
      [name, email, hashed, 0]
    );
    const token = jwt.sign({ id: result.insertId, email, name, isAdmin: false }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ message: "Account created!", token, user: { id: result.insertId, name, email, isAdmin: false } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// LOGIN
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  try {
    const [results] = await db.query("SELECT * FROM users WHERE email=?", [email]);
    if (results.length === 0) return res.status(400).json({ error: "Invalid email or password" });
    const user = results[0];
    if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: "Invalid email or password" });
    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ message: "Login successful!", token, user: { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin === 1 } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET ALL USERS (Admin)
router.get("/users", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.isAdmin) return res.status(403).json({ error: "Admin only" });
    const [results] = await db.query("SELECT id,name,email,is_admin,created_at FROM users");
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;