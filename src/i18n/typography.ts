export const typography = {
  family: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fallback: 'system-ui, sans-serif',
  roles: {
    heading: { fontSize: '2rem', lineHeight: '1.2', fontWeight: 700 },
    body: { fontSize: '1rem', lineHeight: '1.5', fontWeight: 400 },
    label: { fontSize: '.875rem', lineHeight: '1.35', fontWeight: 600 },
    button: { fontSize: '.9375rem', lineHeight: '1.35', fontWeight: 600 },
    caption: { fontSize: '.75rem', lineHeight: '1.35', fontWeight: 400 },
  },
} as const;

export type TypographyRole = keyof typeof typography.roles;
