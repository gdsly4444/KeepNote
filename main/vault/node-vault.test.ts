import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createNodeVault } from './index'

const roots: string[] = []

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

describe('createNodeVault', () => {
  it('lists every file, reads only markdown, and saves without a partial file', async () => {
    const root = await makeRoot()
    await writeFile(join(root, 'Readme.MD'), 'hello\r\n')
    await mkdir(join(root, 'notes'))
    await writeFile(join(root, 'notes', 'deep.md'), '# 深\n')
    await writeFile(join(root, 'brief.pdf'), 'binary')
    await writeFile(join(root, 'draft.md.keepnote-tmp'), 'partial')
    const vault = createNodeVault()

    const files = await vault.listFiles(root)
    expect(files.map((file) => file.path)).toEqual(['brief.pdf', 'notes/deep.md', 'Readme.MD'])
    expect(files.find((file) => file.name === 'brief.pdf')?.markdown).toBe(false)
    expect(files.find((file) => file.name === 'Readme.MD')?.markdown).toBe(true)
    expect(await vault.readMarkdown(root, 'Readme.MD')).toBe('hello\n')
    await expect(vault.readMarkdown(root, 'brief.pdf')).rejects.toThrow('读不到 brief.pdf')
    await expect(vault.readMarkdown(root, '../outside.md')).rejects.toThrow('读不到 ../outside.md')

    await vault.writeMarkdown(root, 'Readme.MD', 'saved\r\ntext')
    expect(await readFile(join(root, 'Readme.MD'), 'utf8')).toBe('saved\ntext')
    expect(await vault.readMarkdown(root, 'notes/deep.md')).toBe('# 深\n')
    expect(await vault.listFiles(root)).toHaveLength(3)
  })

  it('creates the parent directories of a new note and still refuses a path outside the vault', async () => {
    const root = await makeRoot()
    const vault = createNodeVault()
    await vault.writeMarkdown(root, 'work/2026/11/2026-11-14.md', '# 2026-11-14\r\n')
    expect(await vault.readMarkdown(root, 'work/2026/11/2026-11-14.md')).toBe('# 2026-11-14\n')
    await expect(vault.writeMarkdown(root, '../outside.md', 'x')).rejects.toThrow('读不到 ../outside.md')
  })

  it('lists a symlink and does not follow one that leaves the vault', async () => {
    const root = await makeRoot()
    const outside = await makeRoot()
    await writeFile(join(outside, 'secret.md'), 'secret')
    await symlink(join(outside, 'secret.md'), join(root, 'secret.md'))
    const files = await createNodeVault().listFiles(root)
    expect(files).toEqual([{ path: 'secret.md', name: 'secret.md', markdown: false }])
    await expect(createNodeVault().readMarkdown(root, 'secret.md')).rejects.toThrow('读不到 secret.md')
  })

  it('reports added, changed, and removed files', async () => {
    const root = await makeRoot()
    const file = join(root, 'note.md')
    let changes = 0
    const stop = createNodeVault().watch(root, () => {
      changes += 1
    })
    try {
      await writeFile(file, 'one')
      await waitFor(() => changes > 0)
      changes = 0
      await writeFile(file, 'two')
      await waitFor(() => changes > 0)
      changes = 0
      await rm(file)
      await waitFor(() => changes > 0)
    } finally {
      stop()
    }
  })
})

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'keepnote-'))
  roots.push(root)
  return root
}

async function waitFor(ready: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000
  while (!ready()) {
    if (Date.now() > deadline) throw new Error('没有等到文件变化')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}
