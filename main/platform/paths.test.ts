import { posix, win32 } from 'node:path'
import { describe, expect, it } from 'vitest'
import { contractPathWith, resolveInsideWith, samePath } from './paths'

describe('samePath', () => {
  it('treats separators and case as the same path', () => {
    expect(samePath('Notes/Readme.MD', 'notes\\readme.md')).toBe(true)
    expect(samePath('./notes/a.md', 'notes/a.md')).toBe(true)
    expect(samePath('notes/a.md', 'notes/b.md')).toBe(false)
  })
})

describe('resolveInside', () => {
  it('keeps a relative file inside the vault on both path APIs', () => {
    expect(resolveInsideWith('/vault', 'notes/a.md', posix)).toBe('/vault/notes/a.md')
    expect(resolveInsideWith('C:\\vault', 'notes\\a.md', win32)).toBe('C:\\vault\\notes\\a.md')
  })

  it('rejects a path that leaves the vault', () => {
    expect(resolveInsideWith('/vault', '../secret.md', posix)).toBeNull()
    expect(resolveInsideWith('C:\\vault', '..\\secret.md', win32)).toBeNull()
    expect(resolveInsideWith('/vault', '/etc/passwd', posix)).toBeNull()
    expect(resolveInsideWith('C:\\vault', 'D:\\secret.md', win32)).toBeNull()
  })
})

describe('contractPath', () => {
  it('uses forward slashes and keeps the original casing', () => {
    expect(contractPathWith('/vault', '/vault/Notes/Readme.MD', posix)).toBe('Notes/Readme.MD')
    expect(contractPathWith('C:\\vault', 'C:\\vault\\Notes\\Readme.MD', win32)).toBe('Notes/Readme.MD')
  })
})
