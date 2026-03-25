// Role values mirror the `user_role` pg enum in packages/db/src/schema/enums.ts.
// Keep these in sync if the enum changes.
export type UserRole = "spectator" | "artist" | "venue" | "super_admin";

export interface User {
  userId: string;
  currentRole: UserRole;
  email: string;
  emailVerified: boolean;
}
