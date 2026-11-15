import { describe, expect, it } from 'vitest'
import { codeBlocks, copiedCode } from './code'

const source = '# 命令\n\n```ts\nconst answer = 1\n```\n\n```sh\nls\n```\n'

describe('tech code blocks', () => {
  it('lists each block by language and first line', () => {
    expect(codeBlocks(source)).toEqual([
      { language: 'ts', firstLine: 'const answer = 1', line: 3 },
      { language: 'sh', firstLine: 'ls', line: 7 }
    ])
  })

  it('copies a block without its fences', () => {
    const from = source.indexOf('```ts')
    const to = source.indexOf('```\n', from + 3) + 3
    expect(copiedCode(source, from, to)).toBe('const answer = 1')
    const inside = source.indexOf('const')
    expect(copiedCode(source, inside, inside + 5)).toBeNull()
  })
})
