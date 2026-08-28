// ============================================================================
// Care Plans Routes (Phase 4)
// ============================================================================

import { Router } from 'express';
import { requireAuth, requireRole } from '../../shared/auth/middleware.js';
import {
  validateCarePlan,
  validateUuid,
} from '../services/validate.js';
import {
  createCarePlan,
  findCarePlanById,
  listCarePlansByElderlyId,
  updateCarePlan,
} from '../services/care-plans.service.js';

export const carePlansRouter = Router();

// Create a new care plan (elderly, family, admin)
carePlansRouter.post('/', requireAuth, requireRole('elderly', 'family', 'admin'), async (req, res) => {
  const data = validateCarePlan(req.body);
  const carePlan = await createCarePlan(data, req.user.id);
  res.status(201).json({ status: 'ok', carePlan });
});

// List care plans for an elderly user
carePlansRouter.get('/elderly/:elderlyUserId', requireAuth, async (req, res) => {
  validateUuid(req.params.elderlyUserId, 'elderlyUserId');
  const { status } = req.query;
  const carePlans = await listCarePlansByElderlyId(req.params.elderlyUserId, status);
  res.json({ status: 'ok', count: carePlans.length, carePlans });
});

// Get a specific care plan
carePlansRouter.get('/:id', requireAuth, async (req, res) => {
  validateUuid(req.params.id, 'carePlanId');
  const carePlan = await findCarePlanById(req.params.id);
  res.json({ status: 'ok', carePlan });
});

// Update care plan
carePlansRouter.patch('/:id', requireAuth, requireRole('elderly', 'family', 'admin'), async (req, res) => {
  validateUuid(req.params.id, 'carePlanId');
  const carePlan = await updateCarePlan(req.params.id, req.body);
  res.json({ status: 'ok', carePlan });
});
