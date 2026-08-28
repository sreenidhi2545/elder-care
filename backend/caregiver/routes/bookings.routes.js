// ============================================================================
// Caregiver Bookings Routes
// ============================================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/auth/middleware.js';
import {
  validateCreateBooking,
  validateBookingStatusUpdate,
  validateUuid,
} from '../services/validate.js';
import {
  createBooking,
  findBookingById,
  listBookingsForUser,
  updateBookingStatus,
} from '../services/bookings.service.js';

export const bookingsRouter = Router();

// Create a booking request (elderly, family, admin)
bookingsRouter.post('/', requireAuth, requireRole('elderly', 'family', 'admin'), async (req, res) => {
  const data = validateCreateBooking(req.body);
  const booking = await createBooking(data, req.user.id);
  res.status(201).json({ status: 'ok', booking });
});

// List bookings for caller
bookingsRouter.get('/', requireAuth, async (req, res) => {
  const { status } = req.query;
  const bookings = await listBookingsForUser(req.user, { status });
  res.json({ status: 'ok', count: bookings.length, bookings });
});

// Get a specific booking
bookingsRouter.get('/:id', requireAuth, async (req, res) => {
  validateUuid(req.params.id, 'bookingId');
  const booking = await findBookingById(req.params.id);
  res.json({ status: 'ok', booking });
});

// Update booking status (accept, reject, cancel, complete)
bookingsRouter.patch('/:id/status', requireAuth, async (req, res) => {
  validateUuid(req.params.id, 'bookingId');
  const { status, cancellationReason } = validateBookingStatusUpdate(req.body);
  const booking = await updateBookingStatus(req.params.id, status, req.user, cancellationReason);
  res.json({ status: 'ok', booking });
});
