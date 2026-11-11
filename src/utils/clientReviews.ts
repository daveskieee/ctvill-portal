/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ClientReviewStatus = 'Pending' | 'Approved' | 'Rejected';

export interface ClientReviewItem {
  id: string;
  clientName: string;
  companyOrProject: string;
  roleOrLocation: string;
  rating: number; // 1 to 5
  message: string;
  email?: string;
  status: ClientReviewStatus;
  createdAt: string;
  moderatedAt?: string;
  moderatedBy?: string;
}

export const CLIENT_REVIEWS_STORAGE_KEY = 'ctvill_client_reviews';
export const CLIENT_REVIEWS_COOLDOWN_KEY = 'ctvill_review_last_submit_ts';
export const CLIENT_REVIEWS_EVENT = 'ctvill-reviews-updated';
export const REVIEW_SUBMISSION_COOLDOWN_MS = 45 * 1000; // 45-second anti-spam rate-limit

export const DEFAULT_CLIENT_REVIEWS: ClientReviewItem[] = [
  {
    id: 'REV-1001',
    clientName: 'NexBridge Technologies',
    companyOrProject: 'System Developer Headquarters (350 sqm)',
    roleOrLocation: 'System Developer • Malolos, Bulacan',
    rating: 5,
    message:
      'CTVill constructed our 75 sqm office in 5 days, and when we tripled in size they built out our 350 sqm headquarters in Bulacan. Their detail-oriented craftsmanship — from binary decals to acoustic pods — gave our engineers a real sanctuary.',
    status: 'Approved',
    createdAt: '2026-08-14T09:00:00.000Z',
    moderatedAt: '2026-08-14T10:30:00.000Z',
    moderatedBy: 'Operations Director',
  },
  {
    id: 'REV-1002',
    clientName: 'Make Place Studio',
    companyOrProject: 'Owl Milk Tea & BG Comm Fit-Outs',
    roleOrLocation: 'Interior Design Firm • Est. 2016',
    rating: 5,
    message:
      'Collaborating with CTVill as our construction arm has allowed our interior design visions to become reality without friction. Their problem-solving on the ground — like tile-printed terrazzo at Owl Milk Tea — makes them our go-to partner.',
    status: 'Approved',
    createdAt: '2026-09-02T14:15:00.000Z',
    moderatedAt: '2026-09-02T16:00:00.000Z',
    moderatedBy: 'Operations Director',
  },
  {
    id: 'REV-1003',
    clientName: 'BG Comm Operations Board',
    companyOrProject: '1,000 sqm BPO Call Center Fit-Out',
    roleOrLocation: 'BPO Headquarters • Dumaguete, Negros',
    rating: 5,
    message:
      'Delivering a 1,000 sqm regional BPO facility outside Luzon within a strict 90-day window required military-grade logistics. CTVill handled sea freight, acoustic baffle zoning, and custom modular desks with 100% on-schedule handover.',
    status: 'Approved',
    createdAt: '2026-10-10T11:20:00.000Z',
    moderatedAt: '2026-10-10T13:00:00.000Z',
    moderatedBy: 'Operations Director',
  },
  {
    id: 'REV-1004',
    clientName: 'Ar. Lorenzo Villareal',
    companyOrProject: 'Redbin Creative Advertising Studio (135 sqm)',
    roleOrLocation: 'Facilities Director • Makati CBD',
    rating: 5,
    message:
      'Navigating MACEA work permits and strict Makati noise hours is notoriously difficult, yet CTVill completed our acoustic sliding partitions and open-air patio deck ahead of schedule with zero citations.',
    email: 'l.villareal@redbincreative.ph',
    status: 'Pending',
    createdAt: new Date(Date.now() - 3600 * 1000 * 5).toISOString(),
  },
];

export function getClientReviews(): ClientReviewItem[] {
  if (typeof window === 'undefined') return DEFAULT_CLIENT_REVIEWS;
  try {
    const raw = localStorage.getItem(CLIENT_REVIEWS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(CLIENT_REVIEWS_STORAGE_KEY, JSON.stringify(DEFAULT_CLIENT_REVIEWS));
      return DEFAULT_CLIENT_REVIEWS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_CLIENT_REVIEWS;
    }
    return parsed;
  } catch {
    return DEFAULT_CLIENT_REVIEWS;
  }
}

export function saveClientReviews(reviews: ClientReviewItem[]): ClientReviewItem[] {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CLIENT_REVIEWS_STORAGE_KEY, JSON.stringify(reviews));
      window.dispatchEvent(new CustomEvent(CLIENT_REVIEWS_EVENT, { detail: reviews }));
    } catch {
      /* ignore */
    }
  }
  return reviews;
}

export function submitClientReview(input: {
  clientName: string;
  companyOrProject: string;
  roleOrLocation?: string;
  rating: number;
  message: string;
  email?: string;
}): ClientReviewItem {
  const existing = getClientReviews();
  const newReview: ClientReviewItem = {
    id: `REV-${Date.now().toString().slice(-5)}`,
    clientName: input.clientName.trim(),
    companyOrProject: input.companyOrProject.trim(),
    roleOrLocation: (input.roleOrLocation || input.companyOrProject).trim(),
    rating: Math.min(5, Math.max(1, Math.round(Number(input.rating) || 5))),
    message: input.message.trim(),
    email: input.email?.trim() || undefined,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };
  const updated = [newReview, ...existing];
  saveClientReviews(updated);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CLIENT_REVIEWS_COOLDOWN_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }
  return newReview;
}

export function moderateClientReview(
  reviewId: string,
  newStatus: 'Approved' | 'Rejected',
  actorName = 'Operations Admin'
): ClientReviewItem[] {
  const existing = getClientReviews();
  const updated = existing.map((rev) =>
    rev.id === reviewId
      ? {
          ...rev,
          status: newStatus,
          moderatedAt: new Date().toISOString(),
          moderatedBy: actorName,
        }
      : rev
  );
  return saveClientReviews(updated);
}

export function deleteClientReview(reviewId: string): ClientReviewItem[] {
  const existing = getClientReviews();
  const updated = existing.filter((rev) => rev.id !== reviewId);
  return saveClientReviews(updated);
}

export function getReviewCooldownRemainingSeconds(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(CLIENT_REVIEWS_COOLDOWN_KEY);
    if (!raw) return 0;
    const lastTs = Number(raw);
    if (!lastTs || isNaN(lastTs)) return 0;
    const elapsed = Date.now() - lastTs;
    if (elapsed >= REVIEW_SUBMISSION_COOLDOWN_MS) return 0;
    return Math.ceil((REVIEW_SUBMISSION_COOLDOWN_MS - elapsed) / 1000);
  } catch {
    return 0;
  }
}

