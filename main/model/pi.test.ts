import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createPiModel } from './index'

describe('createPiModel', () => {
  it('stops before any provider call when the key is missing', async () => {
    const model = createPiModel({})
    await expect(model.complete({
      messages: [{ role: 'user', text: '你好' }],
      signal: new AbortController().signal,
      onText: () => undefined
    })).rejects.toThrow('模型不可用')
  })

  it('is the only place that names the provider package or the key', () => {
    const root = join(import.meta.dirname, '..', '..')
    const hits = scan(root, ['@earendil-works/pi-ai', 'KEEPNOTE_API_KEY'])
    expect(hits).toEqual(['main/model/pi.ts'])
  })
})

function scan(root: string, needles: readonly string[]): string[] {
  const found: string[] = []
  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === 'out' || entry.name === 'dist') continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        walk(path)
        continue
      }
      if (!/\.(ts|tsx|mjs|js)$/.test(entry.name) || entry.name.endsWith('.test.ts')) continue
      const text = readFileSync(path, 'utf8')
      if (needles.some((needle) => text.includes(needle))) {
        found.push(path.slice(root.length + 1).replaceAll('\\', '/'))
      }
    }
  }
  walk(root)
  return found.sort()
}
