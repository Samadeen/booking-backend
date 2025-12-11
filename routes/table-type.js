const express = require('express');
const pool = require('../config/database');
const { authenticateSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Get all table types (public)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM table_types ORDER BY capacity ASC'
    );

    res.json({ table_types: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single table type (public)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM table_types WHERE id = $1', [
      id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table type not found' });
    }

    res.json({ table_type: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add table type (protected)
router.post('/', authenticateSuperAdmin, async (req, res) => {
  try {
    const { name, description, capacity, price } = req.body;

    const result = await pool.query(
      `INSERT INTO table_types (name, description, capacity, price)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, description, capacity, price]
    );

    res.status(201).json({
      message: 'Table type added successfully',
      table_type: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update table type (protected)
router.put('/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, capacity, price } = req.body;

    const result = await pool.query(
      `UPDATE table_types 
       SET name = $1, description = $2, capacity = $3, price = $4
       WHERE id = $5 RETURNING *`,
      [name, description, capacity, price, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table type not found' });
    }

    res.json({
      message: 'Table type updated successfully',
      table_type: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete table type (protected)
router.delete('/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM table_types WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table type not found' });
    }

    res.json({ message: 'Table type deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
