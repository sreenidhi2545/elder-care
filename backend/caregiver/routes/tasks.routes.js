// ============================================================================
// Tasks Assignment & Tracking Routes (Phase 4)
// ============================================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/auth/middleware.js';
import { forbidden } from '../../shared/http/errors.js';
import { hasManageCaregiversPermission } from '../../family/links.js';
import { isAssignedCaregiver } from '../services/authorize.js';
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

// Elderly self, the caregiver being assigned (if any), family with
// hasManageCaregiversPermission, or admin.
async function requireTaskCreatePermission(req, data) {
  if (req.user.id === data.elderlyUserId || req.user.role === 'admin') return;
  if (req.user.role === 'caregiver' && data.assignedToCaregiverId && (await isAssignedCaregiver(req.user.id, data.assignedToCaregiverId))) return;
  if (await hasManageCaregiversPermission(req.user.id, data.elderlyUserId)) return;
  throw forbidden('not_permitted', 'You are not permitted to create a task for this account.');
}

// Same set for read and for marking a task's status.
async function requireTaskAccess(req, task) {
  if (req.user.id === task.elderlyUserId || req.user.role === 'admin') return;
  if (req.user.role === 'caregiver' && task.assignedToCaregiverId && (await isAssignedCaregiver(req.user.id, task.assignedToCaregiverId))) return;
  if (await hasManageCaregiversPermission(req.user.id, task.elderlyUserId)) return;
  throw forbidden('not_permitted', 'You are not permitted to access this task.');
}

// Create/assign a task
tasksRouter.post('/', requireAuth, requireRole('elderly', 'family', 'caregiver', 'admin'), async (req, res) => {
  const data = validateCreateTask(req.body);
  await requireTaskCreatePermission(req, data);
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
  await requireTaskAccess(req, task);
  res.json({ status: 'ok', task });
});

// Update task status (mark in_progress, completed, skipped)
tasksRouter.patch('/:id/status', requireAuth, requireRole('caregiver', 'elderly', 'family', 'admin'), async (req, res) => {
  validateUuid(req.params.id, 'taskId');
  const { status, completionNotes } = validateTaskStatusUpdate(req.body);
  const existing = await findTaskById(req.params.id);
  await requireTaskAccess(req, existing);
  const task = await updateTaskStatus(req.params.id, status, req.user, completionNotes);
  res.json({ status: 'ok', task });
});
