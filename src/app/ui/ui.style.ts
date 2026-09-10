import {
  bg,
  borderColor,
  borderStyle,
  borderWidth,
  color,
  craftStyles,
  cssVars,
  darkOf,
  defineStateAxis,
  definePalette,
  display,
  kind,
  lineWidth,
  num,
  p,
  radii,
  radius,
  set,
  space,
  unit,
  when,
} from '@craft-ts/style';

// ─── palette ────────────────────────────────────────────────────────────────
// Every token carries both of its values; the group it sits in gives it a role.

export const ui = definePalette({
  surface: {
    page: { light: '#fbfaff', dark: '#100b1b' },
    raised: { light: '#ffffff', dark: '#1b1228' },
  },
  text: {
    strong: { light: '#211632', dark: '#f8f5ff' },
    muted: { light: '#6d627f', dark: '#bab2eb' },
  },
  border: {
    subtle: { light: '#e8dff4', dark: '#3b2b52' },
  },
  accent: {
    info: { light: '#5c44e4', dark: '#bab2eb' },
    danger: { light: '#c91558', dark: '#ff8ab6' },
  },
});

// ─── axes ───────────────────────────────────────────────────────────────────
// A component may only vary along an axis declared here. The point carries the
// driver that reaches it, so a state the matrix enumerates is a state a test
// can produce.

/** Drives `data-tone` on the element that carries it. */
export const tone = defineStateAxis('tone', ['neutral', 'danger']);

// ─── theme ──────────────────────────────────────────────────────────────────

/**
 * `inherits: true` belongs to theme variables and to nothing else: they are
 * set once on a wrapper and read by everything below. The default, `false`,
 * is right for a variable an element both sets and reads on itself.
 */
const themed = { inherits: true } as const;

export const theme = cssVars('app', {
  ink: kind.color(ui.text.strong, themed),
  inkMuted: kind.color(ui.text.muted, themed),
  raised: kind.color(ui.surface.raised, themed),
  border: kind.color(ui.border.subtle, themed),
  accent: kind.color(ui.accent.info, themed),
});

/** Dark mode is one rule, here — not one rule per component. */
export const appTheme = craftStyles('appTheme', {
  root: [
    // The application is intentionally dark-first: presentations, editor and
    // dashboard share the same dark surface even when the OS uses light mode.
    set(theme.ink, darkOf(ui.text.strong)),
    set(theme.inkMuted, darkOf(ui.text.muted)),
    set(theme.raised, darkOf(ui.surface.raised)),
    set(theme.border, darkOf(ui.border.subtle)),
    set(theme.accent, darkOf(ui.accent.info)),
  ],
});

// ─── classes ────────────────────────────────────────────────────────────────
// A component reads theme variables, never palette tokens: that indirection is
// what keeps dark mode above, in one place.

export const surface = craftStyles('appSurface', {
  card: [
    display.block,
    p(space(5)),
    bg(theme.raised),
    color(theme.ink),
    borderWidth(lineWidth.hairline),
    borderStyle.solid,
    borderColor(theme.border),
    radius(radii.md),
  ],
  note: [color(theme.inkMuted)],
  /**
   * One class, two states. The template sets `data-tone`; nothing here
   * produces a name a template has to assemble.
   */
  message: [
    color(theme.accent),
    when(tone.danger, [set(theme.accent, ui.accent.danger)]),
  ],
});

export const presentationProgressVars = cssVars('presentationProgress', {
  value: kind.percentage(unit.pct(0)),
});

export const presentationSlideVars = cssVars('presentationSlide', {
  phase: kind.number(num(0)),
});

export const presentationGradientVars = cssVars('presentationGradient', {
  start: kind.color(ui.surface.page, themed),
  middle: kind.color(ui.surface.raised, themed),
  end: kind.color(ui.accent.info, themed),
  angle: kind.angle(unit.deg(135), themed),
});
