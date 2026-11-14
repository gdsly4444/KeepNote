import path from 'node:path'

type PathApi = Pick<typeof path, 'resolve' | 'relative' | 'sep' | 'isAbsolute'>

export function samePath(left: string, right: string): boolean {
  return canonicalPath(left) === canonicalPath(right)
}

export function canonicalPath(value: string): string {
  return value.replace(/[\\/]+/g, '/').replace(/^\.\//, '').replace(/\/+$/g, '').toLowerCase()
}

export function resolveInsideWith(root: string, relative: string, api: PathApi): string | null {
  if (relative.includes('\0')) return null
  const base = api.resolve(root)
  const target = api.resolve(base, relative)
  const fromBase = api.relative(base, target)
  if (fromBase === '' || fromBase.split(api.sep).includes('..') || api.isAbsolute(fromBase)) return null
  return target
}

export function resolveInside(root: string, relative: string): string | null {
  return resolveInsideWith(root, relative, path)
}

export function contractPathWith(root: string, absolute: string, api: PathApi): string {
  return api.relative(api.resolve(root), api.resolve(absolute)).split(api.sep).join('/')
}

export function contractPath(root: string, absolute: string): string {
  return contractPathWith(root, absolute, path)
}

export function joinPath(...parts: string[]): string {
  return path.join(...parts)
}
