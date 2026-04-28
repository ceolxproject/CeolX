# M11-T1 · GDPR Compliance (Irish Client — Mandatory)

| Field          | Value                                                     |
| -------------- | --------------------------------------------------------- |
| **Milestone**  | M11 — Analytics & GDPR                                    |
| **Status**     | ✅ Done — PR #52 (R3 + R6). R1/R2/R5/R7 split to M11-T1.5 |
| **Depends on** | M2-T1 (auth), M2-T4 (persona system), M1-T2 (DB schema)   |
| **PRD Ref**    | Section 11 (GDPR)                                         |

---

## Description

GDPR compliance is mandatory — CeolX is an Irish client and the platform collects personal data. The original task covers consent at sign-up, right to erasure, data portability, and inactive account handling.

**Scope refinement (28 Apr 2026):** Priya re-scoped the deletion flow to a 30-day cooling-off period (mistake-recovery friendly) and dropped data portability for V1. Logging in within the 30-day window silently cancels deletion (toast on re-login). R1/R2/R5/R7 remain To Do; R3 + R6 are implemented in this PR.

---

## Affected Apps / Packages

| App / Package   | Role                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------ |
| `apps/server`   | tRPC mutations + QStash-scheduled `account.anonymize` handler + daily inactive-flag cron   |
| `apps/native`   | "Delete Account" button below Sign Out in profile settings, welcome-back toast on re-login |
| `apps/admin`    | No admin UI for V1                                                                         |
| `packages/auth` | BetterAuth `session.create.after` hook clears pending deletion on re-login                 |
| `packages/db`   | New deletion fields on the `user` table                                                    |

---

## API Surface (tRPC, not REST)

| Procedure                         | Kind     | Purpose                                                        |
| --------------------------------- | -------- | -------------------------------------------------------------- |
| `users.requestAccountDeletion`    | mutation | Stamp timestamps + enqueue 30-day-delayed `account.anonymize`  |
| `users.cancelAccountDeletion`     | mutation | Admin/rescue path — clear timestamps, stamp `cancelled_at`     |
| `users.acknowledgeDeletionNotice` | mutation | Mobile clears `deletion_cancelled_at` after showing the toast  |
| `users.me`                        | query    | Now returns `deletionCancelledNotice: boolean` (one-shot flag) |

---

## Requirements

- R1 (Out of scope this PR): Consent screen shown at sign-up. Note: `users.completeRegistration` already populates `consent_at` server-side; only the mobile UI is missing.
- R2 (Out of scope this PR): Privacy Policy / ToS links on consent screen.
- R3 ✅ **Right to Erasure (implemented)**: `users.requestAccountDeletion` schedules a 30-day-delayed QStash `account.anonymize` job. The handler overwrites PII on `user`, `artist_profiles`, `venue_profiles` and hard-deletes `profile_social_links`, `device_tokens`, `session`. `is_anonymized = true` blocks future logins via the BetterAuth hook.
- R4 ❌ **Dropped for V1**: data portability (`GET /users/me/export`) is not implemented. The original `data-export.process` / `data-export.notify` job stubs are retained for forward compatibility but unused.
- R5 (Out of scope this PR): on-demand location only. Mobile already enforces this via the existing location permission UX.
- R6 ✅ **Inactivity flag (implemented)**: daily QStash cron (`account.flag-inactive`, `0 2 * * *`) sets `flagged_inactive = true` for accounts with `last_login_at < now − 24mo` that aren't already flagged or anonymised. Cron is registered via `apps/server/src/jobs/setup-crons.ts` (run once per environment).
- R7 (Out of scope this PR): cookie/tracking consent on `apps/admin` if web analytics are added later.

---

## Acceptance Criteria (this PR)

- [x] User row gains `deletion_requested_at`, `deletion_scheduled_for`, `deletion_cancelled_at`, `is_anonymized`, `anonymized_at` (Drizzle migration `20260428062055_true_rogue.sql`)
- [x] `requestAccountDeletion` is idempotent — second call returns the existing `scheduledFor` and does not republish the QStash job
- [x] BetterAuth `session.create.after` hook stamps `last_login_at` on every login and clears deletion fields if pending
- [x] `account.anonymize` handler is idempotent — short-circuits on `isAnonymized=true` or `deletionScheduledFor=null`
- [x] All anonymisation writes happen inside one Drizzle transaction
- [x] Mobile renders "Delete Account" below Sign Out for Spectator/Artist/Venue (Super Admin uses web dashboard, excluded)
- [x] `Alert.alert` OK/Cancel confirms before publishing; on success, toast + sign-out + route to login
- [x] Welcome-back toast fires once on next login (cleared via `acknowledgeDeletionNotice`)
- [x] Daily inactive-flag cron registration script lands in repo

### Open (future PRs)

- [ ] R1/R2 mobile consent screen at sign-up
- [ ] R5 mobile location permission audit
- [ ] R7 admin cookie banner (only if web analytics get added)

---

---

## Technical Notes

### Account Deletion (Anonymisation vs Hard Delete)

Account deletion is **anonymisation only**, never a hard delete. Deleting a user's event entirely would break referential integrity and lose valuable historical data for other users' bookings and follows. Instead:

```typescript
app.delete('/api/v1/users/me', authMiddleware, async (c) => {
  const userId = c.get('userId');

  // Anonymise personal data
  await db
    .update(users)
    .set({
      name: 'Deleted User',
      email: `${userId}@deleted.ceolx.ie`,
      avatar: null,
      bio: null,
      phoneNumber: null,
      deletedAt: new Date(),
      isDeleted: true,
    })
    .where(eq(users.id, userId));

  // Anonymise artist/venue profiles
  await db
    .update(artistProfiles)
    .set({
      displayName: 'Deleted Artist',
      bio: null,
      profileImage: null,
      isDeleted: true,
    })
    .where(eq(artistProfiles.userId, userId));

  // Events remain; creator is now anonymised
  // Bookings remain; related events still show history

  // Invalidate sessions
  await db.delete(sessions).where(eq(sessions.userId, userId));

  // Clear push notification tokens
  await db.delete(deviceTokens).where(eq(deviceTokens.userId, userId));

  return c.json({ success: true, message: 'Account deleted' });
});
```

### Data Export (GDPR Right to Portability)

Exports all user data in a JSON file suitable for import to another service:

```typescript
app.get('/api/v1/users/me/export', authMiddleware, async (c) => {
  const userId = c.get('userId');

  // Fetch all user data
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  const artistProfile = await db.query.artistProfiles.findFirst({
    where: eq(artistProfiles.userId, userId),
  });
  const venueProfile = await db.query.venueProfiles.findFirst({
    where: eq(venueProfiles.userId, userId),
  });
  const events = await db.query.events.findMany({
    where: eq(events.createdBy, userId),
  });
  const bookings = await db.query.bookings.findMany({
    where: eq(bookings.artistId, userId),
  });
  const posts = await db.query.posts.findMany({
    where: eq(posts.createdBy, userId),
  });
  const follows = await db.query.follows.findMany({
    where: eq(follows.followerId, userId),
  });
  const savedEvents = await db.query.savedEvents.findMany({
    where: eq(savedEvents.userId, userId),
  });

  const exportData = {
    user,
    artistProfile,
    venueProfile,
    events,
    bookings,
    posts,
    follows,
    savedEvents,
    exportedAt: new Date().toISOString(),
  };

  const filename = `ceolx_data_export_${userId}_${new Date().toISOString().split('T')[0]}.json`;

  return c.json(exportData, 200, {
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Type': 'application/json',
  });
});
```

### Inactivity Flag Job (Cron)

Runs once daily (e.g., 2 AM UTC) to mark inactive accounts:

```typescript
// In a scheduled job runner (e.g., AWS EventBridge → Lambda)
async function flagInactiveAccounts() {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

  const updated = await db
    .update(users)
    .set({ flaggedInactive: true })
    .where(and(lt(users.lastLoginAt, twoYearsAgo), eq(users.flaggedInactive, false)));

  console.log(`Flagged ${updated} accounts as inactive`);
}
```

### Consent Schema (Drizzle)

```typescript
// Add to users table schema
consents: jsonb('consents').default(
  JSON.stringify({
    dataCollection: false,
    locationUse: false,
    marketingEmails: false,
    acceptedAt: null,
  })
),
```

### Consent Screen (React Native UI)

```typescript
// screens/OnboardingConsent.tsx
export function ConsentScreen({ onAccept }: { onAccept: () => void }) {
  const [consents, setConsents] = useState({
    dataCollection: false,
    locationUse: false,
    marketingEmails: false,
  });

  const [readPrivacy, setReadPrivacy] = useState(false);

  const handleAccept = async () => {
    if (!readPrivacy) {
      showErrorToast('Please accept Privacy Policy and ToS');
      return;
    }

    // Save consents to DB
    await api.post('/auth/consents', {
      consents,
      acceptedAt: new Date().toISOString(),
    });

    onAccept();
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="p-4">
        <Text className="mb-4 text-xl font-bold">Welcome to CeolX</Text>

        <View className="mb-6 rounded-lg bg-gray-50 p-4">
          <Text className="mb-3 font-semibold">Data & Privacy</Text>

          <CheckBox
            label="I consent to data collection (profile info, listening history)"
            checked={consents.dataCollection}
            onPress={() =>
              setConsents({ ...consents, dataCollection: !consents.dataCollection })
            }
          />

          <CheckBox
            label="I allow location access for event discovery"
            checked={consents.locationUse}
            onPress={() =>
              setConsents({ ...consents, locationUse: !consents.locationUse })
            }
          />

          <CheckBox
            label="I opt-in to marketing emails and offers"
            checked={consents.marketingEmails}
            onPress={() =>
              setConsents({ ...consents, marketingEmails: !consents.marketingEmails })
            }
          />
        </View>

        <View className="mb-6 rounded-lg border border-gray-300 p-4">
          <CheckBox
            label="I have read and accept the Privacy Policy and Terms of Service"
            checked={readPrivacy}
            onPress={() => setReadPrivacy(!readPrivacy)}
          />
          <Link href="/privacy" className="mt-2 text-blue-600">
            Privacy Policy
          </Link>
          <Link href="/terms" className="mt-1 text-blue-600">
            Terms of Service
          </Link>
        </View>

        <Button
          title="Accept & Continue"
          onPress={handleAccept}
          disabled={!readPrivacy}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
```

### Account Deletion UI (Settings)

```typescript
// screens/SettingsDeleteAccount.tsx
export function DeleteAccountScreen() {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      showErrorToast('Type "DELETE" to confirm');
      return;
    }

    setDeleting(true);
    try {
      await api.delete('/users/me');
      showSuccessToast('Account deleted');
      // Log out and navigate to login
      await logout();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    } catch (error) {
      showErrorToast('Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="p-4">
        <Text className="mb-4 text-lg font-bold text-red-600">
          Delete Account Permanently
        </Text>

        <View className="mb-4 rounded-lg bg-red-50 p-3">
          <Text className="text-sm text-red-800">
            This action cannot be undone. Your profile will be anonymised, but your events
            and bookings will remain in the system for historical records.
          </Text>
        </View>

        <Text className="mb-2 text-sm font-semibold">
          Type "DELETE" to confirm:
        </Text>
        <TextInput
          value={confirmText}
          onChangeText={setConfirmText}
          placeholder="Type DELETE"
          className="mb-4 rounded border border-gray-300 p-3"
        />

        <Button
          title="Delete Account"
          onPress={handleDelete}
          loading={deleting}
          color="red"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
```

---

## Common Gotchas

- **Anonymisation is not optional**: Simply setting a user as "deleted" while keeping their email on file is not GDPR-compliant. The email must be hashed or replaced with a placeholder like `{uuid}@deleted.ceolx.ie`.

- **Privacy Policy must be live before launch**: Many developers forget to draft and host the Privacy Policy and Terms of Service until the last minute. Flag this as a legal/client dependency early.

- **Consent withdrawal**: GDPR gives users the right to withdraw consent at any time. Consider adding a "Consent Settings" page where users can update their opt-ins (data collection, marketing, location) without deleting their account.

- **Data export timing**: Generating a full data export for large users can be slow. For V1 (under 1,000 users), exporting synchronously is fine. For scaling, consider an async job that emails the export link.

- **Timezone in export**: All timestamps in the export should be ISO 8601 UTC. Make it clear to the user that times are in UTC.

- **Inactivity job scheduling**: If using AWS Lambda + EventBridge, ensure the job runs at a consistent time and logs success/failure. Monitor job execution in CloudWatch.
