import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
const script = (await readFile(new URL('./dist/panel.js', import.meta.url), 'utf8')).replace(/<\/script/gi, '<\\/script')
const css = (await readFile(new URL('./style.css', import.meta.url), 'utf8')).replace(/<\/style/gi, '<\\/style')
await writeFile(new URL('./dist/panel.html', import.meta.url), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Wukong Git Graph</title><style>${css}</style></head><body><main id="app" aria-label="Wukong Git Graph"><p class="empty">Waiting for repository…</p></main><script>${script}</script></body></html>`)

// Install only this self-contained output, never the source checkout.
const packageDirectory = new URL('./dist/plugin/', import.meta.url)
await rm(packageDirectory, { recursive: true, force: true })
await mkdir(packageDirectory, { recursive: true })
for (const path of ['plugin.json', 'mcp.json', '.codex-plugin', '.mcp.json', 'skills']) {
  await cp(new URL(`./${path}`, import.meta.url), new URL(path, packageDirectory), { recursive: true })
}
for (const path of ['mcp.cjs', 'panel.html']) {
  await cp(new URL(`./dist/${path}`, import.meta.url), new URL(path, packageDirectory))
}
