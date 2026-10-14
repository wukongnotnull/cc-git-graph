const HEIGHT = 8
const RADIUS = HEIGHT / 2
const TRACK_COLOR = '#8b949e'
const TRACK_OPACITY = '0.3'

export type UsageBar = { source: string; width: number; height: number }

// A thin rounded bar, `percent` of it filled. The track is a translucent grey, readable on a light or a dark band.
export function usageBarSvg(percent: number, width: number, color: string): UsageBar {
  const clamped = Math.min(Math.max(Number.isFinite(percent) ? percent : 0, 0), 100)
  const filled = clamped === 0 ? 0 : Math.max(Math.round((width * clamped) / 100), HEIGHT)
  const track = `<rect x="0" y="0" width="${width}" height="${HEIGHT}" rx="${RADIUS}" fill="${TRACK_COLOR}" fill-opacity="${TRACK_OPACITY}"/>`
  const bar = filled === 0 ? '' : `<rect x="0" y="0" width="${filled}" height="${HEIGHT}" rx="${RADIUS}" fill="${color}"/>`

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" viewBox="0 0 ${width} ${HEIGHT}">${track}${bar}</svg>`,
    width,
    height: HEIGHT,
  }
}
