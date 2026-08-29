// ============================================================================
// Caregiver Bookings Routes
// ============================================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/auth/middleware.js';
import { forbidden } from '../../shared/http/errors.js';
import { hasManageCaregiversPermission } from '../../family/links.js';
import { isAssignedCaregiver } from '../services/authorize.js';
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

// Elderly self, or family with hasManageCaregiversPermission, or admin —
// booking a caregiver on someone's behalf. Caregiver role is excluded
// already at requireRole below.
async function requireBookingCreatePermission(req, elderlyUserId) {
  if (req.user.id === elderlyUserId || req.user.role === 'admin') return;
  if (await hasManageCaregiversPermission(req.user.id, elderlyUserId)) return;
  throw forbidden('not_permitted', 'You are not permitted to book a caregiver for this account.');
}

// Elderly owner, the one who booked it, the assigned caregiver, a family
// member with hasManageCaregiversPermission, or admin.
async function requireBookingAccess(req, booking) {
  if (req.user.role === 'admin') return;
  if (req.user.id === booking.elderlyUserId || req.user.id === booking.bookedByUserId) return;
  if (req.user.role === 'caregiver' && (await isAssignedCaregiver(req.user.id, booking.caregiverId))) return;
  if (await hasManageCaregiversPermission(req.user.id, booking.elderlyUserId)) return;
  throw forbidden('not_permitted', 'You are not permitted to view this booking.');
}

// Create a booking request (elderly, family, admin)
bookingsRouter.post('/', requireAuth, requireRole('elderly', 'family', 'admin'), async (req, res) => {
  const data = validateCreateBooking(req.body);
  await requireBookingCreatePermission(req, data.elderlyUserId);
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
  await requireBookingAccess(req, booking);
  res.json({ status: 'ok', booking });
});

// Update booking status (accept, reject, cancel, complete)
bookingsRouter.patch('/:id/status', requireAuth, async (req, res) => {
  validateUuid(req.params.id, 'bookingId');
  const { status, cancellationReason } = validateBookingStatusUpdate(req.body);
  const booking = await updateBookingStatus(req.params.id, status, req.user, cancellationReason);
  res.json({ status: 'ok', booking });
});
