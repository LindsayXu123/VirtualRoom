// server/routes/inventory.js
const express = require('express');
const router  = express.Router();
const pool    = require('../models/db');

// GET /api/inventory
router.get('/', async (req, res) => {
  const userId = req.auth.userId;
  try {
    const { rows } = await pool.query(
      `SELECT id, name, width, height, notes
       FROM inventory
       WHERE user_id = $1
       ORDER BY id`,
      [userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch inventory:', err);
    res.status(500).json({ error: 'Could not fetch inventory.' });
  }
});

// POST /api/inventory
// → create a new inventory item owned by this user
router.post('/', async (req, res) => {
  const userId    = req.auth.userId;
  const { name, width, height, notes } = req.body;

  try {
    const { rows } = await pool.query(
      `INSERT INTO inventory (user_id, name, width, height, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, width, height, notes`,
      [userId, name, width, height, notes || '']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Failed to create inventory item:', err);
    res.status(500).json({ error: 'Could not create inventory item.' });
  }
});

// DELETE /api/inventory/:id
// → only allow deleting your own rows
router.delete('/:id', async (req, res) => {
  const userId = req.auth.userId;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `DELETE FROM inventory
       WHERE id = $1
         AND user_id = $2
       RETURNING id`,
      [id, userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Inventory item not found.' });
    }
    res.json({ message: 'Inventory item deleted.' });
  } catch (err) {
    console.error('Failed to delete inventory item:', err);
    res.status(500).json({ error: 'Could not delete inventory item.' });
  }
});



module.exports = router;
