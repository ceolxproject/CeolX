import { sendEmail } from '@CeolX/email';

await sendEmail({
  to: 'priya.y@raftlabs.com',
  subject: 'Test email',
  htmlBody: '<h1>Hello from CeolX</h1>',
  textBody: 'Hello from CeolX',
  tag: 'email-verification',
});

// eslint-disable-next-line no-console
console.log('Done — check http://localhost:8025');
