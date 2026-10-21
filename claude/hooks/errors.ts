// The text of a thrown value, for a toast or the pane: an Error's message, anything else as it prints.
export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
