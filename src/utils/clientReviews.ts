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
    clientName: 'Engr. & Mrs. Roberto Santos',
    companyOrProject: '2-Storey Residential Residence in Batangas',
    roleOrLocation: 'Homeowners • Batangas',
    rating: 5,
    message:
      'LDM Construction executed our 2-storey residential build with stellar structural integrity and clean finishes. From architectural 3D plans to concrete pouring and roof trusses, Engr. Dan Ramos and his site engineers were completely transparent and ahead of schedule.',
    status: 'Approved',
    createdAt: '2026-08-14T09:00:00.000Z',
    moderatedAt: '2026-08-14T10:30:00.000Z',
    moderatedBy: 'Operations Director',
  },
  {
    id: 'REV-1002',
    clientName: 'Dr. Camille Villanueva',
    companyOrProject: 'Modern Farmhouse Build',
    roleOrLocation: 'Property Owner • Tagaytay / Cavite',
    rating: 5,
    message:
      'The 360° virtual tours gave us total peace of mind before interior fit-out started. The exposed beam cathedral ceiling, custom fluted carpentry, and waterproofed balcony were crafted with exceptional artisan craftsmanship.',
    status: 'Approved',
    createdAt: '2026-09-02T14:15:00.000Z',
    moderatedAt: '2026-09-02T16:00:00.000Z',
    moderatedBy: 'Operations Director',
  },
  {
    id: 'REV-1003',
    clientName: 'Arch. Marco & Sofia Dizon',
    companyOrProject: 'Proyecto Bahia 2-Storey Residence',
    roleOrLocation: 'Architect & Client • Laguna',
    rating: 5,
    message:
      'As design professionals, our standards for structural tolerance and architectural millwork are uncompromising. LDM Construction surpassed every milestone on our 14-phase WBS with meticulous engineering discipline.',
    status: 'Approved',
    createdAt: '2026-10-10T11:20:00.000Z',
    moderatedAt: '2026-10-10T13:00:00.000Z',
    moderatedBy: 'Operations Director',
  },
  {
    id: 'REV-1004',
    clientName: 'Apex Commercial Properties',
    companyOrProject: 'Commercial Building',
    roleOrLocation: 'Commercial Developer • Metro South',
    rating: 5,
    message:
      'Turnkey delivery of our commercial showroom and multi-tenant complex was handled with total cost transparency via their detailed BOM quotations and on-site QA logs. Highly recommended turnkey contractor.',
    email: 'projects@apexcommercial.ph',
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
      localStorage.setItem(CLIENT_REVIEWS_STORAGE_KEY, JSON.stringify(DEFAULT_CLIENT_REVIEWS));
      return DEFAULT_CLIENT_REVIEWS;
    }

    // Auto-migrate legacy CTVill/NexBridge/old test reviews to official LDM Construction reviews
    const hasLegacyData = parsed.some((r: any) => {
      const text = `${r.clientName || ''} ${r.companyOrProject || ''} ${r.message || ''}`.toLowerCase();
      return text.includes('ctvill') || text.includes('nexbridge') || text.includes('dan ramos') || text.includes('eduardo & sofia') || text.includes('raymond castillo');
    });

    if (hasLegacyData) {
      localStorage.setItem(CLIENT_REVIEWS_STORAGE_KEY, JSON.stringify(DEFAULT_CLIENT_REVIEWS));
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

