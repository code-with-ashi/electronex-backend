const express = require("express");
const router = express.Router();
const db = require("../db");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
require("dotenv").config();

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send order confirmation email
const sendOrderEmail = (customerEmail, customerName, orderNumber, items, total) => {
  const itemsList = items.map(i => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9">${i.name}</td>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9">x${i.qty}</td>
      <td style="padding:8px;border-bottom:1px solid #f1f5f9">$${i.price * i.qty}</td>
    </tr>
  `).join("");

  const mailOptions = {
    from: `"ElectroNex Store" <${process.env.EMAIL_USER}>`,
    to: customerEmail,
    subject: `✅ Order Confirmed! #${orderNumber}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:linear-gradient(135deg,#1a78f2,#7c3aed);padding:30px;text-align:center;border-radius:12px 12px 0 0">
          <h1 style="color:#fff;margin:0">⚡ ElectroNex</h1>
          <p style="color:#fff;opacity:0.8">Order Confirmation</p>
        </div>
        <div style="padding:30px;background:#fff;border:1px solid #f1f5f9">
          <h2 style="color:#0f172a">Hi ${customerName}! 👋</h2>
          <p style="color:#64748b">Your order has been confirmed! We'll deliver it in 3-5 business days.</p>
          
          <div style="background:#f8fafc;padding:16px;border-radius:12px;margin:20px 0">
            <p style="margin:0;font-weight:bold;color:#0f172a">Order Number: <span style="color:#1a78f2">#${orderNumber}</span></p>
          </div>

          <h3 style="color:#0f172a">Order Summary:</h3>
          <table style="width:100%;border-collapse:collapse">
            <tr style="background:#f8fafc">
              <th style="padding:8px;text-align:left">Product</th>
              <th style="padding:8px;text-align:left">Qty</th>
              <th style="padding:8px;text-align:left">Price</th>
            </tr>
            ${itemsList}
          </table>
          
          <div style="border-top:2px solid #1a78f2;margin-top:16px;padding-top:16px;text-align:right">
            <h3 style="color:#0f172a">Total: $${total}</h3>
          </div>

          <div style="background:#f0fdf4;padding:16px;border-radius:12px;margin-top:20px">
            <p style="margin:0;color:#16a34a">✅ Payment Confirmed</p>
            <p style="margin:4px 0 0;color:#16a34a">🚚 Estimated Delivery: 3-5 Business Days</p>
          </div>
        </div>
        <div style="background:#0f172a;padding:20px;text-align:center;border-radius:0 0 12px 12px">
          <p style="color:#64748b;margin:0">Thank you for shopping with ElectroNex! ⚡</p>
        </div>
      </div>
    `,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error("Email error:", err.message);
    else console.log("✅ Email sent to:", customerEmail);
  });
};

// Send admin notification
const sendAdminEmail = (orderNumber, customerName, customerEmail, total) => {
  const mailOptions = {
    from: `"ElectroNex Store" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `🛒 New Order #${orderNumber} - $${total}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0f172a;padding:24px;border-radius:12px">
          <h2 style="color:#fff;margin:0">⚡ New Order Received!</h2>
          <div style="background:#1e293b;padding:16px;border-radius:8px;margin-top:16px">
            <p style="color:#94a3b8;margin:4px 0">Order: <span style="color:#fff;font-weight:bold">#${orderNumber}</span></p>
            <p style="color:#94a3b8;margin:4px 0">Customer: <span style="color:#fff">${customerName}</span></p>
            <p style="color:#94a3b8;margin:4px 0">Email: <span style="color:#1a78f2">${customerEmail}</span></p>
            <p style="color:#94a3b8;margin:4px 0">Total: <span style="color:#10b981;font-weight:bold">$${total}</span></p>
          </div>
          <p style="color:#64748b;margin-top:16px">Login to admin panel to manage this order.</p>
        </div>
      </div>
    `,
  };

  transporter.sendMail(mailOptions, (err) => {
    if (err) console.error("Admin email error:", err.message);
    else console.log("✅ Admin notified!");
  });
};

// Verify Token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: "Invalid token" }); }
};

// PLACE ORDER
router.post("/", verifyToken, (req, res) => {
  const { items, address, total } = req.body;
  const userId = req.user.id;

  if (!items || items.length === 0)
    return res.status(400).json({ error: "No items in order" });

  db.query(
    "INSERT INTO orders (user_id, total, shipping_address, status) VALUES (?, ?, ?, ?)",
    [userId, total, JSON.stringify(address), "confirmed"],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      const orderId = result.insertId;
      const orderNumber = `ENX-${10000 + orderId}`;
      const itemValues = items.map(i => [orderId, i.id, i.qty, i.price]);

      db.query(
        "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES ?",
        [itemValues],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });

          // Send emails
          sendOrderEmail(address.email, address.name, orderNumber, items, total);
          sendAdminEmail(orderNumber, address.name, address.email, total);

          res.status(201).json({
            message: "Order placed!",
            orderId,
            orderNumber,
          });
        }
      );
    }
  );
});

// GET MY ORDERS
router.get("/my", verifyToken, (req, res) => {
  db.query(
    `SELECT o.*, GROUP_CONCAT(p.name SEPARATOR ', ') as product_names
     FROM orders o
     LEFT JOIN order_items oi ON o.id = oi.order_id
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE o.user_id = ?
     GROUP BY o.id ORDER BY o.created_at DESC`,
    [req.user.id],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// GET ALL ORDERS (Admin)
router.get("/all", verifyToken, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Admin only" });
  db.query(
    `SELECT o.*, u.name as user_name, u.email as user_email
     FROM orders o LEFT JOIN users u ON o.user_id = u.id
     ORDER BY o.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(results);
    }
  );
});

// UPDATE ORDER STATUS
router.put("/:id/status", verifyToken, (req, res) => {
  if (!req.user.isAdmin) return res.status(403).json({ error: "Admin only" });
  const { status } = req.body;
  db.query("UPDATE orders SET status=? WHERE id=?", [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "Status updated!" });
  });
});

module.exports = router;