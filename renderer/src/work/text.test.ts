import { describe, expect, it } from 'vitest'
import { fieldForLine, lineForField, parseWork, serializeWork, sourceLineAt } from './text'

const sample = [
  '---',
  'type: work',
  '---',
  '',
  '# 2026-11-14',
  '',
  '## 在做',
  '',
  '登录跳转',
  '',
  '## 记录',
  '',
  '- 10:12 修了登录跳转 [[登录跳转]]',
  '- 15:40 把打包清单收成三组 [[本周打包]]',
  '',
  '## 产出',
  '',
  '- [[登录跳转]]',
  '- [[本周打包]]',
  '',
  '## 留下',
  '',
  '- [ ] 补空状态',
  ''
].join('\n')

describe('work note', () => {
  it('keeps the four sections and the sample text', () => {
    expect(serializeWork(parseWork(sample))).toBe(sample)
    const note = parseWork(sample.replace('## 产出', '## 23:11\n\n## 产出'))
    expect(note.records.some((record) => record.kind === 'raw' && record.text === '## 23:11')).toBe(true)
    expect(serializeWork(note).match(/^## .+$/gm)).toEqual(['## 在做', '## 记录', '## 23:11', '## 产出', '## 留下'])
  })

  it('points a source line back at the same section', () => {
    const text = serializeWork(parseWork(sample))
    const lines = text.split('\n')
    expect(fieldForLine(text, sourceLineAt(text, text.indexOf('登录跳转')))).toEqual({ section: 'doing', index: 0 })
    expect(fieldForLine(text, sourceLineAt(text, text.indexOf('- [ ] 补空状态')))).toEqual({ section: 'left', index: 0 })
    expect(lines[lineForField(text, { section: 'left', index: 0 })]).toBe('- [ ] 补空状态')
    expect(lines[lineForField(text, { section: 'record', index: 1 })]).toContain('15:40')
  })
})
