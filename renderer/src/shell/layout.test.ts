import { describe, expect, it } from 'vitest'
import { fitSides, sideWidth } from './layout'

describe('shell layout', () => {
  it('collapses the context sidebar before the document becomes too narrow', () => {
    expect(fitSides(1600, 220, 240, true, true)).toEqual({ navOpen: true, contextOpen: true })
    expect(fitSides(960, 220, 240, true, true)).toEqual({ navOpen: true, contextOpen: false })
    expect(fitSides(800, 220, 240, true, true)).toEqual({ navOpen: false, contextOpen: false })
  })

  it('stops a drag before the document column shrinks below the floor', () => {
    expect(sideWidth(400, 240, 1600)).toBe(360)
    expect(sideWidth(100, 240, 1600)).toBe(180)
    expect(sideWidth(300, 240, 900)).toBeNull()
  })
})
