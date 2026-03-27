import nodemailer from 'nodemailer';
import { ServerClient } from 'postmark';

export interface EmailTransport {
  send(options: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<void>;
}

function createSmtpTransport(): EmailTransport {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? 'localhost',
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
  });
  return {
    async send({ from, to, subject, html, text }) {
      await transporter.sendMail({ from, to, subject, html, text });
    },
  };
}

function createPostmarkTransport(token: string): EmailTransport {
  const client = new ServerClient(token);
  return {
    async send({ from, to, subject, html, text }) {
      await client.sendEmail({
        From: from,
        To: to,
        Subject: subject,
        HtmlBody: html,
        TextBody: text,
        MessageStream: 'outbound',
      });
    },
  };
}

let transport: EmailTransport | undefined;

export function getTransport(): EmailTransport {
  if (transport) return transport;
  if (process.env.NODE_ENV === 'development') {
    transport = createSmtpTransport();
  } else {
    const token = process.env.POSTMARK_API_TOKEN;
    if (!token) {
      throw new Error('POSTMARK_API_TOKEN is required in non-development environments');
    }
    transport = createPostmarkTransport(token);
  }
  return transport;
}
