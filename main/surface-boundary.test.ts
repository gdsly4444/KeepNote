import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('document pages', () => {
  it('keeps one page from importing another page', () => {
    const pages = ['essay', 'work', 'journal', 'list', 'tech']
    for (const page of pages) {
      const directory = join('renderer', 'src', page)
      const source = readdirSync(directory)
        .map((name) => readFileSync(join(directory, name), 'utf8'))
        .join('\n')
      for (const other of pages) {
        if (other === page) continue
        expect(source, `${page} -> ${other}`).not.toContain(`../${other}`)
      }
    }
  })
})