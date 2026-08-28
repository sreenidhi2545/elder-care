// ============================================================================
// Family link routes — mounted at /family
//
//   POST /family/invites                     invite a registered person as family
//   POST /family/invites/:id/accept          invitee accepts — activates the link only
//   POST /family/invites/:id/decline         invitee declines — see links.js
//   POST /family/links/:id/revoke            pull an active link
//   GET  /family/links                       the caller's own links, either side
//   POST /family/links/:id/emergency-contact escalate a linked family member to
//                                             contact status — deliberate, separate
//                                             from accepting the invite
//
// Phase 1: family_links invitations, approval, revocation, and the deliberate
// escalation to emergency-contact status. Emergency contact CRUD for
// hand-entered contacts lives at /emergency/contacts (emergency/routes.js),
// not here — see API.md.
//
// Accepting an invite does NOT auto-add the invitee as an emergency contact.
// Dashboard access (family_links) and being phoned during SOS
// (emergency_contacts) are different permissions on purpose — see the
// family_links comment in schema.sql — so promoting one to the other is its
// own deliberate action (POST .../emergency-contact below), not a side effect
// of accepting.
// ============================================================================

import { Router } from 'express';
import { badRequest, notFound, forbidden, conflict } from '../shared/http/errors.js';
import { requireAuth } from '../shared/auth/middleware.js';
import { findUserByPhone, findUserById, toPublicUser } from '../shared/auth/users.js';
import {
  toPublicFamilyLink,
  findLinkById,
  findLinkByPair,
  findActiveLink,
  createOrReissueInvite,
  acceptInvite,
  declineInvite,
  revokeLink,
  deactivateLinkedContact,
  hasManageContactsPermission,
  listLinksForElderly,
  listLinksForFamily,
} from './links.js';
import {
  toPublicContact,
  findContactByPhone,
  createContact,
  nextContactPriority,
} from '../emergency/contacts.js';
import { validateInviteBody, validateListLinksQuery } from './validate.js';

const PG_UNIQUE_VIOLATION = '23505';

export const familyRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireLinkId(req) {
  const { id } = req.params;
  if (!UUID_RE.test(id)) {
    throw badRequest('validation_failed', 'Link id is not a valid identifier.', {
      details: [{ field: 'id', message: 'Must be a UUID.' }],
    });
  }
  return id;
}

// ---------------------------------------------------------------------------
// POST /family/invites
//
// Either the elderly user invites for their own account, or an existing
// owner-level family member invites on the elderly person's behalf — the
// common real case being a family member who set the account up in the first
// place bringing in a sibling who has nothing installed. 'view'/'manage'
// family members cannot send invites; only 'owner' can.
// ---------------------------------------------------------------------------

familyRouter.post('/invites', requireAuth, async (req, res) => {
  const input = validateInviteBody(req.body);

  let elderlyUserId;
  if (req.user.role === 'elderly') {
    elderlyUserId = req.user.id;
  } else {
    if (!input.elderlyUserId) {
      throw badRequest('validation_failed', 'One or more fields are invalid.', {
        details: [{ field: 'elderlyUserId', message: 'Required when the caller is not the elderly user themselves.' }],
      });
    }
    const actingLink = await findActiveLink(req.user.id, input.elderlyUserId);
    if (!actingLink || actingLink.permission_level !== 'owner') {
      throw forbidden('not_permitted', 'Only the elderly user or an owner-level family member may send invites.');
    }
    elderlyUserId = input.elderlyUserId;
  }

  // The one hard limitation of this whole flow: there is no way to invite
  // someone who has not registered yet. See BUILD_LOG.md, "known
  // limitations" — this is a documented gap, not an overlooked check.
  const invitee = await findUserByPhone(input.phone);
  if (!invitee) {
    throw notFound(
      'invitee_not_registered',
      'No account exists for that phone number. The person must register before they can be invited.'
    );
  }

  if (invitee.id === elderlyUserId) {
    throw badRequest('validation_failed', 'One or more fields are invalid.', {
      details: [{ field: 'phone', message: 'This phone number belongs to the elderly user themselves.' }],
    });
  }

  const link = await createOrReissueInvite({
    elderlyUserId,
    familyUserId: invitee.id,
    relationship: input.relationship,
    permissionLevel: input.permissionLevel,
    canViewLocation: input.canViewLocation,
    canManageContacts: input.canManageContacts,
    canManageCaregivers: input.canManageCaregivers,
    canAcknowledgeAlerts: input.canAcknowledgeAlerts,
    invitedBy: req.user.id,
  });

  if (!link) {
    const existing = await findLinkByPair(elderlyUserId, invitee.id);
    if (existing.status === 'active') {
      throw conflict('already_linked', 'This person already has active access to this account.', {
        link: toPublicFamilyLink(existing),
      });
    }
    throw conflict('invite_already_pending', 'An invite is already pending for this person.', {
      link: toPublicFamilyLink(existing),
    });
  }

  res.status(201).json({ status: 'ok', link: toPublicFamilyLink(link) });
});

// ---------------------------------------------------------------------------
// POST /family/invites/:id/accept — invitee only.
//
// Activates the link. Nothing else — no emergency_contacts row is created
// here. That's a separate, deliberate action; see
// POST /family/links/:id/emergency-contact below.
// ---------------------------------------------------------------------------

familyRouter.post('/invites/:id/accept', requireAuth, async (req, res) => {
  const id = requireLinkId(req);

  const link = await findLinkById(id);
  if (!link) throw notFound('invite_not_found', 'No invite with that id.');

  if (link.family_user_id !== req.user.id) {
    throw forbidden('not_invitee', 'Only the invited person can accept this invite.');
  }

  const updated = await acceptInvite(id, req.user.id);
  if (!updated) {
    throw conflict('invite_not_pending', 'This invite is no longer pending.');
  }

  res.json({ status: 'ok', link: toPublicFamilyLink(updated) });
});

// ---------------------------------------------------------------------------
// POST /family/invites/:id/decline — invitee only
// ---------------------------------------------------------------------------

familyRouter.post('/invites/:id/decline', requireAuth, async (req, res) => {
  const id = requireLinkId(req);

  const link = await findLinkById(id);
  if (!link) throw notFound('invite_not_found', 'No invite with that id.');

  if (link.family_user_id !== req.user.id) {
    throw forbidden('not_invitee', 'Only the invited person can decline this invite.');
  }

  const updated = await declineInvite(id, req.user.id);
  if (!updated) {
    throw conflict('invite_not_pending', 'This invite is no longer pending.');
  }

  res.json({ status: 'ok', link: toPublicFamilyLink(updated) });
});

// ---------------------------------------------------------------------------
// POST /family/links/:id/revoke — the elderly user, the family member
// themselves (leaving), or an owner-level family member for that same
// elderly account.
// ---------------------------------------------------------------------------

familyRouter.post('/links/:id/revoke', requireAuth, async (req, res) => {
  const id = requireLinkId(req);

  const link = await findLinkById(id);
  if (!link) throw notFound('link_not_found', 'No family link with that id.');

  let permitted = req.user.id === link.elderly_user_id || req.user.id === link.family_user_id;

  if (!permitted) {
    const actingLink = await findActiveLink(req.user.id, link.elderly_user_id);
    permitted = !!actingLink && actingLink.permission_level === 'owner';
  }

  if (!permitted) {
    throw forbidden('not_permitted', 'You are not permitted to revoke this family link.');
  }

  const updated = await revokeLink(id);
  if (!updated) {
    throw conflict('link_not_active', 'This family link is not active.');
  }

  // No-op unless POST .../emergency-contact was used on this link at some
  // point — see links.js. Deliberate default regardless: leaving a
  // phone-escalation path open to someone whose dashboard access was just
  // pulled for cause is the wrong default for an emergency product.
  await deactivateLinkedContact(updated.elderly_user_id, updated.family_user_id);

  res.json({ status: 'ok', link: toPublicFamilyLink(updated) });
});

// ---------------------------------------------------------------------------
// GET /family/links — the caller's own links, from whichever side they're on.
// An elderly caller sees who has (or is pending) access to their account; a
// family caller sees which elderly accounts they're linked to, including
// invites still awaiting their response (status=pending).
// ---------------------------------------------------------------------------

familyRouter.get('/links', requireAuth, async (req, res) => {
  const { status } = validateListLinksQuery(req.query);

  const rows =
    req.user.role === 'elderly'
      ? await listLinksForElderly(req.user.id, status)
      : await listLinksForFamily(req.user.id, status);

  res.json({ status: 'ok', count: rows.length, links: rows.map(toPublicFamilyLink) });
});

// ---------------------------------------------------------------------------
// POST /family/links/:id/emergency-contact — the deliberate action that
// promotes an active link to emergency-contact status. Separate from accept
// on purpose: viewing the dashboard and being phoned during SOS are different
// permissions, so making the second one happen has to be its own choice, not
// a side effect of the first.
//
// Permitted: the elderly user, or a family member with can_manage_contacts on
// an active link to that same elderly user (hasManageContactsPermission
// covers both — it returns true for the elderly user themselves without a
// row to check).
// ---------------------------------------------------------------------------

familyRouter.post('/links/:id/emergency-contact', requireAuth, async (req, res) => {
  const id = requireLinkId(req);

  const link = await findLinkById(id);
  if (!link) throw notFound('link_not_found', 'No family link with that id.');

  const permitted = await hasManageContactsPermission(req.user.id, link.elderly_user_id);
  if (!permitted) {
    throw forbidden('not_permitted', 'You are not permitted to manage contacts for this account.');
  }

  if (link.status !== 'active') {
    throw conflict('link_not_active', 'This family link is not active.');
  }

  const familyUser = toPublicUser(await findUserById(link.family_user_id));

  // App-level pre-check for a friendlier error than the raw uq_contact_per_user
  // violation — uq_contact_per_user is still the real backstop (see the catch
  // below): this is a query-then-insert, so a concurrent request could still
  // race past this check.
  const existingContact = await findContactByPhone(link.elderly_user_id, familyUser.phone);
  if (existingContact) {
    throw conflict(
      'contact_already_exists',
      'This person is already an emergency contact for this account.',
      { contact: toPublicContact(existingContact) }
    );
  }

  const priority = await nextContactPriority(link.elderly_user_id);

  let contact;
  try {
    contact = await createContact({
      userId: link.elderly_user_id,
      contactUserId: link.family_user_id,
      fullName: familyUser.fullName,
      phone: familyUser.phone,
      email: familyUser.email,
      relationship: link.relationship,
      priority,
      notifyBySms: true,
      notifyByCall: true,
      notifyByPush: true,
    });
  } catch (err) {
    if (err.code === PG_UNIQUE_VIOLATION) {
      throw conflict('contact_already_exists', 'This person is already an emergency contact for this account.');
    }
    throw err;
  }

  // One-time copy, never live-synced — if this family member later changes
  // their phone or email, this row does not update. See BUILD_LOG.md.
  res.status(201).json({ status: 'ok', contact: toPublicContact(contact) });
});
