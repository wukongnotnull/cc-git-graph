const STROKE = 3
const TRACK_COLOR = '#8b949e'
const TRACK_OPACITY = '0.3'

export type UsageRing = { source: string; width: number; height: number }

// A thin ring, `percent` of it drawn from the top clockwise. The track is a translucent grey, readable on a light or
// a dark band.
export function usageRingSvg(percent: number, size: number, color: string): UsageRing {
  const clamped = Math.min(Math.max(Number.isFinite(percent) ? percent : 0, 0), 100)
  const radius = (size - STROKE) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const track = `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${TRACK_COLOR}" stroke-opacity="${TRACK_OPACITY}" stroke-width="${STROKE}"/>`
  const arc =
    clamped === 0
      ? ''
      : `<circle cx="${center}" cy="${center}" r="${radius}" fill="none" stroke="${color}" stroke-width="${STROKE}" stroke-linecap="round" stroke-dasharray="${((circumference * clamped) / 100).toFixed(2)} ${circumference.toFixed(2)}" transform="rotate(-90 ${center} ${center})"/>`

  return {
    source: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${track}${arc}</svg>`,
    width: size,
    height: size,
  }
}
