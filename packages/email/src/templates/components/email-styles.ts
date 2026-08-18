import type * as React from 'react';

export const heading: React.CSSProperties = {
  color: '#09090b',
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '32px',
  margin: '0 0 16px',
};

export const bodyText: React.CSSProperties = {
  color: '#3f3f46',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 16px',
};

export const buttonSection: React.CSSProperties = {
  margin: '32px 0',
  textAlign: 'center',
};

export const primaryButton: React.CSSProperties = {
  backgroundColor: '#6741FF',
  borderRadius: '100px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '700',
  letterSpacing: '1px',
  padding: '14px 32px',
  textDecoration: 'none',
  textTransform: 'uppercase',
};

/**
 * Outlined counterpart to `primaryButton`, for a genuine second choice rather
 * than a lesser one — the venue-activation email offers monthly and annual side
 * by side and neither is a fallback.
 *
 * Same geometry as primaryButton so the pair reads as one control group, with an
 * explicit border and background: several email clients strip background colours,
 * and a transparent-background button with no border would collapse into plain
 * text. The 2px border is folded into the padding so both buttons keep an
 * identical outer height.
 */
export const secondaryButton: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '2px solid #6741FF',
  borderRadius: '100px',
  color: '#6741FF',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '700',
  letterSpacing: '1px',
  padding: '12px 30px',
  textDecoration: 'none',
  textTransform: 'uppercase',
};

export const mutedText: React.CSSProperties = {
  color: '#71717a',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0 0 24px',
};

export const fallbackText: React.CSSProperties = {
  color: '#a1a1aa',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
  wordBreak: 'break-all',
};

export const inlineLink: React.CSSProperties = {
  color: '#6741FF',
  textDecoration: 'underline',
};
