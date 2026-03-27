Here's everything you need to replicate the infrastructure (no templates):

---

File Structure

packages/email/  
 ├── package.json  
 └── src/  
 ├── index.ts # Public exports  
 ├── client.ts # Transport factory (Postmark / SMTP)
├── constants.ts # Sender name + email  
 ├── send.ts # sendEmail() entry point  
 ├── render.ts # renderEmail() — React Email → HTML/text  
 ├── types.ts # EmailTemplateMap, SendEmailOptions, EmailStrings  
 ├── i18n/  
 │ ├── index.ts # Static imports + getStrings() lookup  
 │ ├── en/<template>.json  
 │ ├── es/<template>.json  
 │ ├── fr/<template>.json  
 │ └── ru/<template>.json  
 └── templates/ # (skipped)

---

package.json — Dependencies

{
"type": "module",
"exports": {  
 ".": { "default": "./src/index.ts" },
"./_": { "default": "./src/_.ts" }  
 },  
 "dependencies": {  
 "@react-email/components": "^0.0.36",
"@react-email/render": "^1.0.6",  
 "nodemailer": "^6.10.1",
"postmark": "^4.0.5"  
 },
"devDependencies": {  
 "@types/nodemailer": "^6.4.17",
"@types/react": "...",
"react": "...",  
 "react-dom": "..."
}  
 }

---

src/client.ts — Transport Factory

import nodemailer from "nodemailer";
import { ServerClient } from "postmark";

export interface EmailTransport {
send(options: {  
 from: string;
to: string;
subject: string;  
 html: string;
text: string;  
 }): Promise<void>;
}

function createPostmarkTransport(token: string): EmailTransport {  
 const client = new ServerClient(token);
return {  
 async send({ from, to, subject, html, text }) {
await client.sendEmail({ From: from, To: to, Subject: subject, HtmlBody: html, TextBody: text });  
 },
};  
 }

function createSmtpTransport(): EmailTransport {
const transporter = nodemailer.createTransport({
host: process.env.SMTP_HOST ?? "localhost",
port: Number(process.env.SMTP_PORT ?? 1025),  
 secure: false,
});  
 return {  
 async send({ from, to, subject, html, text }) {  
 await transporter.sendMail({ from, to, subject, html, text });
},  
 };
}

let transport: EmailTransport | undefined;

export function getTransport(): EmailTransport {
if (transport) return transport;
transport = process.env.POSTMARK_API_TOKEN  
 ? createPostmarkTransport(process.env.POSTMARK_API_TOKEN)
: createSmtpTransport();  
 return transport;
}

---

src/constants.ts

export const SENDER_EMAIL = process.env.SENDER_EMAIL ?? "noreply@localhost";
export const SENDER_NAME = "YourAppName";  
 export const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@localhost";

---

src/types.ts — Core Types

export type EmailTemplateMap = {
"verification": { userName: string; verificationUrl: string };  
 "password-reset": { userName: string; resetUrl: string };  
 // add your templates here...  
 };

export type EmailTemplate = keyof EmailTemplateMap;

export type SendEmailOptions<T extends EmailTemplate> = {  
 to: string;
template: T;  
 locale?: string; // your SupportedLocale type
data: EmailTemplateMap[T];  
 };

export type EmailStrings = {
subject: string;
heading: string;  
 greeting: string;
body: string;  
 buttonText: string;
fallbackText?: string;
expiryNote?: string;
[key: string]: string | Record<string, string> | undefined;
};

export type RenderedEmail = { html: string; text: string; subject: string };

---

src/render.ts — Renderer

import { render } from "@react-email/render";
import \* as React from "react";  
 import { getStrings } from "./i18n/index";
import type { EmailTemplate, EmailTemplateMap, RenderedEmail } from "./types";

function interpolateSubject(subject: string, data: EmailTemplateMap[EmailTemplate]): string {  
 return subject.replace(/\{(\w+)\}/g, (match, key) => {
const value = (data as Record<string, unknown>)[key];  
 return typeof value === "string" ? value : match;
});  
 }

export async function renderEmail<T extends EmailTemplate>(
template: T,
locale: string,
data: EmailTemplateMap[T]
): Promise<RenderedEmail> {  
 const strings = await getStrings(template, locale);
const element = createTemplateElement(template, data, strings);  
 const [html, text] = await Promise.all([
render(element),
render(element, { plainText: true }),
]);  
 return { html, text, subject: interpolateSubject(strings.subject, data) };
}

function createTemplateElement(template, data, strings): React.ReactElement {  
 switch (template) {
case "verification": {  
 // return React.createElement(YourComponent, { ...data, strings });
}  
 // add cases per template
default:  
 throw new Error(`Unknown email template: ${template}`);
}  
 }

---

src/send.ts — Public API

import { getTransport } from "./client";
import { SENDER_EMAIL, SENDER_NAME } from "./constants";
import { renderEmail } from "./render";
import type { EmailTemplate, SendEmailOptions } from "./types";

export async function sendEmail<T extends EmailTemplate>(  
 options: SendEmailOptions<T>
): Promise<void> {  
 const { to, template, data, locale = "en" } = options;
const { html, text, subject } = await renderEmail(template, locale, data);  
 const transport = getTransport();
try {  
 await transport.send({ from: `${SENDER_NAME} <${SENDER_EMAIL}>`, to, subject, html, text });  
 console.log(`[email] ${template} → ${to} (${locale}) sent`);
} catch (error) {  
 const message = error instanceof Error ? error.message : String(error);
console.error(`[email] ${template} → ${to} (${locale}) failed: ${message}`);  
 throw error;  
 }
}

---

src/i18n/index.ts — String Lookup

import type { EmailStrings, EmailTemplate } from "../types";
import enVerification from "./en/verification.json" with { type: "json" };  
 // ... all other static imports per locale per template

const stringsMap: Record<string, Record<EmailTemplate, EmailStrings>> = {  
 en: { verification: enVerification, /_ ... _/ },  
 // es, fr, ru...  
 };

export async function getStrings(template: EmailTemplate, locale: string = "en"): Promise<EmailStrings> {  
 return stringsMap[locale]?.[template] ?? stringsMap["en"][template];
}

---

i18n JSON shape (per template)

{
"subject": "Verify your email address",  
 "heading": "Verify your email",
"greeting": "Hi {userName},",
"body": "Please verify your email to get started.",  
 "buttonText": "Verify Email Address",
"fallbackText": "Or copy this link:",  
 "expiryNote": "This link expires in 24 hours."  
 }

Note: {userName} placeholders in subject are interpolated at render time — other fields are passed as-is to the template component.

---

Env Vars Required

┌────────────────────┬─────────────────────────────────────────────┐
│ Var │ Purpose │  
 ├────────────────────┼─────────────────────────────────────────────┤
│ POSTMARK_API_TOKEN │ If set → uses Postmark; if absent → SMTP │  
 ├────────────────────┼─────────────────────────────────────────────┤
│ SMTP_HOST │ SMTP host (default localhost) │  
 ├────────────────────┼─────────────────────────────────────────────┤  
 │ SMTP_PORT │ SMTP port (default 1025) │  
 ├────────────────────┼─────────────────────────────────────────────┤  
 │ SENDER_EMAIL │ From address (default noreply@localhost) │
├────────────────────┼─────────────────────────────────────────────┤
│ SUPPORT_EMAIL │ Support address (default support@localhost) │
└────────────────────┴─────────────────────────────────────────────┘

For local dev, run Mailpit (Docker) on port 1025 (SMTP) + 8025 (web UI) to catch all outgoing mail without sending real emails.

---

src/index.ts — Exports

export { sendEmail } from "./send";
export type { EmailStrings, EmailTemplate, EmailTemplateMap, RenderedEmail, SendEmailOptions } from "./types";

Critical gotcha: Every template .tsx file must start with /\*_ @jsxImportSource react _/ — otherwise the bundler may apply a different JSX  
 runtime (e.g., Hono's) and @react-email/render will produce empty HTML.
