import { readFile, writeFile } from 'node:fs/promises'
const script = (await readFile(new URL('./dist/panel.js', import.meta.url), 'utf8')).replace(/<\/script/gi, '<\\/script')
const css = (await readFile(new URL('./style.css', import.meta.url), 'utf8')).replace(/<\/style/gi, '<\\/style')
await writeFile(new URL('./dist/panel.html', import.meta.url), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Git Graph</title><style>${css}</style></head><body><main id="app" aria-label="Git Graph"><p class="empty">Waiting for repository…</p></main><script>${script}</script></body></html>`)
