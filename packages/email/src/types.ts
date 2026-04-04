export type EmailTemplateMap = {
  verification: { userName: string; verificationUrl: string };
  'password-reset': { userName: string; resetUrl: string };
};

export type EmailTemplate = keyof EmailTemplateMap;

export interface SendEmailOptions<T extends EmailTemplate> {
  to: string;
  template: T;
  data: EmailTemplateMap[T];
}
