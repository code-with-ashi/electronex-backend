// routes/auth.js - User Authentication APIs
const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db");
require("dotenv").config();

// ── REGISTER ──────────────────────────────────────────────
router.post("/register", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: "All fields are required" });

  // Check if user exists
  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0)
      return res.status(400).json({ error: "Email already registered" });

    // Hash password
    const hashedPassword = bcrypt.hashSync(password, 10);

    // Insert user
    db.query(
      "INSERT INTO users (name, email, password, is_admin) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, 0],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });

        const token = jwt.sign(
          { id: result.insertId, email, name, isAdmin: false },
          process.env.JWT_SECRET,
          { expiresIn: "7d" }
        );

        res.status(201).json({
          message: "Account created successfully!",
          token,
          user: { id: result.insertId, name, email, isAdmin: false },
        });
      }
    );
  });
});

// ── LOGIN ─────────────────────────────────────────────────
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email and password required" });

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0)
      return res.status(400).json({ error: "Invalid email or password" });

    const user = results[0];
    const isMatch = bcrypt.compareSync(password, user.password);

    if (!isMatch)
      return res.status(400).json({ error: "Invalid email or password" });

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, isAdmin: user.is_admin === 1 },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful!",
      token,
      user: { id: user.id, name: user.name, email: user.email, isAdmin: user.is_admin === 1 },
    });
  });
});

// ── GET PROFILE ───────────────────────────────────────────
router.get("/profile", (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    db.query("SELECT id, name, email, is_admin FROM users WHERE id = ?", [decoded.id], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ error: "User not found" });
      res.json(results[0]);
    });
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
});

module.exports = router;