# Task 10: Community Guidelines Screen

## Description

Create a community guidelines screen accessible from the Community tab and Settings that users must acknowledge before making their first post. Display comprehensive guidelines covering acceptable content, prohibited behavior, and consequences of violations. Content managed by admin through the super-admin panel. Implement database schema for tracking acknowledgment and provide UI components for web and mobile.

## Affected Apps/Packages

- `apps/api` - Hono.js backend API
- `packages/db` - Prisma schema for guidelines
- `packages/ui` - React components for web
- `packages/ui-mobile` - React Native components
- `packages/api-client` - API client methods
- `apps/web-learner` - Learner web app
- `apps/web-mentor` - Mentor web app
- `apps/mobile` - React Native mobile app
- `apps/web-admin` - Admin panel for managing guidelines

## Database Schema (Prisma)

```prisma
model CommunityGuidelines {
  id String @id @default(cuid())

  // Content sections
  title String @default("Community Guidelines")
  introduction String @db.Text // Welcome/overview paragraph
  lastUpdatedAt DateTime @default(now())

  // Guideline sections
  sections CommunityGuidelineSection[]

  // Enforcement
  enforcementPolicy String? @db.Text // How violations are handled

  // Admin tracking
  createdBy String
  creator User @relation("GuidelinesCreated", fields: [createdBy], references: [id])
  updatedBy String
  updater User @relation("GuidelinesUpdated", fields: [updatedBy], references: [id])

  // Version control
  version Int @default(1)
  isActive Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isActive])
  @@index([createdAt])
}

model CommunityGuidelineSection {
  id String @id @default(cuid())

  guidelinesId String
  guidelines CommunityGuidelines @relation(fields: [guidelinesId], references: [id], onDelete: Cascade)

  title String // "Respectful Behavior", "Content Quality", etc.
  description String @db.Text
  examples String[]? // Array of good/bad examples
  order Int // For sorting sections

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([guidelinesId, order])
  @@index([guidelinesId])
}

model CommunityGuidelinesAcknowledgment {
  id String @id @default(cuid())

  userId String
  user User @relation("GuidelinesAcknowledgments", fields: [userId], references: [id], onDelete: Cascade)

  guidelineVersion Int // Version acknowledged
  ipAddress String?
  userAgent String?

  createdAt DateTime @default(now())

  @@unique([userId, guidelineVersion])
  @@index([userId])
  @@index([createdAt])
}

// Extend User model
extend model User {
  guidelinesAcknowledgments CommunityGuidelinesAcknowledgment[]
  guidelinesCreated CommunityGuidelines[] @relation("GuidelinesCreated")
  guidelinesUpdated CommunityGuidelines[] @relation("GuidelinesUpdated")
}
```

## Default Community Guidelines Content

### Title

"Community Guidelines for Mentor Platform"

### Introduction

```
Welcome to our thriving community! We're committed to creating a respectful,
inclusive, and supportive space where learners and instructors can connect,
share knowledge, and grow together. These guidelines help us maintain that
environment for everyone.

By participating in our community, you agree to follow these guidelines.
Violations may result in content removal, temporary suspension, or account
termination, depending on severity.
```

### Standard Sections

#### 1. Respectful Behavior

**Description:**

```
Treat all community members with kindness and respect, regardless of their
background, experience level, or viewpoint.

- Be courteous in all interactions
- Listen to and consider different perspectives
- Disagree constructively without personal attacks
- Avoid discriminatory language or behavior
- Stand up for others if you witness disrespect
```

**Examples:**

- ✓ "I see your point, but I've had a different experience..."
- ✓ "Great tip! Here's another approach that might work..."
- ✗ "Your question is stupid, everyone knows this"
- ✗ "You're just [slur], what would you know"

#### 2. Content Quality

**Description:**

```
Share meaningful, helpful, and relevant content that adds value to discussions.

- Provide constructive feedback and helpful advice
- Share your genuine experience and knowledge
- Be clear and articulate in your posts
- Use appropriate formatting for readability
- Stay on topic in discussions
- Avoid spam, self-promotion, or excessive advertising
```

**Examples:**

- ✓ "This contouring technique is great for angular faces. I've found it works especially well if..."
- ✓ "I tried this approach and had mixed results because..."
- ✗ "Check out my makeup line at [link]!!!" (5 times)
- ✗ Random gibberish or repetitive text

#### 3. Intellectual Honesty

**Description:**

```
Give credit where it's due and share authentic experiences.

- Cite your sources and give credit to original creators
- Share your genuine opinions and experiences
- Don't plagiarize or copy content
- Be honest about your expertise level
- Acknowledge when you're unsure
```

**Examples:**

- ✓ "As I learned in [Course Name]..."
- ✓ "I'm new to this, but here's what I found..."
- ✗ Copying instructor's lesson content verbatim
- ✗ Claiming expertise you don't have

#### 4. No Harassment or Bullying

**Description:**

```
Do not engage in harassment, bullying, or abusive behavior. This includes:

- Targeted attacks on individuals or groups
- Threats of violence or harm
- Doxxing (sharing private information)
- Repeated unwanted contact
- Coordinated harassment campaigns
```

**Examples:**

- ✗ "Everyone report this user's posts" (coordinated harassment)
- ✗ Sharing someone's phone number or address
- ✗ Repeated comments mocking someone's appearance
- ✗ "I know where you live"

#### 5. No Hate Speech or Discrimination

**Description:**

```
Hateful conduct is not allowed. Do not post content that:

- Attacks individuals or groups based on protected characteristics
- Incites violence or discrimination
- Promotes hateful ideologies
- Uses slurs or dehumanizing language
```

**Protected characteristics include but are not limited to:**

- Race, ethnicity, national origin
- Religion or absence of religion
- Gender or gender identity
- Sexual orientation
- Disability or medical condition
- Age

#### 6. No Adult/Explicit Content

**Description:**

```
Maintain a family-friendly community environment.

- Do not share sexually explicit images or content
- Do not share graphic violence or gore
- Do not share content promoting illegal drug use
- Age-appropriate makeup/beauty advice only
```

**Examples:**

- ✗ Explicit images (even if makeup/art-related)
- ✗ Extreme injury or violence videos
- ✗ Detailed instructions for illegal activities

#### 7. Privacy and Safety

**Description:**

```
Respect privacy and maintain a safe environment for everyone.

- Don't share personal information without consent
- Don't ask for passwords or sensitive info
- Report suspicious behavior to us, not publicly
- Be cautious with sharing location information
- Protect your own account security
```

**Examples:**

- ✗ "Does anyone know [name]'s email address?"
- ✗ Publicly calling out a specific user for something
- ✓ "I received a suspicious message, should I report it?"

#### 8. No Illegal Activity

**Description:**

```
Do not use the community for illegal purposes.

- Don't sell counterfeit products
- Don't share hacked or leaked content
- Don't organize illegal activities
- Don't circumvent platform security
```

#### 9. No Self-Harm or Suicide Content

**Description:**

```
Do not share content promoting self-harm or suicide.

- This includes graphics, text, or links promoting these acts
- If you're struggling, reach out to professional resources
- Be supportive if someone shares they're struggling
```

**Resources:**

- [National Suicide Prevention Lifeline: 1-800-273-8255]
- [International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/]

#### 10. Enforcement and Consequences

**Description:**

```
We take violations seriously. Enforcement actions may include:

**First violation (minor):**
- Content removal
- Warning message

**Repeated violations or serious violations:**
- 24-hour to 7-day temporary suspension
- Comment/post removal
- Loss of community features

**Severe violations:**
- Permanent account suspension
- Content removal and reporting to authorities (if applicable)

**Examples of severe violations:**
- Illegal content
- Threats of violence
- Hate speech
- Organized harassment
- Child safety concerns

**Appeals Process:**
If you believe your account was suspended unfairly, you can appeal within 30 days
by contacting support@example.com with your case details.
```

## API Endpoints

### GET /api/community/guidelines

**Description:** Get current community guidelines

**Response (200 OK):**

```json
{
  "id": "guide_123",
  "title": "Community Guidelines for Mentor Platform",
  "introduction": "Welcome to our thriving community...",
  "sections": [
    {
      "id": "section_1",
      "title": "Respectful Behavior",
      "description": "Treat all community members with kindness...",
      "examples": [
        {
          "type": "good",
          "text": "I see your point, but I've had a different experience..."
        },
        {
          "type": "bad",
          "text": "Your question is stupid..."
        }
      ],
      "order": 1
    }
  ],
  "enforcementPolicy": "We take violations seriously...",
  "lastUpdatedAt": "2024-02-18T10:00:00Z",
  "version": 2
}
```

### POST /api/community/guidelines/acknowledge

**Description:** Record that user has acknowledged guidelines

**Request Body:**

```json
{
  "guidelineVersion": 2,
  "acceptTerms": true
}
```

**Response (201 Created):**

```json
{
  "id": "ack_123",
  "userId": "user_456",
  "guidelineVersion": 2,
  "acknowledgedAt": "2024-02-18T14:00:00Z"
}
```

**Notes:**

- Required before allowing first post
- Records IP address and user agent for compliance
- One acknowledgment per version (don't require re-acknowledgment for minor updates)

### GET /api/community/guidelines/acknowledgment

**Description:** Check if user has acknowledged current guidelines

**Response (200 OK):**

```json
{
  "hasAcknowledged": true,
  "acknowledgedVersion": 2,
  "currentVersion": 2,
  "needsReAcknowledgment": false,
  "acknowledgedAt": "2024-02-18T14:00:00Z"
}
```

### GET /api/admin/community/guidelines

**Description:** Get guidelines for editing (admin only)

**Response (200 OK):**
Same as GET /api/community/guidelines with edit mode

### PUT /api/admin/community/guidelines

**Description:** Update community guidelines (admin only)

**Request Body:**

```json
{
  "title": "Community Guidelines for Mentor Platform",
  "introduction": "Welcome to our thriving community...",
  "sections": [
    {
      "title": "Respectful Behavior",
      "description": "...",
      "examples": [
        { "type": "good", "text": "..." },
        { "type": "bad", "text": "..." }
      ],
      "order": 1
    }
  ],
  "enforcementPolicy": "..."
}
```

**Response (200 OK):**
Updated guidelines object

**Notes:**

- Creates new version (increments version number)
- Requires admin role
- Previous versions archived for compliance
- Triggers notification to all users about updates

### GET /api/admin/community/guidelines/history

**Description:** View guidelines version history (admin only)

**Response (200 OK):**

```json
{
  "versions": [
    {
      "version": 2,
      "title": "Community Guidelines...",
      "createdBy": "admin_user_id",
      "createdByName": "Admin Name",
      "createdAt": "2024-02-18T10:00:00Z",
      "acknowledgmentCount": 1234
    },
    {
      "version": 1,
      "title": "Community Guidelines...",
      "createdAt": "2024-01-01T12:00:00Z",
      "acknowledgmentCount": 5678
    }
  ]
}
```

## UI Components (Web)

### 1. CommunityGuidelinesModal Component

**Location:** `packages/ui/src/components/CommunityGuidelinesModal.tsx`

**Props:**

```typescript
interface CommunityGuidelinesModalProps {
  isOpen: boolean;
  onAccept: () => Promise<void>;
  onDecline?: () => void;
  isRequired?: boolean; // true: can't dismiss without accepting
  isLoading?: boolean;
}
```

**Layout:**

```
┌─────────────────────────────────────┐
│ Community Guidelines           [✕]  │
├─────────────────────────────────────┤
│ Community Guidelines for Mentor ... │
│                                     │
│ Welcome to our thriving community... │
│                                     │
│ [ Respectful Behavior ]             │
│ Treat all community members with... │
│ • Be courteous...                   │
│ • Listen to...                      │
│                                     │
│ Examples:                           │
│ ✓ "I see your point, but..."       │
│ ✗ "Your question is stupid..."     │
│                                     │
│ [ Content Quality ]                │
│ Share meaningful, helpful, and...   │
│ ...                                 │
│                                     │
│ [ Show more sections ] ▼           │
│                                     │
│ [ No Harassment or Bullying ]      │
│ Do not engage in harassment...     │
│                                     │
│ Version 2 - Updated Feb 18, 2024   │
├─────────────────────────────────────┤
│ [ ] I have read and agree to       │
│     these community guidelines      │
│                                     │
│      [Decline] [Accept & Continue] │
└─────────────────────────────────────┘
```

**Features:**

- Scrollable content area
- Expandable/collapsible sections
- Examples highlighted (good/bad)
- Version number and last updated date
- Checkbox for acceptance (required)
- Accept/Decline buttons
- Can't close without accepting (if required)
- Loading state during submission

### 2. CommunityGuidelinesPage Component

**Location:** `apps/web-learner/src/pages/community/guidelines.tsx`

**Features:**

- Full-page view of guidelines
- Accessible from "Guidelines" link in Community tab
- Same content as modal, but in page format
- Printable
- Link to report violations form

### 3. GuidelinesSettingsLink Component

**Location:** `apps/web-learner/src/components/GuidelinesSettingsLink.tsx`

**Features:**

- Link in Settings under Community section
- Opens full guidelines page or modal
- Shows last acknowledgment date
- "Re-acknowledge" button if guidelines updated

### 4. AdminGuidelinesEditor Component

**Location:** `apps/web-admin/src/components/AdminGuidelinesEditor.tsx`

**Props:**

```typescript
interface AdminGuidelinesEditorProps {
  initialGuidelines: CommunityGuidelines;
  onSave: (guidelines: CommunityGuidelines) => Promise<void>;
  isLoading?: boolean;
}
```

**Features:**

- Rich text editor for each section
- Drag to reorder sections
- Add/remove sections
- Preview mode (shows to users)
- Edit mode (admin editing)
- Save/Cancel buttons
- Version preview
- Publish button (bumps version)
- View previous versions
- See acknowledgment stats

## Mobile Components

### 1. CommunityGuidelinesModalMobile

**Location:** `packages/ui-mobile/src/components/CommunityGuidelinesModalMobile.tsx`

**Features:**

- Bottom sheet modal style
- Scrollable sections
- Large touch targets
- Accept/Decline buttons at bottom (sticky)
- Accept checkbox required

### 2. CommunityGuidelinesPage (Mobile)

**Location:** `apps/mobile/src/screens/CommunityGuidelinesScreen.tsx`

**Features:**

- Full-screen scrollable page
- Section headers that collapse/expand
- Tap to see examples
- Accept/Decline buttons

## Flow: First Community Post

### Web Flow

```
1. User clicks "Create Post" in Community tab
2. Check if user acknowledged guidelines (GET /api/community/guidelines/acknowledgment)
3. If not acknowledged:
   - Show CommunityGuidelinesModal (isRequired=true)
   - User must accept to close modal
   - POST /api/community/guidelines/acknowledge
   - Close modal, show compose form
4. If acknowledged:
   - Show compose form immediately
```

### Mobile Flow

```
1. User taps "Create Post" button
2. Check acknowledgment status
3. If needed:
   - Show bottom sheet modal
   - Swipe to read all sections
   - Tap checkbox to accept
   - Tap "Accept" button
   - POST to acknowledge
   - Close sheet, show compose form
4. If acknowledged:
   - Show compose form sheet immediately
```

## Admin Panel Implementation

### Admin Guidelines Management Page

**Location:** `apps/web-admin/src/pages/community/guidelines.tsx`

**Sections:**

- **Current Guidelines Preview** (read-only view)
- **Edit Guidelines** (form to edit)
- **Version History** (table of all versions)
- **Acknowledgment Statistics** (charts/stats)
  - Total users who acknowledged
  - Acknowledgments over time
  - By user role (learner/instructor)
  - Percentage of active users

**Actions:**

- Edit current version (draft mode)
- Publish new version
- View specific version
- Rollback to previous version (create new version from old)
- Export guidelines as PDF

## Database Migrations

```sql
-- Create initial guidelines
INSERT INTO "CommunityGuidelines"
(title, introduction, "enforcementPolicy", "createdBy", "updatedBy", version, "isActive", "createdAt", "updatedAt")
VALUES (
  'Community Guidelines for Mentor Platform',
  'Welcome to our thriving community...',
  'We take violations seriously...',
  'system-admin',
  'system-admin',
  1,
  true,
  NOW(),
  NOW()
);

-- Create default sections (see default content above)
INSERT INTO "CommunityGuidelineSection"
(title, description, examples, "guidelinesId", "order", "createdAt", "updatedAt")
VALUES ...
```

## Notification on Update

When guidelines are updated:

```typescript
async function publishNewGuidelines(guidelines: CommunityGuidelines) {
  // Create new version
  const newGuidelines = await db.communityGuidelines.create({
    data: {
      title: guidelines.title,
      introduction: guidelines.introduction,
      sections: guidelines.sections,
      enforcementPolicy: guidelines.enforcementPolicy,
      version: latestVersion + 1,
      createdBy: adminId,
      updatedBy: adminId,
    },
  });

  // Notify all users
  const users = await db.user.findMany({
    select: { id: true },
  });

  for (const user of users) {
    // Send in-app notification
    await createNotification(user.id, {
      type: "COMMUNITY_GUIDELINES_UPDATED",
      title: "Community Guidelines Updated",
      body: "Please review the updated guidelines before posting in the community",
      deepLink: "/community/guidelines",
    });

    // Mark as needs re-acknowledgment
    await db.communityGuidelinesAcknowledgment.updateMany({
      where: { userId: user.id },
      data: { needsUpdate: true },
    });
  }
}
```

## Acceptance Criteria

- [ ] CommunityGuidelines database schema created
- [ ] CommunityGuidelineSection schema with order support
- [ ] CommunityGuidelinesAcknowledgment tracks version acknowledgment
- [ ] Default guidelines seeded to database
- [ ] GET /api/community/guidelines returns full guidelines
- [ ] POST /api/community/guidelines/acknowledge records acknowledgment
- [ ] GET /api/community/guidelines/acknowledgment checks status
- [ ] PUT /api/admin/community/guidelines updates guidelines (admin only)
- [ ] New version increments version number
- [ ] GET /api/admin/community/guidelines/history shows versions
- [ ] CommunityGuidelinesModal shows all sections and examples
- [ ] Modal requires checkbox acceptance
- [ ] Modal blocks compose post until accepted (isRequired=true)
- [ ] Mobile bottom sheet modal functional
- [ ] First post flow checks acknowledgment
- [ ] Create post disabled until guidelines acknowledged
- [ ] Admin guidelines editor loads and saves
- [ ] Version history displays correctly
- [ ] Acknowledgment stats show user counts
- [ ] Notification sent when guidelines updated
- [ ] Previous guidelines versions archived
- [ ] IP address and user agent recorded with acknowledgment
- [ ] Guideline updates marked as required re-acknowledgment
- [ ] Notifications sent for major guideline updates
- [ ] Settings link shows last acknowledgment date
- [ ] Page is printable
- [ ] Mobile responsive and touch-friendly
- [ ] Accessibility: screen reader friendly, good contrast

## Dependencies

- `apps/api` - Hono backend
- `packages/db` - Prisma ORM
- `packages/ui` - React components
- `packages/ui-mobile` - React Native components
- `packages/api-client` - API hooks
- `apps/web-admin` - Admin panel

## Technical Notes

### Version Management

```typescript
// Create new version
async function createGuidelinesVersion(guidelinesData: any, adminId: string) {
  // Get latest version
  const latest = await db.communityGuidelines.findFirst({
    where: { isActive: true },
    orderBy: { version: "desc" },
  });

  // Soft delete old active version
  await db.communityGuidelines.update({
    where: { id: latest.id },
    data: { isActive: false },
  });

  // Create new version
  return db.communityGuidelines.create({
    data: {
      ...guidelinesData,
      version: (latest.version || 0) + 1,
      createdBy: adminId,
      updatedBy: adminId,
    },
  });
}
```

### Acknowledgment Check

```typescript
async function userHasAcknowledgedCurrentGuidelines(
  userId: string
): Promise<boolean> {
  const currentVersion = await db.communityGuidelines.findFirst({
    where: { isActive: true },
    select: { version: true },
  });

  const acknowledgment = await db.communityGuidelinesAcknowledgment.findFirst({
    where: {
      userId,
      guidelineVersion: currentVersion.version,
    },
  });

  return !!acknowledgment;
}
```

### Enforcement Tracking

```typescript
// For moderation features (future):
// Track when user violates guidelines
model CommunityViolation {
  id String @id @default(cuid())
  userId String
  user User @relation(fields: [userId], references: [id])

  violationType String // "hate_speech", "harassment", etc.
  violationLevel String // "warning", "temporary_suspend", "permanent_ban"
  reason String @db.Text

  createdAt DateTime @default(now())
}
```

### Compliance

- Keep versions permanently (don't delete)
- Log IP and user agent for legal compliance
- Provide data export for GDPR requests
- Include in terms of service
- Update policy document when guidelines change
