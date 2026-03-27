# M11-T1 · GDPR Compliance (Irish Client — Mandatory)

| Field          | Value                                                   |
| -------------- | ------------------------------------------------------- |
| **Milestone**  | M11 — Analytics & GDPR                                  |
| **Status**     | 🔲 To Do                                                |
| **Depends on** | M2-T1 (auth), M2-T4 (persona system), M1-T2 (DB schema) |
| **PRD Ref**    | Section 11 (GDPR)                                       |

---

## Description

GDPR compliance is mandatory — CeolX is an Irish client and the platform collects personal data. Covers consent at sign-up, right to erasure (account deletion), data portability (export), and inactive account handling.

---

## Affected Apps / Packages

| App / Package | Role                                                                                          |
| ------------- | --------------------------------------------------------------------------------------------- |
| `apps/api`    | Account deletion (anonymisation), data export endpoint, consent storage                       |
| `apps/mobile` | Consent screen at sign-up, account deletion flow in Settings, data export request in Settings |
| `apps/admin`  | No specific admin UI — handled server-side                                                    |

---

## API Endpoints

| Method | Path               | Purpose                                                |
| ------ | ------------------ | ------------------------------------------------------ |
| DELETE | `/users/me`        | Anonymise personal data (right to erasure)             |
| GET    | `/users/me/export` | Generate and return user's personal data export (JSON) |

---

## Requirements

- R1: Consent screen shown at sign-up for: data collection, location use, and marketing communications — opt-in checkboxes (not pre-checked)
- R2: Privacy Policy and Terms of Service links on the consent screen — must be accepted before proceeding
- R3: **Right to Erasure**: `DELETE /users/me` anonymises personal data (`name`, `email`, `avatar` nulled/replaced with anonymised placeholder) — non-personal content structures (events, posts) retained in DB but unlinked from identifiable user
- R4: **Right to Data Portability**: `GET /users/me/export` returns a JSON file of all personal data the platform holds for the user
- R5: Location data collected on-demand only (when map is opened) — not background tracking
- R6: Inactive accounts (no login for 24 months) flagged in DB for manual review — `users.flagged_inactive = true`
- R7: Cookie/tracking consent notice if any web analytics are added to `apps/admin`

---

## Acceptance Criteria

- [ ] Consent checkboxes shown at sign-up; user cannot proceed without accepting Privacy Policy + ToS
- [ ] Accepted consents stored with timestamp on user record
- [ ] Account deletion anonymises name, email, avatar; events/posts remain but show "Deleted User"
- [ ] Data export returns a downloadable JSON with the user's personal data
- [ ] No background location tracking — location only accessed when map screen is active
- [ ] Accounts inactive for 24 months have `flagged_inactive = true` set by a scheduled job

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
