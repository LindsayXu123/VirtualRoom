// server/routes/rooms.js

const express = require('express');
const router = express.Router();
const pool = require('../models/db');

// GET /api/rooms → list all rooms
router.get('/', async (req, res) => {
  try {
    const { userId } = req.auth;   // set by your JWT middleware
    const result = await pool.query(
      'SELECT * FROM rooms WHERE user_id = $1',
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// GET /api/rooms/:id → fetch one room
router.get('/:id', async (req, res) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;
    const result = await pool.query(
      'SELECT * FROM rooms WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Room not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// POST /api/rooms → create a new room
router.post('/', async (req, res) => {
  try {
    const { userId } = req.auth;
    const { name, width, height, shape_data } = req.body;
    const result = await pool.query(
      `INSERT INTO rooms (name, width, height, shape_data, user_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [name, width, height, shape_data, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// PUT /api/rooms/:id → update room structure
router.put('/:id', async (req, res) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;
    const { name, width, height, shape_data } = req.body;
    const result = await pool.query(
      `UPDATE rooms
       SET name=$1, width=$2, height=$3, shape_data=$4
       WHERE id=$5 AND user_id=$6
       RETURNING *`,
      [name, width, height, shape_data, id, userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Room not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// DELETE /api/rooms/:id → delete a room
router.delete('/:id', async (req, res) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM rooms WHERE id=$1 AND user_id=$2',
      [id, userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Room not found' });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

module.exports = router;
