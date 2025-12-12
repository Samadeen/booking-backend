import express from 'express';
import pool from '../config/db.js';
import authenticateSuperAdmin from '../middleware/auth.js';

const router = express.Router();

// Submit venue request (public)
router.post('/', async (req, res) => {
  try {
    const { customer_name, venue_name, contact_email, description } = req.body;

    // Validate required fields
    if (!customer_name || !venue_name || !contact_email) {
      return res.status(400).json({
        error:
          'Missing required fields: customer_name, venue_name, contact_email',
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      return res.status(400).json({
        error: 'Invalid email format',
      });
    }

    const result = await pool.query(
      `INSERT INTO venue_requests 
       (customer_name, venue_name, contact_email, description)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [customer_name, venue_name, contact_email, description || null]
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
    const { status } = req.query;

    let query = 'SELECT * FROM venue_requests WHERE 1=1';
    const params = [];

    // Filter by status if provided
    if (status) {
      query += ' AND status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      requests: result.rows,
      total: result.rows.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get venue requests by status (protected)
router.get('/status/:status', authenticateSuperAdmin, async (req, res) => {
  try {
    const { status } = req.params;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: pending, approved, or rejected',
      });
    }

    const result = await pool.query(
      'SELECT * FROM venue_requests WHERE status = $1 ORDER BY created_at DESC',
      [status]
    );

    res.json({
      requests: result.rows,
      status: status,
      count: result.rows.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single venue request (protected)
router.get('/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM venue_requests WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venue request not found' });
    }

    res.json({ request: result.rows[0] });
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

    // Validate status
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: pending, approved, or rejected',
      });
    }

    // Check if request exists
    const checkRequest = await pool.query(
      'SELECT * FROM venue_requests WHERE id = $1',
      [id]
    );

    if (checkRequest.rows.length === 0) {
      return res.status(404).json({ error: 'Venue request not found' });
    }

    const currentRequest = checkRequest.rows[0];

    // Update status
    const result = await pool.query(
      'UPDATE venue_requests SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );

    res.json({
      message: `Venue request status updated from '${currentRequest.status}' to '${status}'`,
      request: result.rows[0],
      previous_status: currentRequest.status,
      new_status: status,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update entire venue request (protected)
router.put('/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { customer_name, venue_name, contact_email, description, status } =
      req.body;

    // Validate status if provided
    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        error: 'Invalid status. Must be: pending, approved, or rejected',
      });
    }

    // Validate email if provided
    if (contact_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(contact_email)) {
        return res.status(400).json({
          error: 'Invalid email format',
        });
      }
    }

    const result = await pool.query(
      `UPDATE venue_requests 
       SET customer_name = $1,
           venue_name = $2,
           contact_email = $3,
           description = $4,
           status = $5
       WHERE id = $6 
       RETURNING *`,
      [
        customer_name,
        venue_name,
        contact_email,
        description || null,
        status || 'pending',
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venue request not found' });
    }

    res.json({
      message: 'Venue request updated successfully',
      request: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete venue request (protected)
router.delete('/:id', authenticateSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM venue_requests WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Venue request not found' });
    }

    res.json({
      message: 'Venue request deleted successfully',
      deleted_request: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get venue request statistics (protected)
router.get('/stats/summary', authenticateSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COUNT(*) as total_requests
      FROM venue_requests
    `);

    res.json({ statistics: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
