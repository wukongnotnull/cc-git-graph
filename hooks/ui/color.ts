const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

// Mixes a `#rrggbb` colour with black by `amount` (0 keeps it, 1 is black); anything else comes back as it was.
export function darken(color: string, amount: number): string {
  const match = HEX.exec(color)

  if (match === null) {
    return color
  }

  const channel = (hex: string | undefined): string =>
    Math.round(parseInt(hex ?? '0', 16) * (1 - amount))
      .toString(16)
      .padStart(2, '0')

  return `#${channel(match[1])}${channel(match[2])}${channel(match[3])}`
}

const LIGHT_TEXT = '#ffffff'
const DARK_TEXT = '#1f2328'

const channelLuminance = (value: number): number => {
  const unit = value / 255

  return unit <= 0.03928 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4
}

function luminance(color: string): number {
  const match = HEX.exec(color)

  if (match === null) {
    return 0
  }

  const [red, green, blue] = [match[1], match[2], match[3]].map(hex => channelLuminance(parseInt(hex ?? '0', 16)))

  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0)
}

// White or near-black text, whichever reads better on `background` (the higher WCAG contrast).
export function readableOn(background: string): string {
  const level = luminance(background)
  const againstLight = 1.05 / (level + 0.05)
  const againstDark = (level + 0.05) / (luminance(DARK_TEXT) + 0.05)

  return againstLight >= againstDark ? LIGHT_TEXT : DARK_TEXT
}
