import { branchIconSvg } from './branch-icon-svg'
import { textWidthPx } from './chip-svg'

// As tall as the Git Graph button beside it (a Box with a border is three rows tall, which is why this is drawn).
const HEIGHT = 20
const FONT_PX = 12
const ICON_SIZE = 12
const PAD_LEFT = 8
const PAD_RIGHT = 10
const GAP = 6
const BORDER_COLOR = '#8b949e'
const BORDER_OPACITY = '0.6'
const ICON_COLOR = '#6e7781'
const TEXT_COLOR = '#57606a'
// `textWidthPx` estimates for an 11 px font; the name is drawn a little larger.
const SCALE = FONT_PX / 11
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'

export type BranchPill = { source: string; width: number; height: number }

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// The current branch as an outlined pill: the git-branch glyph, then the name. The browser picks the font, so the
// name is pinned to its estimated width with `textLength`. The colours are fixed greys, chosen for a light band.
export function branchPillSvg(name: string): BranchPill {
  const textWidth = Math.round(textWidthPx(name) * SCALE)
  const width = PAD_LEFT + ICON_SIZE + GAP + textWidth + PAD_RIGHT
  const icon = branchIconSvg(ICON_SIZE, ICON_COLOR).source.replace('<svg ', `<svg x="${PAD_LEFT}" y="${(HEIGHT - ICON_SIZE) / 2}" `)
  const border = `<rect x="0.5" y="0.5" width="${width - 1}" height="${HEIGHT - 1}" rx="${(HEIGHT - 1) / 2}" fill="none" stroke="${BORDER_COLOR}" stroke-opacity="${BORDER_OPACITY}"/>`
  const text = `<text x="${PAD_LEFT + ICON_SIZE + GAP}" y="${HEIGHT / 2 + 4}" font-size="${FONT_PX}" font-family="${FONT_FAMILY}" fill="${TEXT_COLOR}" textLength="${textWidth}" lengthAdjust="spacingAndGlyphs">${escapeXml(name)}</text>`

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}">${border}${icon}${text}</svg>`,
    width,
    height: HEIGHT,
  }
}
