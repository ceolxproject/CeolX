import { getTransport } from '@CeolX/email';

const target = process.env.TEST_EMAIL_TO ?? 'priya.y@raftlabs.com';
const transport = getTransport();
const env = process.env.APP_ENV || process.env.NODE_ENV;

await transport.send({
  from: 'CeolX Staging <noreply@ceolx.ie>',
  to: target,
  subject: `Magicbox SMTP smoke test — ${new Date().toISOString()}`,
  html: '<h1>Hello from CeolX staging</h1><p>If you can read this, Magicbox SMTP is wired up correctly.</p>',
  text: 'Hello from CeolX staging. Magicbox SMTP is wired up correctly.',
});

console.warn(
  `[test-email] delivered to ${target} via ${env === 'production' ? 'Postmark' : 'SMTP (' + (process.env.SMTP_HOST ?? 'localhost') + ':' + (process.env.SMTP_PORT ?? '1025') + ')'}`
);
