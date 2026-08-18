// ============================================================================
// Reviews & Ratings Service (Phase 4)
// ============================================================================

import { query } from '../../shared/db/pool.js';
import { notFound, conflict } from '../../shared/http/errors.js';

export function toReviewResponse(row) {
  if (!row) return null;
  return {
    id: row.id,
    caregiverId: row.caregiver_id,
    caregiverName: row.caregiver_name,
    bookingId: row.booking_id,
    reviewerUserId: row.reviewer_user_id,
    reviewerName: row.reviewer_name,
    elderlyUserId: row.elderly_user_id,
    rating: row.rating,
    punctualityRating: row.punctuality_rating,
    careQualityRating: row.care_quality_rating,
    communicationRating: row.communication_rating,
    comment: row.comment,
    isVisible: row.is_visible,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const REVIEW_SELECT = `
  SELECT rv.*,
         cu.full_name AS caregiver_name,
         ru.full_name AS reviewer_name
    FROM reviews rv
    JOIN caregivers c ON c.id = rv.caregiver_id
    JOIN users cu ON cu.id = c.user_id
    JOIN users ru ON ru.id = rv.reviewer_user_id
`;

export async function createReview(data, reviewerUserId) {
  const {
    caregiverId,
    bookingId,
    elderlyUserId,
    rating,
    punctualityRating,
    careQualityRating,
    communicationRating,
    comment,
  } = data;

  try {
    const { rows } = await query(
      `INSERT INTO reviews (
          caregiver_id, booking_id, reviewer_user_id, elderly_user_id,
          rating, punctuality_rating, care_quality_rating,
          communication_rating, comment, is_visible
       ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE
       )
       RETURNING id`,
      [
        caregiverId,
        bookingId,
        reviewerUserId,
        elderlyUserId,
        rating,
        punctualityRating,
        careQualityRating,
        communicationRating,
        comment,
      ]
    );

    // Recalculate caregiver's aggregate rating and total reviews
    await query(
      `UPDATE caregivers
          SET average_rating = COALESCE((SELECT ROUND(AVG(rating), 2) FROM reviews WHERE caregiver_id = $1 AND is_visible = TRUE), 0),
              total_reviews  = (SELECT COUNT(*) FROM reviews WHERE caregiver_id = $1 AND is_visible = TRUE)
        WHERE id = $1`,
      [caregiverId]
    );

    return findReviewById(rows[0].id);
  } catch (err) {
    if (err.code === '23505') {
      throw conflict('duplicate_review', 'You have already reviewed this booking.');
    }
    throw err;
  }
}

export async function findReviewById(id) {
  const { rows } = await query(`${REVIEW_SELECT} WHERE rv.id = $1`, [id]);
  if (!rows[0]) {
    throw notFound('review_not_found', 'Review not found.');
  }
  return toReviewResponse(rows[0]);
}

export async function listReviewsForCaregiver(caregiverId) {
  const { rows } = await query(
    `${REVIEW_SELECT}
      WHERE rv.caregiver_id = $1 AND rv.is_visible = TRUE
      ORDER BY rv.created_at DESC`,
    [caregiverId]
  );

  return rows.map(toReviewResponse);
}
