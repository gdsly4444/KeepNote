export const documentFloor = 720
export const sideMin = 180
export const sideMax = 360

export function fitSides(
  viewport: number,
  nav: number,
  context: number,
  navOpen: boolean,
  contextOpen: boolean
): { navOpen: boolean; contextOpen: boolean } {
  const navSpace = navOpen ? nav : 0
  const contextSpace = contextOpen ? context : 0
  if (viewport - navSpace - contextSpace >= documentFloor) return { navOpen, contextOpen }
  if (contextOpen) return fitSides(viewport, nav, context, navOpen, false)
  if (navOpen) return { navOpen: false, contextOpen: false }
  return { navOpen: false, contextOpen: false }
}

export function sideWidth(requested: number, other: number, viewport: number): number | null {
  const room = viewport - other - documentFloor
  if (room < sideMin) return null
  return Math.min(Math.max(requested, sideMin), Math.min(sideMax, room))
}
