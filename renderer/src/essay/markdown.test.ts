import { describe, expect, it } from 'vitest'
import { essayFixture } from './fixture'
import { blockIndexAt, blockOffset, joinDocument, lineIndexAt, offsetOfLine, parseContent, serializeDocument, splitFrontmatter } from '../prose'

describe('essay markdown', () => {
  it('keeps a fixed note identical after parsing', () => {
    const parts = splitFrontmatter(essayFixture)
    const parsed = parseContent(parts.content)
    expect(joinDocument(parts.head, serializeDocument(parsed.doc))).toBe(essayFixture)
  })

  it('points at the same block from either side', () => {
    const parts = splitFrontmatter(essayFixture)
    const section = blockOffset(parts.content, 2)
    expect(parts.content.slice(section.offset, section.offset + 6)).toBe('## 第二节')
    expect(blockIndexAt(parts.content, section.offset + 3)).toBe(2)
    expect(blockIndexAt(parts.content, 0)).toBe(0)
    const banana = parts.content.indexOf('- 香蕉')
    const line = lineIndexAt(parts.content, banana + 2)
    expect(parts.content.slice(offsetOfLine(parts.content, line)).startsWith('- 香蕉')).toBe(true)
    expect(line).not.toBe(lineIndexAt(parts.content, parts.content.indexOf('- 苹果')))
  })
})
