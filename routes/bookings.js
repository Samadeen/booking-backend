import express from 'express';
import pool from '../config/db.js';
import authenticateSuperAdmin from '../middleware/auth.js';

const router = express.Router();

// Create booking (public)
router.post('/', async (req, res) => {
  try {
    const {
      venue_id,
      table_type_id,
      full_name,
      email,
      phone,
      date,
      time,
      guests,
      special_requests,
    } = req.body;

    // Validate required fields
    if (!venue_id || !full_name || !email || !date || !time) {
      return res.status(400).json({
        error:
          'Missing required fields: venue_id, full_name, email, date, time',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format',
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        error: 'Invalid date format. Expected YYYY-MM-DD',
      });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
    if (!timeRegex.test(time)) {
      return res.status(400).json({
        error: 'Invalid time format. Expected HH:MM (24-hour format)',
      });
    }

    // Check if venue exists
    const venueCheck = await pool.query('SELECT id FROM venues WHERE id = $1', [
      venue_id,
    ]);
    if (venueCheck.rows.length === 0) {
      return res.status(404).json({
        error: `Venue with id '${venue_id}' not found`,
      });
    }

    // Check if table_type exists (if provided)
    if (table_type_id) {
      const tableTypeCheck = await pool.query(
        'SELECT id FROM table_types WHERE id = $1',
        [table_type_id]
      );
      if (tableTypeCheck.rows.length === 0) {
        return res.status(404).json({
          error: `Table type with id '${table_type_id}' not found`,
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO bookings 
       (venue_id, table_type_id, full_name, email, phone, date, time, guests, special_requests, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending') RETURNING *`,
      [
        venue_id,
        table_type_id || null,
        full_name,
        email,
        phone || null,
        date,
        time,
        guests || null,
        special_requests || null,
      ]
    );

    res.status(201).json({
      message: 'Booking created successfully with pending status',
      booking: result.rows[0],
    });
  } catch (error) {
    console.error('Booking creation error:', error);

    // Handle specific database errors
    if (error.code === '23503') {
      // Foreign key violation
      if (error.constraint && error.constraint.includes('venue_id')) {
        return res.status(404).json({
          error: `Venue with id '${req.body.venue_id}' not found`,
          details: error.message,
        });
      }
      if (error.constraint && error.constraint.includes('table_type_id')) {
        return res.status(404).json({
          error: `Table type with id '${req.body.table_type_id}' not found`,
          details: error.message,
        });
      }
      return res.status(400).json({
        error: 'Invalid reference: One or more referenced records do not exist',
        details: error.message,
      });
    }

    if (error.code === '23505') {
      // Unique constraint violation
      return res.status(409).json({
        error: 'Duplicate entry: This booking already exists',
        details: error.message,
      });
    }

    if (error.code === '23502') {
      // Not null constraint violation
      return res.status(400).json({
        error: 'Missing required field',
        details: error.message,
      });
    }

    // Generic error response with actual error message
    res.status(500).json({
      error: 'Server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

// Get all bookings with filters (protected)
router.get('/', authenticateSuperAdmin, async (req, res) => {
  try {
    const { status, venue_id, date } = req.query;

    let query = `
      SELECT 
        b.*,
        v.name as venue_name,
        v.location as venue_location,
        tt.name as table_type_name,
        tt.capacity as table_capacity,
        tt.price as table_price
      FROM bookings b
      LEFT JOIN venues v ON b.venue_id = v.id
      LEFT JOIN table_types tt ON b.table_type_id = tt.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    // Add filters
    if (status) {
      query += ` AND b.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (venue_id) {
      query += ` AND b.venue_id = $${paramCount}`;
      params.push(venue_id);
      paramCount++;
    }

    if (date) {
      query += ` AND b.date = $${paramCount}`;
      params.push(date);
      paramCount++;
    }

    query += ' ORDER BY b.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      bookings: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get bookings by status (protected)
router.get('/status/:status', authenticateSuperAdmin, async (req, res) => {
  try {
    const { status } = req.params;

    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: pending, confirmed, or cancelled',
      });
    }

    const result = await pool.query(
      `SELECT 
        b.*,
        v.name as venue_name,
        v.location as venue_location,
        tt.name as table_type_name,
        tt.capacity as table_capacity
      FROM bookings b
      LEFT JOIN venues v ON b.venue_id = v.id
      LEFT JOIN table_types tt ON b.table_type_id = tt.id
      WHERE b.status = $1
      ORDER BY b.date DESC, b.time DESC`,
      [status]
    );

    res.json({
      bookings: result.rows,
      status: status,
      count: result.rows.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single booking by ID (protected)
router.get('/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        b.*,
        v.name as venue_name,
        v.location as venue_location,
        v.description as venue_description,
        tt.name as table_type_name,
        tt.description as table_type_description,
        tt.capacity as table_capacity,
        tt.price as table_price
      FROM bookings b
      LEFT JOIN venues v ON b.venue_id = v.id
      LEFT JOIN table_types tt ON b.table_type_id = tt.id
      WHERE b.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({ booking: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get booking by customer email (public - for customers to check their bookings)
router.get('/customer/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const result = await pool.query(
      `SELECT 
        b.*,
        v.name as venue_name,
        v.location as venue_location,
        tt.name as table_type_name,
        tt.capacity as table_capacity,
        tt.price as table_price
      FROM bookings b
      LEFT JOIN venues v ON b.venue_id = v.id
      LEFT JOIN table_types tt ON b.table_type_id = tt.id
      WHERE b.email = $1
      ORDER BY b.created_at DESC`,
      [email]
    );

    res.json({
      bookings: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update booking status (protected) - NEW ENHANCED VERSION
router.patch('/:id/status', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    if (!['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: pending, confirmed, or cancelled',
      });
    }

    // Check if booking exists
    const checkBooking = await pool.query(
      'SELECT * FROM bookings WHERE id = $1',
      [id]
    );

    if (checkBooking.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const currentBooking = checkBooking.rows[0];

    // Update booking status
    const result = await pool.query(
      `UPDATE bookings 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );

    res.json({
      message: `Booking status updated from '${currentBooking.status}' to '${status}'`,
      booking: result.rows[0],
      previous_status: currentBooking.status,
      new_status: status,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update entire booking (protected)
router.put('/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      venue_id,
      table_type_id,
      full_name,
      email,
      phone,
      date,
      time,
      guests,
      special_requests,
      status,
    } = req.body;

    // Validate status if provided
    if (status && !['pending', 'confirmed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: pending, confirmed, or cancelled',
      });
    }

    const result = await pool.query(
      `UPDATE bookings 
       SET venue_id = $1,
           table_type_id = $2,
           full_name = $3,
           email = $4,
           phone = $5,
           date = $6,
           time = $7,
           guests = $8,
           special_requests = $9,
           status = $10,
           updated_at = NOW()
       WHERE id = $11 
       RETURNING *`,
      [
        venue_id,
        table_type_id,
        full_name,
        email,
        phone,
        date,
        time,
        guests,
        special_requests,
        status || 'pending',
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      message: 'Booking updated successfully',
      booking: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Cancel booking (public - customers can cancel their own bookings)
router.patch('/cancel/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email } = req.body; // Require email for verification

    if (!email) {
      return res
        .status(400)
        .json({ error: 'Email is required to cancel booking' });
    }

    // Check if booking exists and belongs to the email
    const checkBooking = await pool.query(
      'SELECT * FROM bookings WHERE id = $1 AND email = $2',
      [id, email]
    );

    if (checkBooking.rows.length === 0) {
      return res.status(404).json({
        error: 'Booking not found or email does not match',
      });
    }

    const currentBooking = checkBooking.rows[0];

    if (currentBooking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    // Update to cancelled
    const result = await pool.query(
      `UPDATE bookings 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );

    res.json({
      message: 'Booking cancelled successfully',
      booking: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete booking (protected)
router.delete('/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM bookings WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      message: 'Booking deleted successfully',
      deleted_booking: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get booking statistics (protected)
router.get('/stats/summary', authenticateSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
        COUNT(*) as total_bookings
      FROM bookings
    `);

    res.json({ statistics: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
