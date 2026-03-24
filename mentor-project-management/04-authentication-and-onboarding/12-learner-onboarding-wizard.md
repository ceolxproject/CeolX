# Learner Onboarding Wizard

## Description

Implement onboarding wizard for new learners after first login. 3-4 screen walkthrough covering app introduction, role selection, interest/category selection with ability to skip. Wizard shown only on first login. User preferences saved to profile. Consistent UX across all 4 learner-facing apps: Learner Web, Mentor Web, Admin Web, and React Native mobile.

## Affected Apps/Packages

- Frontend: Learner Web App (Next.js)
- Frontend: Mentor Web App (Next.js)
- Frontend: Admin Web App (Next.js)
- Frontend: React Native Expo app
- Backend: Hono API
- Database: Store onboarding state and preferences

## API Endpoints

### GET /auth/user/onboarding-state

Get current user's onboarding state and preferences.

**Response** (200 OK):

```json
{
  "completed": false,
  "completedAt": null,
  "currentScreen": 1,
  "skipped": false,
  "preferences": {
    "role": null,
    "interests": [],
    "goals": []
  }
}
```

### POST /auth/user/onboarding/complete

Mark onboarding as complete and save preferences.

**Request Body**:

```json
{
  "role": "student", // or "business_owner", "freelancer", "employee", "educator_trainer", "other"
  "interests": ["graphic_design", "social_media", "skincare"],
  "goals": ["learn_new_skills", "career_change"],
  "skipped": false
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Onboarding completed",
  "user": {
    "id": "user_abc123",
    "preferredRole": "student",
    "interests": ["graphic_design", "social_media", "skincare"],
    "goals": ["learn_new_skills", "career_change"]
  }
}
```

### PUT /auth/user/onboarding/preferences

Update onboarding preferences (user can re-do wizard).

**Request Body**:

```json
{
  "interests": ["makeup_trends", "beauty_business"],
  "goals": ["start_business"]
}
```

**Response** (200 OK):

```json
{
  "success": true,
  "message": "Preferences updated"
}
```

## Requirements

### Onboarding Flow Screens

**Screen 1: Welcome/Introduction**

- App logo and greeting
- "Welcome to Mentor by Mentor"
- Brief description: "The premier platform for beauty and cosmetics learning"
- Next button
- Skip option (shows confirmation)
- No required fields

**Screen 2: Role Selection**

- Question: "What best describes you?"
- Radio button options:
  - Student (learning for personal knowledge)
  - Business Owner (managing cosmetics business)
  - Freelancer (freelance beauty professional)
  - Employee (beauty company employee)
  - Educator/Trainer (teaching others)
  - Other
- Required field
- Next button
- Back button
- Can skip

**Screen 3: Interest Selection**

- Question: "What are you interested in?"
- Checkbox options (multi-select):
  - Makeup Application
  - Skincare & Treatment
  - Hair & Scalp Care
  - Nail Art & Design
  - Beauty Business Management
  - Social Media & Marketing
  - Professional Makeup
  - Natural & Organic Beauty
  - Fragrance & Perfumery
  - Other
- Required at least 1, or allow skip
- "Select all that apply"
- Next button
- Back button

**Screen 4: Goals (Optional)**

- Question: "What are your learning goals?"
- Checkbox options (multi-select):
  - Learn new skills
  - Career advancement
  - Start a business
  - Improve existing knowledge
  - Get certified
  - Network with professionals
  - Stay updated with trends
- Optional, can skip
- "Complete" button (finish)
- Back button

### Onboarding State Tracking

- Create `userOnboarding` table:
  - `userId` (primary key)
  - `completed`: boolean
  - `completedAt`: timestamp (null if not completed)
  - `skipped`: boolean (user chose to skip)
  - `currentScreen`: integer (1-4)
  - `startedAt`: timestamp
  - `lastUpdatedAt`: timestamp
- Create `userPreferences` table:
  - `userId` (primary key)
  - `preferredRole`: string
  - `interests`: JSON array
  - `goals`: JSON array

### First Login Detection

- Check `onboarding.completed` on login
- If false and `startedAt` is null, show wizard
- If already started, resume from `currentScreen`
- Track first login vs returning user

### Skip Logic

- User can skip at any screen (except final confirmation)
- Skip confirmation modal: "Are you sure? You can complete this later."
- If skip: set `skipped: true`, `completed: false`
- Can return to wizard later from settings
- Each screen can be individually skipped

### Back Navigation

- Allow going back to previous screens
- Preserve entered data
- Update `currentScreen` as user navigates

### Completion Flow

- Last screen shows summary
- "Complete Setup" button
- On completion:
  - Set `completed: true`
  - Set `completedAt: now()`
  - Redirect to dashboard/home
  - Show success message
- User can redo wizard anytime from settings

### Data Persistence

- Auto-save on each screen (optional, for UX)
- Or only save on final completion
- Handle unsaved data on page close
- Clear preferences if user cancels/skips

### UI/UX Details

- Progress indicator (1/4, 2/4, etc.) at top
- Smooth transitions between screens
- Mobile-optimized (stack vertically)
- Accessibility: ARIA labels, keyboard navigation
- Animations: fade in/out screens
- Loading states while saving
- Error handling with retry

### Responsive Design

- Web: Center screen, 500px max width
- Mobile: Full width, large touch targets
- Tablet: Similar to web layout
- Maintain readability on all sizes

### Mobile Implementation (Expo)

- Same screens and logic
- Use React Navigation for screen transitions
- Support native back button
- Store preferences in AsyncStorage (sync to backend)
- Allow offline completion, sync on reconnect

### Re-Access Wizard

- User can redo wizard from account settings
- "Redo Onboarding" button
- Reset `completed: false`, `startedAt: null`
- Preserve previous preferences as defaults
- Show updated interests/goals

## Acceptance Criteria

- [ ] Onboarding shown only on first login
- [ ] Wizard has 4 screens with proper flow
- [ ] Screen 1 is welcome/intro
- [ ] Screen 2 has 6 role options
- [ ] Screen 3 has 10 interest options
- [ ] Screen 4 has 7 goal options (optional)
- [ ] Role selection is required
- [ ] At least 1 interest required or skip
- [ ] Goals are optional
- [ ] Skip available on all screens
- [ ] User can go back between screens
- [ ] Data saved on completion
- [ ] GET /auth/user/onboarding-state returns correct state
- [ ] POST /auth/user/onboarding/complete marks as done
- [ ] Preferences stored in database
- [ ] Progress indicator shows current screen
- [ ] Mobile optimized for all screen sizes
- [ ] Accessibility features present (ARIA, keyboard nav)
- [ ] Learner Web App includes wizard
- [ ] Mentor Web App includes wizard
- [ ] Admin Web App includes wizard
- [ ] React Native mobile includes wizard
- [ ] User can redo wizard from settings
- [ ] Preferences used for content recommendations

## Dependencies

- React for web apps
- React Native Expo for mobile
- Drizzle ORM for database
- Zod for form validation
- Framer Motion for animations (optional)

## Technical Notes

### Database Schema

```typescript
export const userOnboarding = pgTable("user_onboarding", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  completed: boolean("completed").notNull().default(false),
  completedAt: timestamp("completed_at"),
  skipped: boolean("skipped").notNull().default(false),
  currentScreen: integer("current_screen").notNull().default(1),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  lastUpdatedAt: timestamp("last_updated_at").notNull().defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  preferredRole: text("preferred_role"), // student, business_owner, etc.
  interests: jsonb("interests").notNull().default("[]"), // array of interest IDs
  goals: jsonb("goals").notNull().default("[]"), // array of goal IDs
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

### API Handlers

```typescript
export async function handleGetOnboardingState(c: Context) {
  const user = c.get("auth.user");
  if (!user) return c.json({ error: "UNAUTHORIZED" }, 401);

  const onboarding = await db.query.userOnboarding.findFirst({
    where: eq(userOnboarding.userId, user.id),
  });

  const preferences = await db.query.userPreferences.findFirst({
    where: eq(userPreferences.userId, user.id),
  });

  return c.json({
    completed: onboarding?.completed || false,
    completedAt: onboarding?.completedAt,
    currentScreen: onboarding?.currentScreen || 1,
    skipped: onboarding?.skipped || false,
    preferences: preferences || { role: null, interests: [], goals: [] },
  });
}

export async function handleCompleteOnboarding(c: Context) {
  const user = c.get("auth.user");
  if (!user) return c.json({ error: "UNAUTHORIZED" }, 401);

  const body = await c.req.json();
  const { role, interests, goals, skipped } = body;

  // Validate
  if (!skipped && !role) {
    return c.json({ error: "MISSING_ROLE" }, 400);
  }

  if (!skipped && (!interests || interests.length === 0)) {
    return c.json({ error: "MISSING_INTERESTS" }, 400);
  }

  // Update onboarding
  await db
    .update(userOnboarding)
    .set({
      completed: !skipped,
      skipped,
      completedAt: skipped ? null : new Date(),
      currentScreen: 4,
      lastUpdatedAt: new Date(),
    })
    .where(eq(userOnboarding.userId, user.id));

  // Update preferences
  await db
    .update(userPreferences)
    .set({
      preferredRole: role,
      interests: interests || [],
      goals: goals || [],
      updatedAt: new Date(),
    })
    .where(eq(userPreferences.userId, user.id));

  return c.json({
    success: true,
    message: "Onboarding completed",
    user: {
      id: user.id,
      preferredRole: role,
      interests,
      goals,
    },
  });
}
```

### React Component Structure

```typescript
// components/OnboardingWizard.tsx
'use client';

import { useState, useEffect } from 'react';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { RoleScreen } from './screens/RoleScreen';
import { InterestsScreen } from './screens/InterestsScreen';
import { GoalsScreen } from './screens/GoalsScreen';

const SCREENS = [WelcomeScreen, RoleScreen, InterestsScreen, GoalsScreen];

export function OnboardingWizard() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [formData, setFormData] = useState({
    role: null,
    interests: [],
    goals: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CurrentScreen = SCREENS[currentScreen];

  const handleNext = () => {
    if (currentScreen < SCREENS.length - 1) {
      setCurrentScreen(currentScreen + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleBack = () => {
    if (currentScreen > 0) {
      setCurrentScreen(currentScreen - 1);
    }
  };

  const handleSkip = async () => {
    if (confirm('Are you sure? You can complete this later.')) {
      await completeOnboarding(true);
    }
  };

  const completeOnboarding = async (skipped = false) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, skipped }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete onboarding');
      }

      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="onboarding-wizard">
      <div className="progress-bar">
        <span>{currentScreen + 1}/{SCREENS.length}</span>
      </div>

      <CurrentScreen
        data={formData}
        onChange={setFormData}
        onNext={handleNext}
        onBack={handleBack}
        onSkip={handleSkip}
        isLoading={loading}
        isLastScreen={currentScreen === SCREENS.length - 1}
        canGoBack={currentScreen > 0}
      />

      {error && <div className="error-message">{error}</div>}
    </div>
  );
}

// components/screens/RoleScreen.tsx
export function RoleScreen({ data, onChange, onNext, onBack, canGoBack }) {
  const roles = [
    { id: 'student', label: 'Student' },
    { id: 'business_owner', label: 'Business Owner' },
    { id: 'freelancer', label: 'Freelancer' },
    { id: 'employee', label: 'Employee' },
    { id: 'educator_trainer', label: 'Educator/Trainer' },
    { id: 'other', label: 'Other' },
  ];

  return (
    <div className="screen">
      <h2>What best describes you?</h2>

      <div className="options">
        {roles.map(role => (
          <label key={role.id} className="radio-option">
            <input
              type="radio"
              name="role"
              value={role.id}
              checked={data.role === role.id}
              onChange={() => onChange({ ...data, role: role.id })}
            />
            {role.label}
          </label>
        ))}
      </div>

      <div className="actions">
        {canGoBack && <button onClick={onBack}>Back</button>}
        <button
          onClick={onNext}
          disabled={!data.role}
          className="btn-primary"
        >
          Next
        </button>
      </div>
    </div>
  );
}

// components/screens/InterestsScreen.tsx
export function InterestsScreen({ data, onChange, onNext, onBack, canGoBack }) {
  const interests = [
    { id: 'makeup', label: 'Makeup Application' },
    { id: 'skincare', label: 'Skincare & Treatment' },
    { id: 'hair', label: 'Hair & Scalp Care' },
    { id: 'nails', label: 'Nail Art & Design' },
    { id: 'business', label: 'Beauty Business Management' },
    { id: 'marketing', label: 'Social Media & Marketing' },
    { id: 'professional', label: 'Professional Makeup' },
    { id: 'natural', label: 'Natural & Organic Beauty' },
    { id: 'fragrance', label: 'Fragrance & Perfumery' },
    { id: 'other', label: 'Other' },
  ];

  const handleInterestChange = (interestId: string) => {
    const newInterests = data.interests.includes(interestId)
      ? data.interests.filter(id => id !== interestId)
      : [...data.interests, interestId];

    onChange({ ...data, interests: newInterests });
  };

  return (
    <div className="screen">
      <h2>What are you interested in?</h2>
      <p>Select all that apply</p>

      <div className="options">
        {interests.map(interest => (
          <label key={interest.id} className="checkbox-option">
            <input
              type="checkbox"
              name="interests"
              value={interest.id}
              checked={data.interests.includes(interest.id)}
              onChange={() => handleInterestChange(interest.id)}
            />
            {interest.label}
          </label>
        ))}
      </div>

      <div className="actions">
        {canGoBack && <button onClick={onBack}>Back</button>}
        <button
          onClick={onNext}
          disabled={data.interests.length === 0}
          className="btn-primary"
        >
          Next
        </button>
      </div>
    </div>
  );
}
```

### Mobile Implementation (Expo)

```typescript
// screens/OnboardingScreen.tsx (Expo)
import { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export function OnboardingScreen() {
  const [currentScreen, setCurrentScreen] = useState(0);
  const [formData, setFormData] = useState({
    role: null,
    interests: [],
    goals: [],
  });

  const screens = [
    <WelcomeScreen />,
    <RoleSelectionScreen data={formData} onChange={setFormData} />,
    <InterestsScreen data={formData} onChange={setFormData} />,
    <GoalsScreen data={formData} onChange={setFormData} />,
  ];

  const handleNext = () => {
    if (currentScreen < screens.length - 1) {
      setCurrentScreen(currentScreen + 1);
    } else {
      completeOnboarding();
    }
  };

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ marginBottom: 20 }}>
        {currentScreen + 1} / {screens.length}
      </Text>

      {screens[currentScreen]}

      <TouchableOpacity onPress={handleNext} style={{ marginTop: 20 }}>
        <Text>Next</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Styles

```css
/* styles/onboarding.css */
.onboarding-wizard {
  max-width: 500px;
  margin: 50px auto;
  padding: 40px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
}

.progress-bar {
  text-align: center;
  margin-bottom: 30px;
  font-size: 14px;
  color: #666;
}

.screen {
  animation: fadeIn 0.3s ease-in;
}

.screen h2 {
  margin-bottom: 10px;
  font-size: 24px;
}

.screen p {
  color: #666;
  margin-bottom: 20px;
}

.options {
  margin: 30px 0;
}

.radio-option,
.checkbox-option {
  display: block;
  padding: 12px;
  margin-bottom: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.radio-option:hover,
.checkbox-option:hover {
  border-color: #007bff;
  background: #f8f9ff;
}

.radio-option input,
.checkbox-option input {
  margin-right: 10px;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 30px;
}

.actions button {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.btn-primary {
  background: #007bff;
  color: white;
}

.btn-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Mobile */
@media (max-width: 600px) {
  .onboarding-wizard {
    margin: 0;
    padding: 20px;
    height: 100vh;
  }

  .radio-option,
  .checkbox-option {
    padding: 16px;
  }
}
```

### Testing

```typescript
// tests/onboarding.test.ts
describe("Onboarding Wizard", () => {
  it("should show wizard on first login", async () => {
    const user = await createTestUser();
    const response = await app.request("/auth/user/onboarding-state", {
      headers: { Authorization: `Bearer ${user.token}` },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveProperty("completed", false);
  });

  it("should complete onboarding with valid data", async () => {
    const user = await createTestUser();

    const response = await app.request("/auth/onboarding/complete", {
      method: "POST",
      headers: { Authorization: `Bearer ${user.token}` },
      body: JSON.stringify({
        role: "student",
        interests: ["makeup", "skincare"],
        goals: ["learn_skills"],
      }),
    });

    expect(response.status).toBe(200);
  });
});
```
