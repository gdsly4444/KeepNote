import { watch } from 'node:fs'
import type { Dirent } from 'node:fs'
import { open, readdir, readFile, realpath, rename, rm } from 'node:fs/promises'
import { contractPath, joinPath, normalizeNewlines, resolveInside } from '../platform'
import { writeAtomic, type AtomicIO } from './atomic'
import { isMarkdownName, isTemporaryName, type ListedFile, type VaultStore } from './types'

const nodeIO: AtomicIO = {
  async writeFile(path, text) {
    const handle = await open(path, 'w')
    try {
      await handle.writeFile(text, 'utf8')
      await handle.sync()
    } finally {
      await handle.close()
    }
  },
  rename,
  remove(path) {
    return rm(path, { force: true })
  }
}

export function createNodeVault(): VaultStore {
  return {
    listFiles,
    readMarkdown,
    writeMarkdown,
    watch: watchVault
  }
}

async function listFiles(root: string): Promise<ListedFile[]> {
  const found: ListedFile[] = []
  await walk(root, root, found)
  found.sort((left, right) => comparePath(left.path, right.path))
  return found
}

async function walk(root: string, directory: string, found: ListedFile[]): Promise<void> {
  let entries: Dirent[]
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    throw new Error('这个文件夹读不了')
  }
  for (const entry of entries) {
    if (isTemporaryName(entry.name)) continue
    const absolute = joinPath(directory, entry.name)
    if (entry.isDirectory()) {
      await walk(root, absolute, found)
      continue
    }
    if (entry.isSymbolicLink()) {
      found.push(await listedSymlink(root, absolute, entry.name))
      continue
    }
    if (!entry.isFile()) continue
    found.push(listed(root, absolute, entry.name, true))
  }
}

async function listedSymlink(root: string, absolute: string, name: string): Promise<ListedFile> {
  const real = await realpath(absolute).catch(() => null)
  const inside = real !== null && resolveInside(root, contractPath(root, real)) !== null
  return listed(root, absolute, name, inside)
}

function listed(root: string, absolute: string, name: string, readable: boolean): ListedFile {
  return {
    path: contractPath(root, absolute),
    name,
    markdown: readable && isMarkdownName(name)
  }
}

async function readMarkdown(root: string, relativePath: string): Promise<string> {
  const absolute = markdownInside(root, relativePath)
  try {
    const real = await realpath(absolute)
    if (resolveInside(root, contractPath(root, real)) === null) throw new Error('outside')
    return normalizeNewlines(await readFile(real, 'utf8'))
  } catch {
    throw new Error(`读不到 ${relativePath}`)
  }
}

async function writeMarkdown(root: string, relativePath: string, text: string): Promise<void> {
  const absolute = markdownInside(root, relativePath)
  try {
    await writeAtomic(absolute, text, nodeIO)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('读不到')) throw error
    throw new Error(`写不了 ${relativePath}`)
  }
}

function markdownInside(root: string, relativePath: string): string {
  const absolute = resolveInside(root, relativePath)
  if (!absolute || !isMarkdownName(relativePath)) throw new Error(`读不到 ${relativePath}`)
  return absolute
}

function watchVault(root: string, onChange: () => void): () => void {
  const watcher = watch(root, { recursive: true })
  const notify = (): void => {
    onChange()
  }
  watcher.on('change', notify)
  watcher.on('error', notify)
  return () => {
    watcher.close()
  }
}

function comparePath(left: string, right: string): number {
  const a = left.toLowerCase()
  const b = right.toLowerCase()
  if (a < b) return -1
  if (a > b) return 1
  return 0
}
