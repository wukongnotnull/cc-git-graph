const HEIGHT = 16
const RADIUS = HEIGHT / 2
const FONT_PX = 11
const PAD_X = 7
// The browser picks the font, so these are estimates; `textLength` pins each text to its estimate.
const ASCII_PX = 6.3
const WIDE_PX = FONT_PX
const FIRST_WIDE_CODE = 0x2e80
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif'

export type ChipSvgOptions = {
  label: string
  // Remote names drawn in a second, darker part of the same pill.
  remote?: string
  color: string
  remoteColor: string
  textColor: string
  isBold: boolean
  // What a hover shows: the full, uncut name.
  title: string
}

export type ChipSvg = { source: string; width: number; height: number }

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function textWidthPx(text: string): number {
  return Array.from(text).reduce((sum, char) => sum + ((char.codePointAt(0) ?? 0) >= FIRST_WIDE_CODE ? WIDE_PX : ASCII_PX), 0)
}

const label = (text: string, x: number, width: number, color: string, weight: string): string =>
  `<text x="${x}" y="${RADIUS + 4}" font-size="${FONT_PX}" font-weight="${weight}" font-family="${FONT_FAMILY}" fill="${color}" textLength="${width}" lengthAdjust="spacingAndGlyphs">${escapeXml(text)}</text>`

export function chipSvg(options: ChipSvgOptions): ChipSvg {
  const labelWidth = textWidthPx(options.label)
  const localWidth = labelWidth + PAD_X * 2
  const remote = options.remote ?? ''
  const remoteWidth = remote === '' ? 0 : textWidthPx(remote)
  const width = Math.ceil(localWidth + (remote === '' ? 0 : remoteWidth + PAD_X * 2))

  // The whole pill in the remote colour; the local part over it, rounded on the left and square on the right.
  const base = `<rect x="0" y="0" width="${width}" height="${HEIGHT}" rx="${RADIUS}" fill="${remote === '' ? options.color : options.remoteColor}"/>`
  const local =
    remote === ''
      ? ''
      : `<path d="M${RADIUS} 0 H${localWidth} V${HEIGHT} H${RADIUS} A${RADIUS} ${RADIUS} 0 0 1 0 ${RADIUS} A${RADIUS} ${RADIUS} 0 0 1 ${RADIUS} 0 Z" fill="${options.color}"/>`
  const texts = [
    label(options.label, PAD_X, labelWidth, options.textColor, options.isBold ? '600' : '400'),
    remote === '' ? '' : label(remote, localWidth + PAD_X, remoteWidth, options.textColor, '400'),
  ].join('')

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}"><title>${escapeXml(options.title)}</title>${base}${local}${texts}</svg>`,
    width,
    height: HEIGHT,
  }
}
