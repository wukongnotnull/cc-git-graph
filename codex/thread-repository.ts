import { spawn } from 'node:child_process'
import { StringDecoder } from 'node:string_decoder'
import { isAbsolute } from 'node:path'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export function threadIdFromMeta(meta: Record<string, unknown> | undefined): string | undefined {
  const snake = meta?.thread_id, camel = meta?.threadId
  if (snake === undefined && camel === undefined) return undefined
  if ((snake !== undefined && (typeof snake !== 'string' || !uuid.test(snake))) ||
      (camel !== undefined && (typeof camel !== 'string' || !uuid.test(camel))) ||
      (snake !== undefined && camel !== undefined && snake !== camel)) {
    throw new Error('Could not identify the calling chat. Specify repository explicitly.')
  }
  return (snake ?? camel) as string
}

type Options = { command?: string; args?: string[]; timeoutMs?: number; signal?: AbortSignal }

/** Read only the calling chat's directory. No turns, transcript scan or long-lived daemon. */
export async function readThreadDirectory(threadId: string, options: Options = {}): Promise<string> {
  if (!uuid.test(threadId)) throw new Error('Invalid calling chat ID.')
  if (options.signal?.aborted) throw new Error('Chat directory lookup cancelled.')
  return new Promise((resolve, reject) => {
    const child = spawn(options.command ?? 'codex', options.args ?? ['app-server'], { stdio: ['pipe', 'pipe', 'pipe'], detached: process.platform !== 'win32', windowsHide: true })
    const decoder = new StringDecoder('utf8')
    let buffer = '', bytes = 0, phase: 'initialize' | 'read' = 'initialize'
    let finishing = false, directory: string | undefined, failure: Error | undefined
    let killTimer: ReturnType<typeof setTimeout> | undefined
    let treeStopped: Promise<void> = Promise.resolve()
    const timeout = setTimeout(() => finish(new Error('Chat directory lookup timed out.')), options.timeoutMs ?? 5_000)
    const abort = () => finish(new Error('Chat directory lookup cancelled.'))
    options.signal?.addEventListener('abort', abort, { once: true })

    function killGroup(): void {
      if (process.platform !== 'win32' && child.pid !== undefined) {
        try { process.kill(-child.pid, 'SIGKILL') } catch { /* The group already exited. */ }
      }
    }
    function finish(error?: Error, cwd?: string): void {
      if (finishing) return
      finishing = true
      failure = error
      directory = cwd
      clearTimeout(timeout)
      options.signal?.removeEventListener('abort', abort)
      child.stdin.end()
      // EOF normally stops app-server. Bound teardown even for an unresponsive child.
      if (process.platform === 'win32' && child.pid !== undefined) {
        // npm's Codex launcher may own another executable. Terminate the tree.
        treeStopped = new Promise(done => {
          const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true, timeout: 1_000 })
          const failed = () => {
            failure ??= new Error('Could not stop the Codex directory lookup process tree.')
            child.kill('SIGKILL')
            child.stdout.destroy()
            child.stderr.destroy()
          }
          killer.on('error', failed)
          killer.on('close', code => { if (code !== 0) failed(); done() })
        })
      } else {
        killTimer = setTimeout(killGroup, 250)
      }
    }
    function send(message: Record<string, unknown>): void {
      child.stdin.write(JSON.stringify(message) + '\n')
    }
    child.stderr.resume()
    child.on('error', () => finish(new Error('Could not start Codex CLI to identify this chat. Ensure codex is on PATH.')))
    child.stdin.on('error', () => finish(new Error('Could not query the calling chat directory.')))
    child.on('close', () => {
      clearTimeout(timeout)
      killGroup()
      clearTimeout(killTimer)
      options.signal?.removeEventListener('abort', abort)
      void treeStopped.then(() => {
        if (directory !== undefined && failure === undefined) resolve(directory)
        else reject(failure ?? new Error('Codex CLI exited before returning this chat directory.'))
      })
    })
    child.stdout.on('data', (chunk: Buffer) => {
      if (finishing) return
      bytes += chunk.length
      if (bytes > 1024 * 1024) { finish(new Error('Codex chat directory response exceeded the size limit.')); return }
      buffer += decoder.write(chunk)
      let end: number
      while (!finishing && (end = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, end)
        buffer = buffer.slice(end + 1)
        if (!line.trim()) continue
        let message: unknown
        try { message = JSON.parse(line) }
        catch { finish(new Error('Invalid Codex chat directory response.')); return }
        if (!object(message)) { finish(new Error('Invalid Codex chat directory response.')); return }
        if (message.id !== (phase === 'initialize' ? 1 : 2)) continue
        if (message.error !== undefined) { finish(new Error('Codex CLI could not read this chat directory.')); return }
        if (phase === 'initialize') {
          phase = 'read'
          send({ jsonrpc: '2.0', method: 'initialized' })
          send({ jsonrpc: '2.0', id: 2, method: 'thread/read', params: { threadId, includeTurns: false } })
        } else {
          const thread = object(message.result) ? message.result.thread : undefined
          if (!object(thread) || thread.id !== threadId || typeof thread.cwd !== 'string' ||
              !isAbsolute(thread.cwd) || thread.cwd.includes('\0')) {
            finish(new Error('Codex returned an invalid directory for the calling chat.'))
          } else finish(undefined, thread.cwd)
        }
      }
    })
    if (options.signal?.aborted) abort()
    else send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { clientInfo: { name: 'wukong-git-graph-directory', version: '1' } } })
  })
}
