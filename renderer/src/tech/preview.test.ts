import { describe, expect, it } from 'vitest'
import { previewBlocks } from './preview'

describe('tech preview', () => {
  it('keeps code, tables, and prose as separate blocks', () => {
    const source = [
      '---',
      'type: tech',
      '---',
      '',
      '# 命令',
      '',
      '把端口转发出去。',
      '',
      '```sh',
      'ls',
      '```',
      '',
      '| 名称 | 值 |',
      '| --- | --- |',
      '| 端口 | 8080 |',
      ''
    ].join('\n')
    expect(previewBlocks(source)).toEqual([
      { kind: 'heading', level: 1, text: '命令' },
      { kind: 'paragraph', text: '把端口转发出去。' },
      { kind: 'code', language: 'sh', text: 'ls' },
      { kind: 'table', rows: [['名称', '值'], ['端口', '8080']] }
    ])
  })
})