const HEADS = 'refs/heads/'
const REMOTES = 'refs/remotes/'

export function parseBranches(stdout: string): { locals: string[]; remotes: string[] } {
  const locals: string[] = []
  const remotes: string[] = []

  for (const line of stdout.split('\n')) {
    const name = line.trim()

    if (name.startsWith(HEADS)) {
      locals.push(name.slice(HEADS.length))
    } else if (name.startsWith(REMOTES)) {
      remotes.push(name.slice(REMOTES.length))
    }
  }

  return { locals, remotes }
}
