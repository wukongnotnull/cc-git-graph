import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { readBranches, readDetail, readDiff, readPage, RequestError } from './repository'

export async function startGraphServer(directory: string): Promise<{ url: string; close(): Promise<void> }> {
  const root = await realpath(directory)
  const token = randomBytes(24).toString('hex')
  const auth = Buffer.from(`Bearer ${token}`)
  let origin = ''
  const server = createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
    const json = (status: number, data: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify(data))
    }
    try {
      if (`http://${request.headers.host}` !== origin || (request.headers.origin && request.headers.origin !== origin)) {
        throw new RequestError('This service accepts only same-origin local requests.', 403)
      }
      if (request.method !== 'GET') throw new RequestError('Only GET is supported.', 405)
      const url = new URL(request.url ?? '/', origin)
      const assets: Record<string, [string, string]> = {
        '/': [join(__dirname, '../index.html'), 'text/html'],
        '/browser.js': [join(__dirname, 'browser.js'), 'text/javascript'],
        '/style.css': [join(__dirname, '../style.css'), 'text/css'],
      }
      const asset = assets[url.pathname]
      if (asset) {
        const content = await readFile(asset[0])
        response.writeHead(200, { 'Content-Type': `${asset[1]}; charset=utf-8` })
        response.end(content)
        return
      }
      const received = Buffer.from(request.headers.authorization ?? '')
      if (received.length !== auth.length || !timingSafeEqual(received, auth)) throw new RequestError('Reopen the full Git Graph URL from the terminal.', 401)
      const hash = url.searchParams.get('hash') ?? ''
      switch (url.pathname) {
        case '/api/branches': json(200, await readBranches(root)); break
        case '/api/commits': json(200, await readPage(root, url.searchParams)); break
        case '/api/detail': json(200, await readDetail(root, hash)); break
        case '/api/diff': json(200, await readDiff(root, hash, url.searchParams.get('path') ?? '')); break
        default: throw new RequestError('Not found.', 404)
      }
    } catch (error) {
      json(error instanceof RequestError ? error.status : 500, { error: error instanceof Error ? error.message : 'Could not read the Git history.' })
    }
  })
  server.requestTimeout = 15_000
  server.headersTimeout = 10_000
  await new Promise<void>((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => { server.off('error', reject); resolveListen() })
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not open the local server.')
  origin = `http://127.0.0.1:${address.port}`
  return {
    url: `${origin}/#${token}`,
    close: () => new Promise<void>((resolveClose, reject) => server.close(error => error ? reject(error) : resolveClose())),
  }
}
