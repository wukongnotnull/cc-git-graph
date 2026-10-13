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
