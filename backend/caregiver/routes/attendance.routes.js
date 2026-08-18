// ============================================================================
// Caregiver Attendance Tracking Routes (GPS Check-in / Check-out)
// ============================================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/auth/middleware.js';
import {
  validateAttendanceCheck,
  validateUuid,
} from '../services/validate.js';
import {
  recordCheckIn,
  recordCheckOut,
  verifyAttendance,
  listAttendance,
  findAttendanceById,
} from '../services/attendance.service.js';

export const attendanceRouter = Router();

// Caregiver GPS Check-in for a schedule slot
attendanceRouter.post('/schedules/:scheduleId/check-in', requireAuth, requireRole('caregiver', 'admin'), async (req, res) => {
  validateUuid(req.params.scheduleId, 'scheduleId');
  const checkData = validateAttendanceCheck(req.body);
  const attendance = await recordCheckIn(req.params.scheduleId, req.user, checkData);
  res.json({ status: 'ok', attendance });
});

// Caregiver GPS Check-out for a schedule slot
attendanceRouter.post('/schedules/:scheduleId/check-out', requireAuth, requireRole('caregiver', 'admin'), async (req, res) => {
  validateUuid(req.params.scheduleId, 'scheduleId');
  const checkData = validateAttendanceCheck(req.body);
  const attendance = await recordCheckOut(req.params.scheduleId, req.user, checkData);
  res.json({ status: 'ok', attendance });
});

// Family/Elderly verifies attendance
attendanceRouter.patch('/:id/verify', requireAuth, requireRole('family', 'elderly', 'admin'), async (req, res) => {
  validateUuid(req.params.id, 'attendanceId');
  const attendance = await verifyAttendance(req.params.id, req.user);
  res.json({ status: 'ok', attendance });
});

// List attendance logs
attendanceRouter.get('/', requireAuth, async (req, res) => {
  const { caregiverId, elderlyUserId, status } = req.query;
  const attendanceLogs = await listAttendance({
    caregiverId,
    elderlyUserId,
    status,
    user: req.user,
  });
  res.json({ status: 'ok', count: attendanceLogs.length, attendance: attendanceLogs });
});

// Get attendance log by ID
attendanceRouter.get('/:id', requireAuth, async (req, res) => {
  validateUuid(req.params.id, 'attendanceId');
  const attendance = await findAttendanceById(req.params.id);
  res.json({ status: 'ok', attendance });
});
