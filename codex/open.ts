import { resolve } from 'node:path'
import { ensureGraphService } from './launch'

const args = process.argv.slice(2)
if (args.length !== 2 || args[0] !== '--repo') {
  console.error('Usage: npm --prefix codex run open -- --repo /absolute/path/to/repository')
  process.exitCode = 1
} else {
  ensureGraphService(resolve(args[1]!)).then(service => {
    console.log(`Wukong Git Graph ${service.reused ? 'reused' : 'started'}.\n${service.url}`)
    if (!service.reused) {
      console.log('Keep this terminal running. Press Ctrl+C to stop.')
      const stop = () => { void service.close().catch(() => { process.exitCode = 1 }) }
      process.once('SIGINT', stop)
      process.once('SIGTERM', stop)
    }
  }).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
}
