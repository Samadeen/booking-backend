import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './routes/auth.js';
import venueRoutes from './routes/venues.js';
import venueRequestRoutes from './routes/venue-request.js';
import bookingRoutes from './routes/bookings.js';
// import tableTypeRoutes from './routes/table-type.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/venue-requests', venueRequestRoutes);
app.use('/api/bookings', bookingRoutes);
// app.use('/api/table-types', tableTypeRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
