import express from 'express';
import pool from '../config/db.js';
import authenticateSuperAdmin from '../middleware/auth.js';

const router = express.Router();

// Submit venue request (public)
router.post('/', async (req, res) => {
  try {
    const {
      venue_name,
      location,
      booking_datetime,
      num_guests,
      budget_range,
      special_preferences,
      customer_name,
      customer_email,
      customer_phone,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO venue_requests 
       (venue_name, location, booking_datetime, num_guests, budget_range, 
        special_preferences, customer_name, customer_email, customer_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        venue_name,
        location,
        booking_datetime,
        num_guests,
        budget_range,
        special_preferences,
        customer_name,
        customer_email,
        customer_phone,
      ]
    );

    res.status(201).json({
      message: 'Venue request submitted successfully',
      request: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all venue requests (protected)
router.get('/', authenticateSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM venue_requests ORDER BY created_at DESC'
    );

    res.json({ requests: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update venue request status (protected)
router.patch('/:id/status', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      'UPDATE venue_requests SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json({
      message: 'Request status updated',
      request: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
