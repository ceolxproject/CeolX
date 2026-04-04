import { UAParser } from 'ua-parser-js';

export function parseUserAgent(raw: string | null | undefined): {
  deviceLabel: string;
  browser: string | null;
  os: string | null;
} {
  if (!raw) return { deviceLabel: 'Unknown device', browser: null, os: null };

  const parser = new UAParser(raw);
  const browserName = parser.getBrowser().name ?? null;
  const browserMajor = parser.getBrowser().major ?? null;
  const osName = parser.getOS().name ?? null;
  const osVersion = parser.getOS().version ?? null;

  const browserStr = browserName ? `${browserName}${browserMajor ? ' ' + browserMajor : ''}` : null;
  const osStr = osName ? `${osName}${osVersion ? ' ' + osVersion : ''}` : null;

  const parts = [browserStr, osStr].filter(Boolean);
  const deviceLabel =
    parts.length > 0 ? parts.join(' · ') : (parser.getDevice().model ?? 'Unknown device');

  return { deviceLabel, browser: browserStr, os: osStr };
}
