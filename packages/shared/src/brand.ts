/**
 * CeolX brand colour constants for non-Tailwind contexts (e.g. React Native inline styles).
 * These mirror the CSS custom properties defined in packages/ui/src/styles/globals.css.
 */
export const brand = {
  colors: {
    // Primary — Blue (#662FFF, 10-step opacity scale)
    blue1: 'rgba(102, 47, 255, 0.1)',
    blue2: 'rgba(102, 47, 255, 0.2)',
    blue3: 'rgba(102, 47, 255, 0.3)',
    blue4: 'rgba(102, 47, 255, 0.4)',
    blue5: 'rgba(102, 47, 255, 0.5)',
    blue6: 'rgba(102, 47, 255, 0.6)',
    blue7: 'rgba(102, 47, 255, 0.7)',
    blue8: 'rgba(102, 47, 255, 0.8)',
    blue9: 'rgba(102, 47, 255, 0.9)',
    blue10: '#662FFF',

    // Secondary — Green (#C8FF2F, 10-step opacity scale)
    green1: 'rgba(200, 255, 47, 0.1)',
    green2: 'rgba(200, 255, 47, 0.2)',
    green3: 'rgba(200, 255, 47, 0.3)',
    green4: 'rgba(200, 255, 47, 0.4)',
    green5: 'rgba(200, 255, 47, 0.5)',
    green6: 'rgba(200, 255, 47, 0.6)',
    green7: 'rgba(200, 255, 47, 0.7)',
    green8: 'rgba(200, 255, 47, 0.8)',
    green9: 'rgba(200, 255, 47, 0.9)',
    green10: '#C8FF2F',

    // Tertiary — Gray (explicit hex per step)
    gray1: '#F4F4F4',
    gray2: '#E8E8E8',
    gray3: '#DDDDDD',
    gray4: '#D1D1D1',
    gray5: '#C6C6C6',
    gray6: '#BBBBBB',
    gray7: '#AFAFAF',
    gray8: '#A4A4A4',
    gray9: '#989898',
    gray10: '#8D8D8D',

    // Surface
    surface: '#363636',
    surfaceDark: '#080808',
    white: '#FFFFFF',

    // Semantic
    error: '#EF4444',
    warning: '#F59E0B',
    success: '#C8FF2F',
    info: '#662FFF',
  },
} as const;
