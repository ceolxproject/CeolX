/** @jsxImportSource react */
import { render } from '@react-email/render';
import * as React from 'react';

import { registry } from './registry.js';
import { subjectFor } from './subjects.js';
import type { EmailTemplate, EmailTemplateMap } from './types.js';

/**
 * Render a transactional email to HTML + plaintext + subject.
 *
 * Dispatch is data-driven through the registry, so adding a template needs
 * only two additions (`registry.ts` + `subjects.ts`) — no switch to extend
 * here.
 */
export async function renderEmail<T extends EmailTemplate>(
  template: T,
  data: EmailTemplateMap[T]
): Promise<{ html: string; text: string; subject: string }> {
  const entry = registry[template];
  if (!entry) {
    throw new Error(`Unknown email template: ${String(template)}`);
  }

  const element = React.createElement(entry.component, data);
  const [html, text] = await Promise.all([render(element), render(element, { plainText: true })]);

  return { html, text, subject: subjectFor(template, data) };
}
