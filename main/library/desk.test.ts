import { describe, expect, it } from 'vitest'
import { createDeskStore } from './desk'

describe('desk', () => {
  it('remembers the library and the document, and ignores a broken file', () => {
    const files = new Map<string, string>()
    const desk = createDeskStore('desk.json', {
      read: (path) => files.get(path) ?? null,
      write: (path, text) => {
        files.set(path, text)
      }
    })
    expect(desk.read()).toEqual({ day: '', root: null, path: null })
    desk.write({ day: '2026-11-14', root: '/vault', path: '命令.md' })
    expect(desk.read()).toEqual({ day: '2026-11-14', root: '/vault', path: '命令.md' })
    files.set('desk.json', '{')
    expect(desk.read()).toEqual({ day: '', root: null, path: null })
  })
})
