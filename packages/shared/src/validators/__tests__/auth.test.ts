import { describe, expect, it } from 'vitest';

import { forgotPasswordSchema, resetPasswordSchema } from '../auth.js';

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
    token: '550e8400-e29b-41d4-a716-446655440000',
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
