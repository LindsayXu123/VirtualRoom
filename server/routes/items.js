// server/routes/items.js
const express = require('express');
const router = express.Router();
const pool = require('../models/db');

// GET /api/items/inventory → list all inventory items for the current user (room_id IS NULL)
router.get('/inventory', async (req, res) => {
  try {
    const userId = req.auth.userId;
    const result = await pool.query(
      `SELECT id, name, type, width, height, notes
       FROM items
       WHERE user_id = $1
         AND room_id IS NULL`,
      [userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch inventory' });
  }
});


// GET all items in a specific room
router.get('/room/:roomId', async (req, res) => {
  const { roomId } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM items WHERE room_id = $1',
      [roomId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Failed to fetch items:', err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// DELETE /api/items/inventory/:id → delete a single inventory item for the logged‑in user
router.delete('/inventory/:id', async (req, res) => {
  try {
    const itemId = req.params.id;
    const userId = req.user.id;             // assuming you have auth middleware that sets req.user

    const result = await pool.query(
      `DELETE FROM items
       WHERE id = $1
         AND user_id = $2
         AND room_id IS NULL     -- only allow deleting inventory items
       RETURNING *`,
      [itemId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item not found or not owned by you.' });
    }

    res.json({ message: 'Item deleted successfully.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  }
});


// POST /api/items → create a new item in a room
router.post('/', async (req, res) => {
  const { room_id, name, type, pos_x, pos_y, width, height, notes } = req.body;
const userId = req.auth.userId;
  try {
    const result = await pool.query(
      `INSERT INTO items (room_id, name, type, pos_x, pos_y, width, height, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [room_id, name, type, pos_x, pos_y, width, height, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to create item:', err);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// PUT /api/items/:id → update item metadata or position
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, type, pos_x, pos_y, width, height, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE items
       SET name = $1, type = $2, pos_x = $3, pos_y = $4, width = $5, height = $6, notes = $7
       WHERE id = $8 RETURNING *`,
      [name, type, pos_x, pos_y, width, height, notes, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Failed to update item:', err);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/items/:id → remove an item
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM items WHERE id = $1', [id]);
    res.status(204).send();
  } catch (err) {
    console.error('Failed to delete item:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// PUT /api/items/:id/rotation → update only the rotation
router.put('/:id/rotation', async (req, res, next) => {
  const { id } = req.params;
  const { rotation } = req.body;
  if (rotation == null) {
    return res.status(400).json({ error: 'Must provide rotation.' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE items
         SET rotation = $1
       WHERE id = $2
       RETURNING *`,
      [rotation, id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/items/:id/color → update only the color
router.put('/:id/color', async (req, res, next) => {
  const { id }    = req.params;
  const { color } = req.body;
  if (!color) {
    return res.status(400).json({ error: 'Must provide color.' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE items
         SET color = $1
       WHERE id = $2
       RETURNING *`,
      [color, id]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'Item not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});


module.exports = router;
