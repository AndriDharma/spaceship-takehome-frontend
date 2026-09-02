/**
 * Chart colours.
 *
 * Recharts needs real colour strings for stroke and fill, not CSS variables,
 * so the palette lives here in JS rather than in app.css. Everything that is
 * not a data mark - text, gridlines, surfaces - is styled from CSS variables
 * in app.css, because that is where the theme belongs.
 *
 * The dark column is the same eight hues re-stepped for the dark surface, not
 * an automatic flip of the light ones. Both sets are validated as a set.
 *
 * Two rules that are easy to break by accident:
 *
 *   - Slots are assigned in fixed order and never cycled. A ninth series is
 *     never a ninth colour; SERIES_LIMIT folds the tail into "Other".
 *   - Colour follows the entity, not its rank. Series get their slot from a
 *     stable sort of the whole set, so hiding one does not repaint the rest.
 */

const CATEGORICAL_LIGHT = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
]

const CATEGORICAL_DARK = [
  '#3987e5',
  '#d95926',
  '#199e70',
  '#c98500',
  '#d55181',
  '#008300',
  '#9085e9',
  '#e66767',
]

/** Past this many series a chart stops being readable. The rest becomes "Other". */
export const SERIES_LIMIT = 8

const CHROME = {
  light: {
    surface: '#fcfcfb',
    grid: '#e1e0d9',
    axis: '#c3c2b7',
    muted: '#898781',
    text: '#0b0b0b',
    other: '#898781',
  },
  dark: {
    surface: '#1a1a19',
    grid: '#2c2c2a',
    axis: '#383835',
    muted: '#898781',
    text: '#ffffff',
    other: '#898781',
  },
}

export function palette(theme) {
  return theme === 'dark' ? CATEGORICAL_DARK : CATEGORICAL_LIGHT
}

export function chrome(theme) {
  return theme === 'dark' ? CHROME.dark : CHROME.light
}

export function seriesColor(theme, index) {
  const colors = palette(theme)

  // Not modulo. Running off the end means the caller did not fold to "Other",
  // and silently reusing slot 1 would make two different series look like the
  // same one.
  return colors[index] ?? chrome(theme).other
}
