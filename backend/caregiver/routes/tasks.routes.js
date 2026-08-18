// ============================================================================
// Tasks Assignment & Tracking Routes (Phase 4)
// ============================================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/auth/middleware.js';
import {
  validateCreateTask,
  validateTaskStatusUpdate,
  validateUuid,
} from '../services/validate.js';
import {
  createTask,
  findTaskById,
  listTasks,
  updateTaskStatus,
} from '../services/tasks.service.js';

export const tasksRouter = Router();

// Create/assign a task
tasksRouter.post('/', requireAuth, requireRole('elderly', 'family', 'caregiver', 'admin'), async (req, res) => {
  const data = validateCreateTask(req.body);
  const task = await createTask(data, req.user.id);
  res.status(201).json({ status: 'ok', task });
});

// List tasks with filters
tasksRouter.get('/', requireAuth, async (req, res) => {
  const { caregiverId, elderlyUserId, carePlanId, scheduleId, status, dueDate } = req.query;
  const tasks = await listTasks({
    caregiverId,
    elderlyUserId,
    carePlanId,
    scheduleId,
    status,
    dueDate,
    user: req.user,
  });
  res.json({ status: 'ok', count: tasks.length, tasks });
});

// Get task by ID
tasksRouter.get('/:id', requireAuth, async (req, res) => {
  validateUuid(req.params.id, 'taskId');
  const task = await findTaskById(req.params.id);
  res.json({ status: 'ok', task });
});

// Update task status (mark in_progress, completed, skipped)
tasksRouter.patch('/:id/status', requireAuth, async (req, res) => {
  validateUuid(req.params.id, 'taskId');
  const { status, completionNotes } = validateTaskStatusUpdate(req.body);
  const task = await updateTaskStatus(req.params.id, status, req.user, completionNotes);
  res.json({ status: 'ok', task });
});
