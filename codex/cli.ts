import { resolve } from 'node:path'
import { startGraphServer } from './server'

const args = process.argv.slice(2)
if (args.length !== 2 || args[0] !== '--repo') {
  console.error('Usage: npm --prefix codex start -- --repo /absolute/path/to/repository')
  process.exitCode = 1
} else {
  startGraphServer(resolve(args[1]!)).then(service => {
    console.log(`Wukong Git Graph · ${resolve(args[1]!)}\n${service.url}\nRead-only local service. Press Ctrl+C to stop.`)
    const stop = () => { void service.close().catch(() => { process.exitCode = 1 }) }
    process.once('SIGINT', stop)
    process.once('SIGTERM', stop)
  }).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
}
