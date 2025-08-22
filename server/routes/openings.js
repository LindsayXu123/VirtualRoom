// server/routes/openings.js
const express = require('express');
const router = express.Router();
const pool = require('../models/db'); // adjust path if needed

async function validateOpening({ roomId, side, offset_px, length_px, wallLen, excludeId }) {
  if (offset_px < 0 || length_px <= 0 || offset_px + length_px > wallLen) {
    return 'Opening exceeds wall bounds';
  }

  const params = [roomId, side];
  let sql = 'SELECT id, offset_px, length_px FROM room_openings WHERE room_id=$1 AND side=$2';
  if (excludeId) {
    sql += ' AND id <> $3';
    params.push(excludeId);
  }

  const { rows } = await pool.query(sql, params);
  const overlaps = rows.some(o => Math.max(o.offset_px, offset_px) < Math.min(o.offset_px + o.length_px, offset_px + length_px));
  if (overlaps) return 'Opening overlaps an existing one';
  return null;
}

// GET /api/rooms/:roomId/openings
router.get('/rooms/:roomId/openings', async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    const { rows } = await pool.query(
      'SELECT * FROM room_openings WHERE room_id=$1 ORDER BY id',
      [roomId]
    );
    res.json(rows);
  } catch (err) {
    console.error('List openings error:', err);
    res.status(500).json({ error: 'Failed to list openings' });
  }
});

// POST /api/rooms/:roomId/openings
// Body: { opening_type:'door'|'window', side:'N'|'E'|'S'|'W', offset_px, length_px, thickness_px?, swing?, roomWidth, roomHeight }
router.post('/rooms/:roomId/openings', async (req, res) => {
  try {
    const roomId = Number(req.params.roomId);
    const {
      opening_type, side,
      offset_px, length_px,
      thickness_px = 12, swing = null,
      roomWidth, roomHeight
    } = req.body;

    const wallLen = (side === 'N' || side === 'S') ? Number(roomWidth) : Number(roomHeight);
    const errMsg = await validateOpening({
      roomId,
      side,
      offset_px: Number(offset_px),
      length_px: Number(length_px),
      wallLen
    });
    if (errMsg) return res.status(400).json({ error: errMsg });

    const { rows } = await pool.query(
      `INSERT INTO room_openings (room_id, opening_type, side, offset_px, length_px, thickness_px, swing)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [roomId, opening_type, side, Number(offset_px), Number(length_px), Number(thickness_px), swing]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create opening error:', err);
    res.status(500).json({ error: 'Failed to create opening' });
  }
});

// PUT /api/openings/:id
// Body: { roomId, opening_type, side, offset_px, length_px, thickness_px?, swing?, roomWidth, roomHeight }
router.put('/openings/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const {
      roomId, opening_type, side,
      offset_px, length_px,
      thickness_px = 12, swing = null,
      roomWidth, roomHeight
    } = req.body;

    const wallLen = (side === 'N' || side === 'S') ? Number(roomWidth) : Number(roomHeight);
    const errMsg = await validateOpening({
      roomId: Number(roomId),
      side,
      offset_px: Number(offset_px),
      length_px: Number(length_px),
      wallLen,
      excludeId: id
    });
    if (errMsg) return res.status(400).json({ error: errMsg });

    const { rows } = await pool.query(
      `UPDATE room_openings
       SET opening_type=$1, side=$2, offset_px=$3, length_px=$4, thickness_px=$5, swing=$6, updated_at=NOW()
       WHERE id=$7
       RETURNING *`,
      [opening_type, side, Number(offset_px), Number(length_px), Number(thickness_px), swing, id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Update opening error:', err);
    res.status(500).json({ error: 'Failed to update opening' });
  }
});

// DELETE /api/openings/:id
router.delete('/openings/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM room_openings WHERE id=$1', [Number(req.params.id)]);
    res.sendStatus(204);
  } catch (err) {
    console.error('Delete opening error:', err);
    res.status(500).json({ error: 'Failed to delete opening' });
  }
});

module.exports = router;
