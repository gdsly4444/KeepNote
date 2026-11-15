import { describe, expect, it } from 'vitest'
import { completeLine } from './complete'

describe('completeLine', () => {
  const notes = [{ title: '登录跳转', name: '登录.md' }]

  it('completes commands, types, and note names', () => {
    expect(completeLine('op', notes)).toEqual([{ kind: 'command', label: 'open', value: 'open ' }])
    expect(completeLine('登', notes)).toEqual([{ kind: 'note', label: '登录跳转', value: 'open 登录跳转' }])
    expect(completeLine('new l', notes).map((item) => item.label)).toEqual(['list'])
    expect(completeLine('new ', notes).map((item) => item.label)).toEqual(['essay', 'journal', 'list', 'tech', 'work'])
    expect(completeLine('open 登', notes)).toEqual([{ kind: 'note', label: '登录跳转', value: 'open 登录跳转' }])
    expect(completeLine('accept 登', notes)).toEqual([{ kind: 'note', label: '登录跳转', value: 'accept 登录跳转' }])
    expect(completeLine('log 登', notes)).toEqual([])
    expect(completeLine('rm', notes)).toEqual([])
  })
})