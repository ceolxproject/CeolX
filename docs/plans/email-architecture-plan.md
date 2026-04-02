---                                                                                                                                            
  Email System — Templates + sendEmail                                                                                                           
                                                                                                                                                 
  Architecture                                                                                                                                   
                                                                                                                                                 
  sendEmail({ to, template, data, locale })                                                                                                   
    → renderEmail(template, locale, data)                                                                                                        
        → getStrings(template, locale)        ← static JSON imports per locale                                                                   
        → createTemplateElement(...)          ← switch, React.createElement                                                                      
        → @react-email/render(element)        ← { html, text, subject }                                                                          
    → transport.send({ from, to, subject, html, text })                                                                                          
                                                                                                                                                 
  ---                                                                                                                                            
  Package dependencies                                                                                                                           
                                                                                                                                              
  "@react-email/components": "...",
  "@react-email/render": "..."                                                                                                                   
                                                                                                                                                 
  ---                                                                                                                                            
  File structure to create                                                                                                                       
                                                                                                                                              
  src/email/
    types.ts              ← EmailTemplateMap, SendEmailOptions, EmailStrings                                                                     
    send.ts               ← sendEmail() — the only public export                                                                                 
    render.ts             ← renderEmail() + createTemplateElement() switch                                                                       
    client.ts             ← getTransport() — cached, Postmark or SMTP                                                                            
    constants.ts          ← SENDER_EMAIL, SENDER_NAME                                                                                            
    templates/                                                                                                                                   
      components/                                                                                                                                
        email-layout.tsx  ← shared Html/Head/Body/Footer wrapper                                                                                 
        ui.tsx            ← colors, fonts, shared styled primitives (EmailButton etc.)                                                           
      verification.tsx                                                                                                                           
      password-reset.tsx                                                                                                                         
      email-change-confirmation.tsx                                                                                                              
      account-lockout.tsx                                                                                                                        
      # one file per template                                                                                                                    
                                                                                                                                                 
  ---                                                                                                                                         
  types.ts

  export type EmailTemplateMap = {
    verification: { userName: string; verificationUrl: string };                                                                                 
    "password-reset": { userName: string; resetUrl: string };                                                                                    
    "email-change-confirmation": { userName: string; newEmail: string; confirmUrl: string };                                                     
    // add more templates as needed                                                                                                              
  };                                                                                                                                             
                                                                                                                                                 
  export type EmailTemplate = keyof EmailTemplateMap;                                                                                         

  export type SendEmailOptions<T extends EmailTemplate> = {
    to: string;
    template: T;
    locale?: string;          // e.g. "en" | "es" — falls back to "en"
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
                                                                                                                                                 
  ---                                                                                                                                         
  send.ts — minimal, just like this                                                                                                              
                                                                                                                                                 
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
                                                                                                                                                 
    await transport.send({                                                                                                                       
      from: `${SENDER_NAME} <${SENDER_EMAIL}>`,                                                                                                  
      to,                                                                                                                                     
      subject,
      html,
      text,
    });
  }
                                                                                                                                                 
  ---                                                                                                                                            
  render.ts                                                                                                                                      
                                                                                                                                                 
  import { render } from "@react-email/render";                                                                                               
  import * as React from "react";
                                                                                                                                                 
  import { getStrings } from "./i18n/index";                                                                                                     
  import { VerificationEmail } from "./templates/verification";                                                                                  
  import { PasswordResetEmail } from "./templates/password-reset";                                                                               
  // ... import all template components                                                                                                          
  import type { EmailTemplate, EmailTemplateMap, RenderedEmail } from "./types";                                                                 
                                                                                                                                                 
  export async function renderEmail<T extends EmailTemplate>(                                                                                    
    template: T,                                                                                                                                 
    locale: string,                                                                                                                           
    data: EmailTemplateMap[T]
  ): Promise<{ html: string; text: string; subject: string }> {                                                                                  
    const strings = await getStrings(template, locale);                                                                                          
    const element = createTemplateElement(template, data, strings);                                                                              
                                                                                                                                                 
    const [html, text] = await Promise.all([                                                                                                     
      render(element),                                                                                                                           
      render(element, { plainText: true }),                                                                                                      
    ]);                                                                                                                                          
                                                                                                                                                 
    const subject = strings.subject.replace(/\{(\w+)\}/g, (match, key) => {                                                                      
      const value = (data as Record<string, unknown>)[key];                                                                                      
      return typeof value === "string" ? value : match;                                                                                          
    });                                                                                                                                          
                                                                                                                                                 
    return { html, text, subject };                                                                                                           
  }

  function createTemplateElement(
    template: EmailTemplate,
    data: EmailTemplateMap[EmailTemplate],                                                                                                       
    strings: Awaited<ReturnType<typeof getStrings>>                                                                                              
  ): React.ReactElement {                                                                                                                        
    switch (template) {                                                                                                                          
      case "verification": {                                                                                                                  
        const d = data as EmailTemplateMap["verification"];                                                                                      
        return React.createElement(VerificationEmail, { ...d, strings });                                                                        
      }                                                                                                                                          
      case "password-reset": {                                                                                                                   
        const d = data as EmailTemplateMap["password-reset"];                                                                                    
        return React.createElement(PasswordResetEmail, { ...d, strings });                                                                       
      }                                                                                                                                          
      // one case per template                                                                                                                   
      default: {                                                                                                                              
        const _exhaustive: never = template;                                                                                                     
        throw new Error(`Unknown email template: ${_exhaustive}`);                                                                               
      }                                                                                                                                          
    }                                                                                                                                            
  }                                                                                                                                           
                                                                                                                 
                                                                                                                                                 
  ---                                                                                                                                         
  Template component pattern
                            
  CRITICAL: Every .tsx file in templates/ (including components/) MUST start with /** @jsxImportSource react */ as the very first line. Without  
  it, bundlers (tsdown/esbuild) apply the wrong JSX runtime (e.g. Hono's) and @react-email/render produces empty HTML.                           
                                                                                                                                                 
  /** @jsxImportSource react */                                                                                                                  
  import { Section, Text } from "@react-email/components";                                                                                       
  import * as React from "react";                                                                                                                
  import type { EmailStrings } from "../types";                                                                                                  
  import { EmailLayout } from "./components/email-layout";                                                                                       
                                                                                                                                                 
  interface VerificationEmailProps {                                                                                                             
    userName: string;                                                                                                                            
    verificationUrl: string;                                                                                                                     
    strings: EmailStrings;  // always injected by render.ts, never imported directly                                                             
  }                                                                                                                                              
                                                                                                                                                 
  export function VerificationEmail({ userName, verificationUrl, strings }: VerificationEmailProps) {                                            
    return (                                                                                                                                  
      <EmailLayout preview={strings.subject}>
        <Text>{strings.heading}</Text>                                                                                                           
        <Text>{strings.greeting.replace("{userName}", userName)}</Text>                                                                          
        <Text>{strings.body}</Text>                                                                                                              
        {/* CTA button, fallback URL, expiry note */}                                                                                            
      </EmailLayout>                                                                                                                             
    );                                                                                                                                           
  }                                                                                                                                              
                                                                                                                                                 
  Templates receive strings as a prop — they never import i18n themselves.                                                                       
                                                                                                                                                 
  ---                                                                                                                                            
  Better Auth integration                                                                                                                     

  import { sendEmail } from "@yourscope/email";                                                                                                  
                                                                                                                                                 
  function getUserLocale(user: Record<string, unknown>): string {                                                                                
    return (user["languagePreference"] as string | undefined) ?? "en";                                                                           
  }                                                                                                                                              
                                                                                                                                                 
  betterAuth({                                                                                                                                   
    emailVerification: {                                                                                                                      
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          template: "verification",
          locale: getUserLocale(user as Record<string, unknown>),                                                                                
          data: { userName: user.name, verificationUrl: url },                                                                                   
        });                                                                                                                                      
      },                                                                                                                                         
    },                                                                                                                                        
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: async ({ user, url }) => {                                                                                              
        await sendEmail({                                                                                                                        
          to: user.email,                                                                                                                        
          template: "password-reset",                                                                                                            
          locale: getUserLocale(user as Record<string, unknown>),                                                                             
          data: { userName: user.name, resetUrl: url },
        });                                                                                                                                      
      },                                                                                                                                         
    },                                                                                                                                           
    user: {                                                                                                                                      
      changeEmail: {                                                                                                                          
        enabled: true,
        sendChangeEmailConfirmation: async ({ user, newEmail, url }) => {
          await sendEmail({
            to: user.email,
            template: "email-change-confirmation",                                                                                               
            locale: getUserLocale(user as Record<string, unknown>),                                                                              
            data: { userName: user.name, newEmail, confirmUrl: url },                                                                            
          });                                                                                                                                    
        },                                                                                                                                    
      },
    },
  });

  ---
  Checklist for adding a new template                                                                                                            
                                                                                                                                                 
  1. Add key + data shape to EmailTemplateMap in types.ts                                                                                        
  2. Create templates/<name>.tsx — first line: /** @jsxImportSource react */                                                                     
  3. Add i18n/en/<name>.json (and any other locales)                                                                                             
  4. Add static imports + map entry in i18n/index.ts                                                                                             
  5. Add case "<name>": in createTemplateElement() in render.ts                                                                                  
  6. Call sendEmail({ template: "<name>", data: { ... } }) where needed 