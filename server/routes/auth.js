// server/routes/auth.js
const express = require('express');
const router = express.Router();
const pool = require('../models/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { username, email, password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1,$2,$3) RETURNING id, username, email`,
      [username, email, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  console.log('Login attempt:', req.body);
  const { email, username, password } = req.body;
  try {
    // allow login by email or username
    let queryText, queryValue;
    if (email) {
      queryText = 'SELECT id, username, email, password_hash FROM users WHERE email = $1';
      queryValue = email;
    } else if (username) {
      queryText = 'SELECT id, username, email, password_hash FROM users WHERE username = $1';
      queryValue = username;
    } else {
      return res.status(400).json({ error: 'Email or username required' });
    }
    const result = await pool.query(queryText, [queryValue]);
    if (!result.rows.length) {
      console.log('No user found for', queryValue);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      console.log('Password mismatch for user:', user.username);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;