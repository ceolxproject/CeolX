import { describe, expect, it } from 'vitest';

import { changePasswordSchema, forgotPasswordSchema, resetPasswordSchema } from '../auth.js';

describe('forgotPasswordSchema', () => {
  it('accepts a valid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = forgotPasswordSchema.safeParse({ email: 'not-an-email' });
    expect(result.success).toBe(false);
  });

  it('rejects an empty email', () => {
    const result = forgotPasswordSchema.safeParse({ email: '' });
    expect(result.success).toBe(false);
  });

  it('rejects missing email field', () => {
    const result = forgotPasswordSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  const validInput = {
    token: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    newPassword: 'Secure123!',
    confirmPassword: 'Secure123!',
  };

  it('accepts a valid reset payload', () => {
    const result = resetPasswordSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('rejects password shorter than 8 characters', () => {
    const result = resetPasswordSchema.safeParse({
      ...validInput,
      newPassword: 'Ab1!',
      confirmPassword: 'Ab1!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password without uppercase letter', () => {
    const result = resetPasswordSchema.safeParse({
      ...validInput,
      newPassword: 'secure123!',
      confirmPassword: 'secure123!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password without lowercase letter', () => {
    const result = resetPasswordSchema.safeParse({
      ...validInput,
      newPassword: 'SECURE123!',
      confirmPassword: 'SECURE123!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password without a number', () => {
    const result = resetPasswordSchema.safeParse({
      ...validInput,
      newPassword: 'SecurePass!',
      confirmPassword: 'SecurePass!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password without a special character', () => {
    const result = resetPasswordSchema.safeParse({
      ...validInput,
      newPassword: 'Secure1234',
      confirmPassword: 'Secure1234',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when passwords do not match', () => {
    const result = resetPasswordSchema.safeParse({
      ...validInput,
      confirmPassword: 'Different123!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing token', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { token: _token, ...noToken } = validInput;
    const result = resetPasswordSchema.safeParse(noToken);
    expect(result.success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  const validInput = {
    currentPassword: 'OldPass123!',
    newPassword: 'Secure123!',
    confirmPassword: 'Secure123!',
  };

  it('accepts a valid change payload', () => {
    expect(changePasswordSchema.safeParse(validInput).success).toBe(true);
  });

  it('rejects an empty current password', () => {
    const result = changePasswordSchema.safeParse({ ...validInput, currentPassword: '' });
    expect(result.success).toBe(false);
  });

  it('enforces new-password strength (e.g. needs a special character)', () => {
    const result = changePasswordSchema.safeParse({
      ...validInput,
      newPassword: 'Secure1234',
      confirmPassword: 'Secure1234',
    });
    expect(result.success).toBe(false);
  });

  it('rejects when confirmation does not match', () => {
    const result = changePasswordSchema.safeParse({ ...validInput, confirmPassword: 'Other123!' });
    expect(result.success).toBe(false);
  });

  it('rejects when the new password equals the current one', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'Secure123!',
      newPassword: 'Secure123!',
      confirmPassword: 'Secure123!',
    });
    expect(result.success).toBe(false);
  });
});
