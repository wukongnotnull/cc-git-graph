const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const pad = (value: number): string => String(value).padStart(2, '0')

export function shortHash(hash: string): string {
  return hash.slice(0, 8)
}

export function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const month = MONTHS[date.getMonth()] ?? ''

  return `${pad(date.getDate())} ${month} ${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// Cuts to `max` characters, the last one an ellipsis, so a long name cannot push the description out of its cell.
export function ellipsize(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, Math.max(max - 1, 1))}…`
}
