// Near-black neutrals plus one swappable accent and a set of named hues for color-coding. Users will be able to pick their accent;
// "coral" is the default. Neutrals stay the same whichever accent is picked.

export type ColorScheme = 'light' | 'dark';

type Neutrals = {
  /** Screen background */
  background: string;
  /** Cards, tab bar, inputs */
  surface: string;
  /** Primary text */
  text: string;
  /** Secondary text, inactive icons, placeholders */
  textMuted: string;
  /** Hairlines, empty progress tracks */
  border: string;
  /** Raised fills on top of `surface` (secondary buttons, unselected chips) and heavier outlines */
  borderStrong: string;
  danger: string;
};

type AccentColors = {
  /** Buttons, active tab, progress */
  accent: string;
  /** Darker partner of `accent`: pressed states and tiny marks on top of `accent` */
  accentEdge: string;
  /** Text and icons placed on top of `accent` */
  onAccent: string;
  /** Tinted backgrounds: chips, progress tracks, selected states */
  accentSoft: string;
  /** Accent-colored text on `accentSoft` or `surface` */
  accentText: string;
  /** Heatmap ramp, from "no study" (0) to "a lot" (4) */
  heat: readonly [string, string, string, string, string];
};

export type Palette = Neutrals & AccentColors;

const neutrals: Record<ColorScheme, Neutrals> = {
  light: {
    background: '#F4F3F1',
    surface: '#FFFFFF',
    text: '#1C1C1E',
    textMuted: '#6E6E73',
    border: '#E6E4E1',
    borderStrong: '#EDEBE8',
    danger: '#D2483D',
  },
  dark: {
    background: '#000000',
    surface: '#121212',
    text: '#F5F5F5',
    textMuted: '#A8A8A8',
    border: '#262626',
    borderStrong: '#262626',
    danger: '#FF8A80',
  },
};

const emptyHeat: Record<ColorScheme, string> = { light: '#ECEAE7', dark: '#262626' };

export const Accents = {
  coral: {
    label: 'Coral',
    light: { accent: '#EE7A70', accentEdge: '#D2605A', onAccent: '#FFFFFF', accentSoft: '#FDE7E4', accentText: '#C9544A', ramp: ['#F9C6C0', '#F5A79E', '#EE7A70', '#C9544A'] },
    dark: { accent: '#F78F86', accentEdge: '#D9736B', onAccent: '#FFFFFF', accentSoft: '#3A2321', accentText: '#F9A39B', ramp: ['#5E3734', '#965550', '#D27770', '#F9A39B'] },
  },
  ink: {
    label: 'Ink',
    light: { accent: '#4A4FD6', accentEdge: '#3237A6', onAccent: '#FFFFFF', accentSoft: '#E6E7FB', accentText: '#3A3EB5', ramp: ['#9DA2F0', '#7A7FE6', '#575CD5', '#3A3EB5'] },
    dark: { accent: '#8B90FF', accentEdge: '#5C61CC', onAccent: '#0F1120', accentSoft: '#25284D', accentText: '#A9ADFF', ramp: ['#3E4396', '#5559BF', '#7378E3', '#A6AAFF'] },
  },
  ember: {
    label: 'Ember',
    light: { accent: '#D64A1C', accentEdge: '#A3350F', onAccent: '#FFFFFF', accentSoft: '#FCE5DA', accentText: '#B23C14', ramp: ['#F2A07E', '#EA7A4C', '#D4592A', '#A3401A'] },
    dark: { accent: '#FF7B4C', accentEdge: '#C4522A', onAccent: '#1A0F0A', accentSoft: '#3D241A', accentText: '#FF9D78', ramp: ['#81402A', '#AC5230', '#D9683A', '#FF9A6E'] },
  },
  moss: {
    label: 'Moss',
    light: { accent: '#0F8A5F', accentEdge: '#0A6243', onAccent: '#FFFFFF', accentSoft: '#DDF2E8', accentText: '#0B6B49', ramp: ['#5FC598', '#33A874', '#178A5B', '#0B6644'] },
    dark: { accent: '#3BC68D', accentEdge: '#248F61', onAccent: '#06201A', accentSoft: '#173A2C', accentText: '#6BDDAE', ramp: ['#1D684B', '#22895D', '#30AE75', '#62DFA7'] },
  },
} as const;

/**
 * Subject colors, in a fixed order validated for colorblind readers (adjacent slots stay distinct under
 * protan/deutan simulation) in both modes. The database stores the light value; `subjectColor` swaps in
 * the dark step, which uses the soft pastel set (cornflower, leaf green, coral...) that sits well on
 * charcoal. Assign in this order; never generate extra hues.
 */
export const SubjectPalette = [
  { light: '#2A78D6', dark: '#5B8FD1' }, // blue
  { light: '#EB6834', dark: '#F2A15E' }, // orange
  { light: '#1BAF7A', dark: '#4FB39A' }, // aqua
  { light: '#EDA100', dark: '#E2BE55' }, // yellow
  { light: '#E87BA4', dark: '#E88AB4' }, // magenta
  { light: '#008300', dark: '#6FB04A' }, // green
  { light: '#6250D6', dark: '#9C8FE3' }, // violet
  { light: '#E34948', dark: '#F78F86' }, // red
] as const;

/**
 * Named hues for color-coding UI that isn't a subject: nav tabs, stat tiles, icons. Same soft tones as the
 * dark subject steps, so everything reads as one palette. Pair with `withAlpha` for tinted backgrounds.
 */
export const Hues = {
  coral: '#F78F86',
  orange: '#F2A15E',
  yellow: '#E2BE55',
  green: '#6FB04A',
  teal: '#4FB39A',
  blue: '#5B8FD1',
  violet: '#9C8FE3',
  pink: '#E88AB4',
} as const;

export type HueName = keyof typeof Hues;

/** `#RRGGBB` plus an opacity from 0 to 1, e.g. a 15% tint of a hue for a selected row. */
export function withAlpha(hex: string, alpha: number) {
  return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
}

/** Glyphs and checkmarks drawn on top of a subject color (timeline pills, play badges). */
export const OnSubject = '#FFFFFF';

export const SubjectColors = SubjectPalette.map((c) => c.light);

/** A stored subject color, adjusted for the current mode. Unknown colors are used as-is. */
export function subjectColor(stored: string | null | undefined, scheme: ColorScheme, fallback: string) {
  if (!stored) return fallback;
  const match = SubjectPalette.find((c) => c.light.toLowerCase() === stored.toLowerCase());
  return match ? match[scheme] : stored;
}

export type AccentName = keyof typeof Accents;
export const DEFAULT_ACCENT: AccentName = 'coral';

export function isAccentName(value: unknown): value is AccentName {
  return typeof value === 'string' && value in Accents;
}

export function buildPalette(scheme: ColorScheme, accentName: AccentName): Palette {
  const { ramp, ...accent } = Accents[accentName][scheme];
  return {
    ...neutrals[scheme],
    ...accent,
    heat: [emptyHeat[scheme], ...ramp],
  };
}
