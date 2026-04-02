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
