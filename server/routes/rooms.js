// server/routes/rooms.js
const express = require('express');
const router = express.Router();
const pool = require('../models/db');

// GET /api/rooms → list all rooms
router.get('/', async (req, res) => {
  try {
    const { userId } = req.auth;
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
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, width, height, shape_data || null, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// PUT /api/rooms/:id → update only width & height (persist template changes)
router.put('/:id', async (req, res, next) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;
    const { width, height } = req.body;
    if (width == null || height == null) {
      return res.status(400).json({ error: 'Must provide width and height.' });
    }
    const result = await pool.query(
      `UPDATE rooms
         SET width = $1,
             height = $2
       WHERE id = $3
         AND user_id = $4
       RETURNING *`,
      [width, height, id, userId]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Room not found.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/rooms/:id → delete a room
router.delete('/:id', async (req, res) => {
  const { userId } = req.auth;
  const { id }     = req.params;
  const client     = await pool.connect();

  try {
    await client.query('BEGIN');
    // 1) Remove any placed items in this room
    await client.query(
      'DELETE FROM items WHERE room_id = $1',
      [id]
    );
    // 2) Remove the room itself
    const result = await client.query(
      `DELETE FROM rooms
         WHERE id = $1
           AND user_id = $2
       RETURNING id`,
      [id, userId]
    );
    if (result.rowCount === 0) {
      // no room matched (wrong id or wrong user)
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Room not found.' });
    }
    await client.query('COMMIT');
    res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error deleting room:', err);
    res.status(500).json({ error: 'Failed to delete room.' });
  } finally {
    client.release();
  }
});

module.exports = router;
