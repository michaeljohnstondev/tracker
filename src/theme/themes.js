import { Platform } from 'react-native';

/**
 * Two themes, one shape.
 *
 * The dark theme is the original neon-on-dark language: sharp neon borders,
 * transparent fills, low-alpha colour washes. All of that depends on a dark
 * surface underneath — a 10%-alpha cyan wash over white is nothing at all,
 * and #00FFFF text on white is unreadable.
 *
 * So the light theme is not an inversion of the dark values. It keeps the
 * hues recognisable but darkens them until they carry on a lit surface, and
 * swaps the treatments: neon outline -> solid fill, alpha wash -> opaque tint.
 *
 * Components should read from `semantic` (surface / border / accent / ...)
 * rather than from a hue name. A hue name says "cyan"; it does not say what
 * cyan is *for* — and the answer genuinely differs between the two modes.
 */

const fonts = {
  main: Platform.select({
    ios: 'System',
    android: 'Roboto',
    web: 'system-ui, -apple-system, sans-serif',
    default: 'sans-serif',
  }),
  bold: Platform.select({
    ios: 'System',
    android: 'Roboto',
    web: 'system-ui, -apple-system, sans-serif',
    default: 'sans-serif',
  }),
};

const fontWeights = {
  light: '300',
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '800',
};

const sizes = {
  borderRadius: 12,
  buttonRadius: 12,
  inputPadding: 12,
};

// ---------------------------------------------------------------------------
// Dark — the original palette, unchanged. Every value here is identical to the
// pre-theming version, so switching nothing changes nothing.
// ---------------------------------------------------------------------------

const darkColors = {
  background: '#001020',
  backgroundGradient: ['#001020', '#001840', '#002060'],
  // Flatter, darker gradient used inside a round (picking / voting /
  // scoring / round results / warmup) so the card surface #141A33
  // reads as a lift off the background instead of blending into
  // the bluer default gradient.
  gameBackgroundGradient: ['#05080F', '#0A0E1F', '#0F1229'],
  buttonGradient: ['#00c6ff', '#0072ff'],
  royalPurpleGradient: ['#4B0082', '#0066FF', '#4B0082', '#0066FF', '#4B0082'],
  // Modal background — deeper than backgroundGradient, with a vibeBlue
  // glow corner so overlay modals don't read as plain dark slabs.
  modalGradient: ['#0A0420', '#1A0840', '#06182E', '#001020'],

  textPrimary: '#FFFFFF',
  textSecondary: '#778DA9',
  inputBorder: '#555',
  inputBackground: 'rgba(255,255,255,0.05)',
  alertButton: '#00c6ff',

  //vibeColors
  vibeBlue: '#00C6FF',
  vibeGreen: '#00FF41',
  vibeForest: '#228B22',
  vibeOrange: '#FFCC66',
  vibePurple: '#6B00CC',
  // Deep neon purple used for card accent borders on the game
  // screens — saturated enough to feel like a real neon line
  // against the #141A33 card surface without going lavender.
  vibeNeonPurple: '#7B2CBF',
  vibeYellow: '#FFD700',
  vibePink: '#FF10F0',
  vibeRed: '#FF4444',
  vibeCyan: '#00FFFF',
  vibeTurquoise: '#40E0D0',
  vibeAqua: '#00FFF7',
  vibeTeal: '#00FFD4',
  vibeElectricBlue: '#007FFF',
  vibeRoyalBlue: '#4169E1',

  // Basic colors
  white: '#FFFFFF',
  black: '#000000',
  gray: '#778DA9',
  darkGray: '#2d2d2d',

  // UI accent colors
  headerBackground: '#001020',
  statusBarBackground: '#001020',

  // VibeBackgroundColors
  vibeBackgroundBlue: 'rgba(0, 198, 255, 0.1)',
  vibeBackgroundGreen: 'rgba(0, 255, 65, 0.1)',
  vibeBackgroundOrange: 'rgba(253, 126, 20, 0.1)',
  vibeBackgroundPurple: 'rgba(139, 0, 255, 0.1)',
  vibeBackgroundYellow: 'rgba(255, 255, 0, 0.1)',
  vibeBackgroundPink: 'rgba(255, 16, 240, 0.1)',
  vibeBackgroundCyan: 'rgba(0, 255, 255, 0.1)',
  vibeBackgroundTurquoise: 'rgba(64, 224, 208, 0.2)',
  vibeBackgroundAqua: 'rgba(0, 255, 247, 0.1)',
  vibeBackgroundTeal: 'rgba(0, 255, 212, 0.1)',
  vibeBackgroundElectricBlue: 'rgba(0, 127, 255, 0.1)',
  vibeBackgroundRoyalBlue: 'rgba(65, 105, 225, 0.1)',
  vibeBackgroundRed: 'rgba(255, 68, 68, 0.1)',
  vibeBackgroundGray: 'rgba(119, 141, 169, 0.1)',

  // Comment role colors
  commentUser: '#28a745',
  commentAdmin: '#6f42c1',
  commentHost: '#fd7e14',
  commentOther: '#007bff',

  // Comment background colors (with transparency)
  commentUserBg: 'rgba(40, 167, 69, 0.1)',
  commentAdminBg: 'rgba(111, 66, 193, 0.1)',
  commentHostBg: 'rgba(253, 126, 20, 0.1)',
  commentOtherBg: 'rgba(0, 123, 255, 0.1)',
};

// ---------------------------------------------------------------------------
// Light — same hue identity, darkened until it carries on a lit surface.
// Every vibe hue below clears 4.5:1 against #FFFFFF, so any of them is safe
// as text and not only as a border.
// ---------------------------------------------------------------------------

const lightColors = {
  background: '#F4F7FB',
  backgroundGradient: ['#FFFFFF', '#EEF3FA', '#E1EAF6'],
  // The light counterpart of the flattened in-round gradient: barely-there
  // steps, so a white card still reads as a lift off it.
  gameBackgroundGradient: ['#FDFEFF', '#F2F6FC', '#E9F0F9'],
  buttonGradient: ['#0090C8', '#0057C2'],
  royalPurpleGradient: ['#5B1A9E', '#0057C2', '#5B1A9E', '#0057C2', '#5B1A9E'],
  // Mirrors the dark modal's violet-into-blue drift, on paper instead of ink.
  modalGradient: ['#FFFFFF', '#F5F0FC', '#EDF3FB', '#F4F7FB'],

  textPrimary: '#0B1B2B',
  textSecondary: '#54637A',
  inputBorder: '#C3CEDC',
  inputBackground: 'rgba(11,27,43,0.04)',
  alertButton: '#0068B3',

  //vibeColors — darkened counterparts, hue preserved
  vibeBlue: '#0068B3',
  vibeGreen: '#0D7C2F',
  vibeForest: '#1B6B1B',
  vibeOrange: '#9C5C00',
  vibePurple: '#6A1FC2',
  vibeNeonPurple: '#6D28A8',
  vibeYellow: '#836800',
  vibePink: '#B5009F',
  vibeRed: '#C62828',
  vibeCyan: '#00727F',
  vibeTurquoise: '#0E776D',
  vibeAqua: '#007670',
  vibeTeal: '#007A66',
  vibeElectricBlue: '#0057C2',
  vibeRoyalBlue: '#2E4FB8',

  // Basic colors — `white`/`black` stay literal on purpose. They are the two
  // tokens whose name *is* the value; code reaching for them wants that ink.
  white: '#FFFFFF',
  black: '#000000',
  gray: '#54637A',
  darkGray: '#3A4557',

  // UI accent colors
  headerBackground: '#FFFFFF',
  statusBarBackground: '#FFFFFF',

  // VibeBackgroundColors — on a lit surface a 10% wash vanishes, so these are
  // opaque tints at roughly the same perceived weight instead.
  vibeBackgroundBlue: '#E4F1FB',
  vibeBackgroundGreen: '#E3F5E8',
  vibeBackgroundOrange: '#FBEEDD',
  vibeBackgroundPurple: '#EFE7FB',
  vibeBackgroundYellow: '#F7F0D6',
  vibeBackgroundPink: '#FBE4F6',
  vibeBackgroundCyan: '#DFF1F3',
  vibeBackgroundTurquoise: '#DFF2F0',
  vibeBackgroundAqua: '#DEF1EF',
  vibeBackgroundTeal: '#DEF2EC',
  vibeBackgroundElectricBlue: '#E1EBFA',
  vibeBackgroundRoyalBlue: '#E6EAF8',
  vibeBackgroundRed: '#FBE7E7',
  vibeBackgroundGray: '#EDF0F5',

  // Comment role colors
  commentUser: '#1B7A32',
  commentAdmin: '#5C34A8',
  commentHost: '#B35A00',
  commentOther: '#0060C4',

  // Comment background colors — opaque, same reasoning as the washes above
  commentUserBg: '#E4F3E8',
  commentAdminBg: '#EDE7F8',
  commentHostBg: '#FAEDDD',
  commentOtherBg: '#E2EDFB',
};

// ---------------------------------------------------------------------------
// Semantic layer.
//
// This is what components should actually consume. `vibeCyan` tells you a
// hue; it does not tell you whether that hue is this mode's border, its accent
// text, or its fill. Only these names survive a mode switch intact.
// ---------------------------------------------------------------------------

const darkSemantic = {
  // Surfaces
  surface: '#141A33',
  surfaceAlt: '#1B2242',
  surfaceSunken: '#0A0E1F',

  // Lines
  border: 'rgba(255,255,255,0.12)',
  borderStrong: darkColors.vibeCyan,

  // Text
  textPrimary: darkColors.textPrimary,
  textSecondary: darkColors.textSecondary,
  textMuted: '#4E6180',
  textInverse: '#001020',

  // Accent. On dark the accent is a *line* — the fill stays transparent and
  // the neon border does the work.
  accent: darkColors.vibeBlue,
  accentText: darkColors.vibeCyan,
  accentFill: 'transparent',
  // The slab behind the neon edge: dimmer than the border on dark, and on
  // light the accent itself, since there is no edge left to carry the colour.
  accentInnerFill: '#0072ff',
  accentBorder: darkColors.vibeCyan,
  onAccent: darkColors.textPrimary,

  // Status
  danger: darkColors.vibeRed,
  dangerFill: '#CC0033',
  dangerBorder: darkColors.vibeOrange,
  onDanger: darkColors.textPrimary,

  success: darkColors.vibeGreen,
  successFill: darkColors.vibeForest,
  successBorder: darkColors.vibeGreen,
  onSuccess: darkColors.textPrimary,

  // Fills that were hardcoded before the light theme existed, and so were
  // written assuming a dark surface underneath.
  fieldFill: 'rgba(0, 0, 0, 0.3)',
  selectedFill: 'rgba(255,255,255,0.09)',
  // Text sitting on buttonGradient. The dark gradient is a bright cyan-to-blue,
  // so ink reads on it; the light gradient is the opposite and needs the
  // opposite text.
  onGradient: '#000000',

  // Depth. The dark language forbids glow, so it has no shadow either —
  // separation comes from the border.
  overlay: 'rgba(0,0,0,0.6)',
  overlayStrong: 'rgba(0,0,0,0.8)',
  shadow: 'transparent',
  shadowOpacity: 0,
};

const lightSemantic = {
  // Surfaces
  surface: '#FFFFFF',
  surfaceAlt: '#F4F7FB',
  surfaceSunken: '#E8EEF6',

  // Lines
  border: '#D6DEE9',
  borderStrong: '#9FB0C4',

  // Text
  textPrimary: lightColors.textPrimary,
  textSecondary: lightColors.textSecondary,
  textMuted: '#616C7D',
  textInverse: '#FFFFFF',

  // Accent. On light the accent is a *fill* — a hairline outline replaces the
  // neon border, and the colour is carried by the solid background instead.
  accent: lightColors.vibeBlue,
  accentText: lightColors.vibeBlue,
  accentFill: lightColors.vibeBlue,
  accentInnerFill: lightColors.vibeBlue,
  accentBorder: '#0057C2',
  onAccent: '#FFFFFF',

  // Status
  danger: lightColors.vibeRed,
  dangerFill: '#C62828',
  dangerBorder: '#8E1F1F',
  onDanger: '#FFFFFF',

  success: lightColors.vibeGreen,
  successFill: '#0D7C2F',
  successBorder: '#0A6626',
  onSuccess: '#FFFFFF',

  // Fills. The dark side darkens with translucent black; on paper that only
  // makes grey, so these are explicit tints instead.
  fieldFill: '#EEF2F8',
  selectedFill: '#E4F1FB',
  onGradient: '#FFFFFF',

  // Depth. Light has no neon to separate with, so it uses a real shadow.
  overlay: 'rgba(11,27,43,0.35)',
  overlayStrong: 'rgba(11,27,43,0.55)',
  shadow: '#0B1B2B',
  shadowOpacity: 0.12,
};

export const darkTheme = {
  mode: 'dark',
  isDark: true,
  colors: darkColors,
  semantic: darkSemantic,
  fonts,
  fontWeights,
  sizes,
  // UI Restrictions: NO glow effects - Use sharp neon borders instead
};

export const lightTheme = {
  mode: 'light',
  isDark: false,
  colors: lightColors,
  semantic: lightSemantic,
  fonts,
  fontWeights,
  sizes,
};

export const themes = { dark: darkTheme, light: lightTheme };

// Nothing in tracker imports this any more — every screen and component now
// goes through useThemedStyles. It stays as the safe landing spot for a
// `import theme from '.../themes'` ported in from one of the other apps: such
// a file renders in dark rather than crashing, which makes the port obvious
// without breaking the build. A static import cannot follow a runtime switch,
// so converting it to useThemedStyles is what makes it live.
export default darkTheme;
