# M12-T1 · Testing & QA

| Field | Value |
|-------|-------|
| **Milestone** | M12 — QA & Launch |
| **Status** | 🔲 To Do |
| **Depends on** | All M1–M11 tasks |
| **PRD Ref** | Section 10.3 (Testing Strategy) |

---

## Description
End-to-end QA across all milestones before production launch. Covers API integration tests, mobile regression testing on real devices, and cross-platform verification. The goal is a stable, crash-free launch on both iOS and Android.

---

## Affected Apps / Packages
| App / Package | Role |
|---------------|------|
| `apps/api` | Integration tests for all endpoints |
| `apps/mobile` | Manual + exploratory testing on iOS and Android real devices |
| `apps/admin` | Functional testing of admin flows |

---

## API Endpoints
None — testing task. No new endpoints.

---

## Requirements
- R1: All critical API endpoints covered by integration tests: auth flows, event CRUD, booking state machine, moderation actions, Stripe webhook handling
- R2: Happy path + error path tests for each endpoint group
- R3: Manual regression testing on physical iOS device (iPhone) and physical Android device
- R4: All four tab navigations tested: Map, Discover, Bookings, Profile
- R5: Test all four persona flows end-to-end: Spectator discovery, Artist event creation + moderation wait, Venue subscription + event creation, Super Admin moderation
- R6: Edge cases tested: location permission denied, no events in area, expired reset token, duplicate booking attempt, Stripe webhook tamper
- R7: Performance testing: map loads with 50 pins, feed loads with 20 items — no janky scrolling or noticeable delay
- R8: GDPR flows tested: account deletion anonymises data, data export returns correct data

---

## Acceptance Criteria
- [ ] All API integration tests passing
- [ ] No crash-level bugs on iOS or Android physical devices
- [ ] All four persona end-to-end flows completed without errors
- [ ] Map + feed performance acceptable (no jank at target load sizes)
- [ ] GDPR deletion and export verified
- [ ] Admin moderation flow fully tested
- [ ] Stripe webhook flows tested in Stripe test mode

---

## Technical Notes
- Use Stripe test mode and test card numbers for all payment/subscription testing
- Apple Sign-In testing requires a physical device and TestFlight build — do not skip this
- Test the empty state auto-expand flow by using a location with no events
- Regression test the persona-switching notification routing — it is complex and easy to break
- Keep a test log documenting each tested scenario and its outcome — reference for the launch sign-off
