import { describe, expect, it } from 'vitest'
import { readCommandLine } from './read'

describe('readCommandLine', () => {
  it('reads note commands and refuses anything that is not one', () => {
    expect(readCommandLine('today')).toEqual({ command: 'today', args: {} })
    expect(readCommandLine('log 修了登录跳转')).toEqual({ command: 'log', args: { text: '修了登录跳转' } })
    expect(readCommandLine('new list 打包')).toEqual({ command: 'new', args: { type: 'list', title: '打包' } })
    expect(readCommandLine('open work/2026/11/2026-11-14.md')).toEqual({
      command: 'open',
      args: { path: 'work/2026/11/2026-11-14.md' }
    })
    expect(readCommandLine('ls -la')).toBeNull()
    expect(readCommandLine('rm -rf /')).toBeNull()
    expect(readCommandLine('today 多余')).toBeNull()
  })
})
