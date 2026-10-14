const STROKE_WIDTH = 1.4
const DOT_RADIUS = 1.7

export type BranchIcon = { source: string; width: number; height: number }

// The git-branch glyph: two dots on a vertical line and a third dot on a line that forks from it. Drawn here, in a
// mid grey that reads on a light and on a dark band; the branch name beside it is a Text and follows the theme.
export function branchIconSvg(size: number, color: string): BranchIcon {
  const unit = size / 16
  const dot = (x: number, y: number): string => `<circle cx="${x * unit}" cy="${y * unit}" r="${DOT_RADIUS * unit}"/>`
  const stem = `<path d="M${4 * unit} ${5.2 * unit}V${10.8 * unit}"/>`
  const fork = `<path d="M${12 * unit} ${6.2 * unit}V${7 * unit}C${12 * unit} ${9 * unit} ${10 * unit} ${9.3 * unit} ${8 * unit} ${9.3 * unit}H${6.5 * unit}C${5 * unit} ${9.3 * unit} ${4 * unit} ${9.8 * unit} ${4 * unit} ${10.8 * unit}"/>`

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" stroke="${color}" stroke-width="${STROKE_WIDTH * unit}" stroke-linecap="round">${stem}${fork}${dot(4, 3.5)}${dot(4, 12.5)}${dot(12, 4.5)}</svg>`,
    width: size,
    height: size,
  }
}
