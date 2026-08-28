// ============================================================================
// Daily Activity Reports Routes (Phase 4)
// ============================================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/auth/middleware.js';
import {
  validateActivityReport,
  validateUuid,
} from '../services/validate.js';
import {
  createActivityReport,
  findActivityReportById,
  listActivityReports,
} from '../services/reports.service.js';

export const reportsRouter = Router();

// Caregiver submits a daily activity report
reportsRouter.post('/', requireAuth, requireRole('caregiver', 'admin'), async (req, res) => {
  const data = validateActivityReport(req.body);
  const report = await createActivityReport(data);
  res.status(201).json({ status: 'ok', report });
});

// List activity reports with filters
reportsRouter.get('/', requireAuth, async (req, res) => {
  const { elderlyUserId, caregiverId, startDate, endDate } = req.query;
  const reports = await listActivityReports({
    elderlyUserId,
    caregiverId,
    startDate,
    endDate,
    user: req.user,
  });
  res.json({ status: 'ok', count: reports.length, reports });
});

// Get specific activity report
reportsRouter.get('/:id', requireAuth, async (req, res) => {
  validateUuid(req.params.id, 'reportId');
  const report = await findActivityReportById(req.params.id);
  res.json({ status: 'ok', report });
});
