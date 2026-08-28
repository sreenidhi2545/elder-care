// ============================================================================
// Caregiver Schedules & Calendar Routes
// ============================================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/auth/middleware.js';
import {
  validateCreateSchedule,
  validateScheduleStatusUpdate,
  validateUuid,
} from '../services/validate.js';
import {
  createSchedule,
  findScheduleById,
  listSchedules,
  updateScheduleStatus,
} from '../services/schedules.service.js';

export const schedulesRouter = Router();

// Create schedule visit slot
schedulesRouter.post('/', requireAuth, requireRole('caregiver', 'family', 'elderly', 'admin'), async (req, res) => {
  const data = validateCreateSchedule(req.body);
  const schedule = await createSchedule(data);
  res.status(201).json({ status: 'ok', schedule });
});

// List schedules
schedulesRouter.get('/', requireAuth, async (req, res) => {
  const { caregiverId, elderlyUserId, startDate, endDate, status } = req.query;
  const schedules = await listSchedules({
    caregiverId,
    elderlyUserId,
    startDate,
    endDate,
    status,
    user: req.user,
  });
  res.json({ status: 'ok', count: schedules.length, schedules });
});

// Get schedule slot by ID
schedulesRouter.get('/:id', requireAuth, async (req, res) => {
  validateUuid(req.params.id, 'scheduleId');
  const schedule = await findScheduleById(req.params.id);
  res.json({ status: 'ok', schedule });
});

// Update schedule status
schedulesRouter.patch('/:id', requireAuth, async (req, res) => {
  validateUuid(req.params.id, 'scheduleId');
  const { status, notes } = validateScheduleStatusUpdate(req.body);
  const schedule = await updateScheduleStatus(req.params.id, status, notes);
  res.json({ status: 'ok', schedule });
});
