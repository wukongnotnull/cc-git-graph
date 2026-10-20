import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderGraph } from './render'
import type { GraphState } from './protocol'

test('renders escaped commit text, graph lanes, controls and empty/error states', () => {
  const state = {
    branches: [], branch: '', remote: true, current: 'main', commits: [{
      hash: 'a'.repeat(40), parents: [], author: 'A <B>', timestamp: 1,
      subject: '<img src=x onerror=alert(1)>', refs: [],
    }], hasMore: true, start: 0, detail: null, diff: null, error: '', busy: false,
  }
  const html = renderGraph(state)
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.doesNotMatch(html, /<img src=x/)
  assert.match(html, /<svg/)
  assert.match(html, /Load more/)
  assert.match(html, /Show Remote Branches/)
  assert.doesNotMatch(renderGraph({ ...state, commits: [{ ...state.commits[0]!, hash: '\"><img src=/probe>' }] }), /<img src=\/probe>/)
  assert.match(renderGraph({ ...state, commits: [], hasMore: false }), /No commits/)
  assert.match(renderGraph({ ...state, error: 'Git <failed>' }), /Git &lt;failed&gt;/)
})

test('bounds expanded details and escapes filenames, messages and diff text', () => {
  const hash = 'a'.repeat(40)
  const files = Array.from({ length: 51 }, (_, i) => ({ path: `file-${i}<>&\".txt`, added: 1, deleted: 0 }))
  const state: GraphState = {
    branches: [], branch: '', remote: true, current: 'main',
    commits: [{ hash, parents: [], author: 'Test', timestamp: 1, subject: 'Commit', refs: [] }],
    hasMore: true, start: 0, busy: false, error: '',
    detail: { hash, parents: [], author: 'Test', authorEmail: 'test@example.test', committer: 'Test', committerEmail: 'test@example.test', date: '2026-10-20', message: '<script>' + 'x'.repeat(4500), files },
    diff: { path: files[0]!.path, text: '@@ -1 +1 @@\n-<script>\n+<img>\n', isCut: true, isTooLarge: false },
  }
  const html = renderGraph(state)
  assert.match(html, /file-0&lt;&gt;&amp;&quot;\.txt/)
  assert.doesNotMatch(html, /file-50/)
  assert.match(html, /and 1 more files/)
  assert.match(html, /Message truncated/)
  assert.match(html, /Diff truncated/)
  assert.doesNotMatch(html, /<script>|<img>/)
  assert.match(html, /Close diff/)
  assert.match(html, /Load more/)
  const busy = renderGraph({ ...state, busy: true })
  assert.match(busy, /id="branch" disabled/)
})
