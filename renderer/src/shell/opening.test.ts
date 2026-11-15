import { describe, expect, it } from 'vitest'
import { chooseOpening } from './opening'

describe('chooseOpening', () => {
  it('restores the document left open today and otherwise opens today', () => {
    const paths = ['命令.md', 'work/2026/11/2026-11-14.md']
    expect(chooseOpening({
      paths,
      desk: { today: '2026-11-14', day: '2026-11-14', path: '命令.md' }
    })).toEqual({ action: 'restore', path: '命令.md' })
    expect(chooseOpening({
      paths,
      desk: { today: '2026-11-15', day: '2026-11-14', path: '命令.md' }
    })).toEqual({ action: 'today' })
    expect(chooseOpening({ paths, desk: null })).toEqual({ action: 'today' })
  })
})
