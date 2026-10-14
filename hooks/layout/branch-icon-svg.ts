const STROKE_WIDTH = 1.4
const DOT_RADIUS = 1.7

export type BranchIcon = { source: string; width: number; height: number }

// The git-branch glyph: two dots on a vertical line and a third dot on a line that forks from it. Drawn here, in a
// mid grey that reads on a light and on a dark band; the branch name beside it is a Text and follows the theme.
const round = (value: number): number => Number(value.toFixed(2))

export function branchIconSvg(size: number, color: string): BranchIcon {
  const unit = size / 16
  const at = (value: number): number => round(value * unit)
  const dot = (x: number, y: number): string => `<circle cx="${at(x)}" cy="${at(y)}" r="${at(DOT_RADIUS)}"/>`
  const stem = `<path d="M${at(4)} ${at(5.2)}V${at(10.8)}"/>`
  const fork = `<path d="M${at(12)} ${at(6.2)}V${at(7)}C${at(12)} ${at(9)} ${at(10)} ${at(9.3)} ${at(8)} ${at(9.3)}H${at(6.5)}C${at(5)} ${at(9.3)} ${at(4)} ${at(9.8)} ${at(4)} ${at(10.8)}"/>`

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" stroke="${color}" stroke-width="${at(STROKE_WIDTH)}" stroke-linecap="round">${stem}${fork}${dot(4, 3.5)}${dot(4, 12.5)}${dot(12, 4.5)}</svg>`,
    width: size,
    height: size,
  }
}
