# Task 2: Users and Profiles Tables

## Description

Create the core users and user profiles tables that form the foundation of the platform's user management system. These tables store user authentication credentials, profile information, preferences, and account status. Integration with BetterAuth requires specific fields for OAuth and session management compatibility.

## Affected Apps/Packages

- `packages/db` (schema definition)
- `packages/auth` (BetterAuth integration)
- `apps/api` (user endpoints)
- `apps/web-learner` (user profile display)
- `apps/web-mentor` (mentor profiles)
- `apps/web-admin` (user management)

## Requirements

### Users Table

Create table `users` with the following columns:

| Column                | Type           | Constraints                               | Description                                                             |
| --------------------- | -------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| `id`                  | `UUID`         | PK, Default: `uuid_v7()`                  | Unique user identifier                                                  |
| `email`               | `VARCHAR(255)` | UNIQUE, NOT NULL                          | User email address                                                      |
| `email_verified_at`   | `TIMESTAMP`    | NULL                                      | When email was verified (BetterAuth field)                              |
| `password_hash`       | `VARCHAR(255)` | NULL                                      | Hashed password (nullable for OAuth users)                              |
| `name`                | `VARCHAR(255)` | NOT NULL                                  | User's full name                                                        |
| `photo_url`           | `TEXT`         | NULL                                      | URL to user's profile photo (stored in R2)                              |
| `bio`                 | `TEXT`         | NULL                                      | User biography/about section (max 500 chars)                            |
| `language_preference` | `VARCHAR(10)`  | DEFAULT: 'en'                             | ISO 639-1 language code                                                 |
| `role`                | `VARCHAR(50)`  | NOT NULL, DEFAULT: 'learner'              | Enum: learner, mentor, team_member, super_admin                         |
| `status`              | `VARCHAR(50)`  | NOT NULL, DEFAULT: 'pending_verification' | Enum: active, suspended, banned, pending_deletion, pending_verification |
| `created_at`          | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()`                | Account creation timestamp                                              |
| `updated_at`          | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()`                | Last profile update timestamp                                           |

### Indexes for Users Table

- Primary Key: `id`
- Unique Index: `(email)` - for login lookups
- Index: `(role)` - for RBAC queries
- Index: `(status)` - for filtering active users
- Index: `(created_at)` - for analytics and reporting

### User Profiles Table

Create table `user_profiles` with the following columns:

| Column                    | Type           | Constraints                      | Description                                                                  |
| ------------------------- | -------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| `id`                      | `UUID`         | PK, Default: `uuid_v7()`         | Unique profile identifier                                                    |
| `user_id`                 | `UUID`         | FK → users(id), NOT NULL, UNIQUE | Link to user account                                                         |
| `interests`               | `TEXT[]`       | DEFAULT: ARRAY[]::TEXT[]         | Array of topic interests                                                     |
| `role_selection`          | `VARCHAR(50)`  | NOT NULL                         | Enum: Student, Business_Owner, Freelancer, Employee, Educator_Trainer, Other |
| `experience_level`        | `VARCHAR(50)`  | DEFAULT: 'beginner'              | Enum: beginner, intermediate, advanced, expert                               |
| `company_name`            | `VARCHAR(255)` | NULL                             | Company name if applicable                                                   |
| `job_title`               | `VARCHAR(255)` | NULL                             | Job title if applicable                                                      |
| `phone_number`            | `VARCHAR(20)`  | NULL                             | User's phone number (E.164 format)                                           |
| `location`                | `VARCHAR(255)` | NULL                             | Geographic location                                                          |
| `timezone`                | `VARCHAR(50)`  | DEFAULT: 'UTC'                   | IANA timezone identifier                                                     |
| `onboarding_completed`    | `BOOLEAN`      | DEFAULT: FALSE                   | Whether onboarding flow finished                                             |
| `onboarding_completed_at` | `TIMESTAMP`    | NULL                             | When onboarding was completed                                                |
| `preferences_json`        | `JSONB`        | DEFAULT: '{}'                    | User preferences (notifications, theme, etc.)                                |
| `created_at`              | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()`       | Profile creation timestamp                                                   |
| `updated_at`              | `TIMESTAMP`    | NOT NULL, DEFAULT: `now()`       | Last update timestamp                                                        |

### Indexes for User Profiles Table

- Primary Key: `id`
- Unique Index: `(user_id)` - for 1:1 relationship
- Index: `(role_selection)` - for analytics
- Index: `(onboarding_completed)` - for onboarding funnels
- Index: `(experience_level)` - for recommendation engine

### Constraints

- Foreign Key: `user_profiles(user_id)` → `users(id)` ON DELETE CASCADE
- Check constraint: `email` must match email regex pattern
- Check constraint: `language_preference` must be valid ISO 639-1 code
- Check constraint: `timezone` must be valid IANA timezone

### BetterAuth Integration Fields

The `users` table must include these fields for BetterAuth compatibility:

- `id` (UUID as per BetterAuth PostgreSQL docs)
- `email` (unique email for authentication)
- `email_verified_at` (timestamp for email verification status)
- `password_hash` (for password-based auth, nullable for OAuth-only users)
- `created_at` (account creation tracking)

### Enums Definition

Create PostgreSQL ENUM types:

```sql
CREATE TYPE user_role AS ENUM ('learner', 'mentor', 'team_member', 'super_admin');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'banned', 'pending_deletion', 'pending_verification');
CREATE TYPE role_selection AS ENUM ('Student', 'Business_Owner', 'Freelancer', 'Employee', 'Educator_Trainer', 'Other');
CREATE TYPE experience_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');
```

### Drizzle Schema Definition

In `packages/db/src/schema/users.ts`:

- Use `pgEnum` for all ENUM types
- Define `users` table with all columns and constraints
- Define `userProfiles` table with foreign key relation
- Use `relations()` function to define bi-directional user ↔ profile relationship
- Export both table definitions and relations

## Database Tables

### users

- **Purpose**: Core authentication and identity table
- **Row estimate**: ~1M rows for production
- **Partitioning strategy**: Consider hash partitioning by `id` at 100M+ rows
- **Key relationships**: 1:1 with user_profiles, 1:N with user_roles, 1:N with accounts (BetterAuth)

### user_profiles

- **Purpose**: Extended profile information and preferences
- **Row estimate**: ~1M rows (1:1 with users)
- **Key relationships**: 1:1 with users

## Acceptance Criteria

- [ ] `users` table created with all required columns
- [ ] `user_profiles` table created with all required columns
- [ ] All column types match specification exactly
- [ ] UUID default using `uuid_v7()` or compatible function
- [ ] Foreign key constraint enforces referential integrity
- [ ] All indexes created for performance optimization
- [ ] PostgreSQL ENUM types created in database
- [ ] Unique constraint on `users.email` prevents duplicates
- [ ] Check constraints enforce email format validation
- [ ] `onboarding_completed` flag properly tracks profile setup state
- [ ] Timestamp columns use UTC timezone (`NOW()` at UTC)
- [ ] `interests` array can store up to 50 tags
- [ ] `preferences_json` JSONB column supports nested structures
- [ ] Tables can be queried with Drizzle ORM without errors
- [ ] Migration file generated and runnable
- [ ] Test data can be inserted for both learner and mentor roles

## Dependencies

- Task 01: Drizzle ORM Setup and Configuration (must be completed)
- BetterAuth table structure understanding
- PostgreSQL 16+ knowledge for ENUM types

## Technical Notes

### UUID Strategy

- Use `uuid_v7()` for sequential UUID generation (better for index performance)
- If uuid_v7 not available in PostgreSQL, use `gen_random_uuid()` with `uuid-ossp` extension
- Consider performance impact on large inserts with random UUIDs

### Email Validation

- Use PostgreSQL CHECK constraint with regex pattern for email validation
- Pattern: `email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$'`
- Application layer should also validate emails before database insert

### Password Hashing

- `password_hash` should store bcrypt or Argon2 hashes (never plaintext)
- BetterAuth handles hashing; never hash at application layer
- Nullable for OAuth-only users who don't set a password

### Photo Storage

- `photo_url` stores R2 (Cloudflare) URLs, not local storage
- Format: `https://r2-bucket.example.com/users/{user_id}/photo.{ext}`
- Implement soft deletes for photos (just update URL to NULL)

### Bio Field

- Limit to 500 characters maximum (enforce in application)
- Support markdown formatting (store as plain text, parse in frontend)
- Sanitize for XSS prevention before display

### Timezone and Language Preferences

- Language follows ISO 639-1 (en, fr, es, etc.)
- Timezone uses IANA database identifiers (America/New_York, Europe/London, etc.)
- Store in lowercase for consistency

### JSONB Preferences Column

Example structure for `preferences_json`:

```json
{
  "notifications": {
    "email_digest": "weekly",
    "push_enabled": true
  },
  "ui": {
    "theme": "dark",
    "compact_mode": false
  },
  "privacy": {
    "profile_public": false
  }
}
```

### Onboarding Flow

- `onboarding_completed` is FALSE by default
- Set to TRUE only when user completes full onboarding
- `onboarding_completed_at` captures exact timestamp for analytics
- Used to gate access to certain features until completion

### BetterAuth Account Table (Separate Task)

- This users table must coexist with BetterAuth's `accounts` table
- See Task 03: Auth Sessions Tables for relationship mapping
- Do not add OAuth provider fields to this users table; that's in accounts table

### Migration Ordering

- Create ENUM types first (in migration)
- Create users table second
- Create user_profiles table third (depends on users)
- Add indexes last

### Testing Considerations

- Test unique constraint on email with duplicate insertion attempt
- Test foreign key cascade delete (deleting user should delete profile)
- Test timestamp auto-update on profile modifications
- Test array operations on interests field
- Test JSONB queries for nested preference access
- Test default values for all columns

### Query Performance Notes

- Index on `(status, created_at)` useful for pagination of active users
- Index on `(role)` critical for RBAC permission checks
- Consider statistics updates on large datasets: `ANALYZE users;`
- JSONB column searchable but slower than dedicated columns; use JSONB for extensibility only
