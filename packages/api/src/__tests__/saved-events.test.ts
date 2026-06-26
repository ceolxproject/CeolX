import { describe, expect, it, vi } from 'vitest';

// saved.ts pulls in @CeolX/db (and its env validation) at import time. Stub the
// DB + schema + sync service so importing the helper doesn't trigger env checks.
vi.mock('@CeolX/db', () => ({ db: {} }));
vi.mock('@CeolX/db/schema/auth', () => ({ user: {} }));
vi.mock('@CeolX/db/schema/bookings', () => ({ bookings: {} }));
vi.mock('@CeolX/db/schema/events', () => ({
  eventCollaborators: {},
  events: {},
  savedEvents: {},
  collections: {},
}));
vi.mock('@CeolX/db/schema/users', () => ({ artistProfiles: {}, venueProfiles: {} }));
vi.mock('../services/event-sync', () => ({
  syncEventToTypesense: vi.fn(),
  removeEventFromTypesense: vi.fn(),
}));

import { EventStatus } from '@CeolX/shared';

import { savedVisibleStatuses } from '../routers/events/saved';

// Asana 1216029035679712 — a saved event that's been admin-removed must drop out
// of a user's saved list. The includeArchived ("past / archived") view used to
// apply no status filter at all, leaking removed events; both views are pinned
// here so that regression can't return silently.
describe('savedVisibleStatuses', () => {
  it('default view shows only live events', () => {
    expect(savedVisibleStatuses(false)).toEqual([EventStatus.ACTIVE]);
  });

  it('includeArchived view adds creator-archived events', () => {
    expect(savedVisibleStatuses(true)).toEqual([EventStatus.ACTIVE, EventStatus.ARCHIVED]);
  });

  it('never returns admin-removed events in either view', () => {
    expect(savedVisibleStatuses(false)).not.toContain(EventStatus.REMOVED);
    expect(savedVisibleStatuses(true)).not.toContain(EventStatus.REMOVED);
  });

  it('never returns pre-publication statuses (draft / pending_review / rejected)', () => {
    for (const statuses of [savedVisibleStatuses(false), savedVisibleStatuses(true)]) {
      expect(statuses).not.toContain(EventStatus.DRAFT);
      expect(statuses).not.toContain(EventStatus.PENDING_REVIEW);
      expect(statuses).not.toContain(EventStatus.REJECTED);
    }
  });
});
