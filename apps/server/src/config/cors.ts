const DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8081', // Expo dev client
  'http://localhost:19006', // Expo web
] as const;

export function buildAllowedOrigins(): string[] {
  const envOrigins = process.env['CORS_ALLOWED_ORIGINS'] ?? '';
  const configured = envOrigins
    .split('|')
    .map((o) => o.trim())
    .filter(Boolean);

  const devOrigins = process.env['NODE_ENV'] === 'development' ? [...DEV_ORIGINS] : [];

  return [...new Set([...configured, ...devOrigins])];
}

export function isAllowedOrigin(origin: string): boolean {
  return buildAllowedOrigins().includes(origin);
}
