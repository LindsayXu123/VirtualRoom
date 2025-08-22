const express = require('express');
const router = express.Router();
const pool = require('../models/db'); // adjust path if needed

// CREATE
router.post('/', async (req, res) => {
  try {
    const { name, width, height, notes } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO room_templates (name, width, height, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, width, height, notes`,
      [name, width, height, notes ?? null]
    );
    res.json(rows[0]);
  } catch (e) {
    console.error('POST /templates failed', e);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// LIST
router.get('/', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, width, height, notes
       FROM room_templates
       ORDER BY id DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error('GET /templates failed', e);
    res.status(500).json({ error: 'Failed to list templates' });
  }
});

module.exports = router;
