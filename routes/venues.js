import express from 'express';
import pool from '../config/db.js';
import authenticateSuperAdmin from '../middleware/auth.js';

const router = express.Router();

// Add venue (protected)
router.post('/', authenticateSuperAdmin, async (req, res) => {
  try {
    const {
      name,
      location,
      description,
      capacity,
      amenities,
      price_range,
      images,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO venues (name, location, description, capacity, amenities, price_range, images)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, location, description, capacity, amenities, price_range, images]
    );

    res.status(201).json({
      message: 'Venue added successfully',
      venue: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all venues (public)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM venues ORDER BY created_at DESC'
    );

    res.json({ venues: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single venue (public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM venues WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    res.json({ venue: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update venue (protected)
router.put('/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      location,
      description,
      capacity,
      amenities,
      price_range,
      images,
    } = req.body;

    const result = await pool.query(
      `UPDATE venues 
       SET name = $1, location = $2, description = $3, capacity = $4, 
           amenities = $5, price_range = $6, images = $7
       WHERE id = $8 RETURNING *`,
      [
        name,
        location,
        description,
        capacity,
        amenities,
        price_range,
        images,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    res.json({
      message: 'Venue updated successfully',
      venue: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete venue (protected)
router.delete('/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM venues WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    res.json({ message: 'Venue deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
