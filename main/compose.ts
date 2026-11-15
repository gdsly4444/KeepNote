import { app, BrowserWindow, dialog, ipcMain, type WebContents } from 'electron'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { BridgeResult, ChangedView, CommandArgs, CommandName, CommandSuccess, DeskView, QueryArgs, QueryName } from '../shared'
import { classifyChanged, completeLine, createCommandRegistry, outputTitles, systemClock, workPathFor, type CommandClock, type CommandRegistry } from './commands'
import { parseMarkdown } from './documents'
import { createNoteIndex, followLibrary, type NoteIndex } from './index/index'
import { createDeskStore, createLibrarySession, type DeskStore, type LibrarySession } from './library'
import { baseName, quitsWhenLastWindowCloses } from './platform'
import { createNodeVault, type VaultStore } from './vault'

const unknownCommand: BridgeResult<null> = { ok: false, code: 'unknown-command', message: '未知命令' }

let mainWindow: BrowserWindow | null = null

export function startApp(): void {
  const vault = createNodeVault()
  const session = createLibrarySession(vault, parseMarkdown)
  const clock = systemClock()
  const desk = createDeskStore(join(app.getPath('userData'), 'desk.json'), {
    read(path) {
      try {
        return readFileSync(path, 'utf8')
      } catch {
        return null
      }
    },
    write(path, text) {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, text)
    }
  })
  const indexFile = join(app.getPath('userData'), 'index.sqlite')
  mkdirSync(dirname(indexFile), { recursive: true })
  const noteIndex = createNoteIndex({
    file: indexFile,
    source: {
      async list() {
        const root = session.location()
        if (!root) return []
        return (await vault.listFiles(root))
          .filter((file) => file.markdown)
          .map((file) => ({ path: file.path, name: file.name, mtimeMs: file.modifiedMs }))
      },
      read(path) {
        const root = session.location()
        if (!root) return Promise.reject(new Error('还没有打开库'))
        return vault.readMarkdown(root, path)
      }
    },
    titles(file, source) {
      const parsed = parseMarkdown(file, source)
      return { title: parsed.title, type: parsed.type }
    }
  })
  const commands = createCommandRegistry({
    notes: vault,
    parse: parseMarkdown,
    root: () => session.location(),
    clock,
    index: noteIndex
  })
  followLibrary(session, noteIndex)
  registerBridge(session, commands, desk, clock, noteIndex, vault)
  app.on('before-quit', () => {
    noteIndex.close()
    session.close()
  })

  app.on('second-instance', () => {
    if (app.isReady()) revealWindow()
  })

  app.on('window-all-closed', () => {
    if (quitsWhenLastWindowCloses()) app.quit()
  })

  app.on('activate', () => {
    if (app.isReady()) revealWindow()
  })

  void app.whenReady().then(async () => {
    const saved = desk.read()
    if (saved.root) await session.open(saved.root)
    await noteIndex.refresh()
    createWindow()
  })
}

function revealWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 960,
    height: 640,
    show: false,
    title: 'KeepNote',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow = window
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  window.webContents.on('did-fail-load', (_event, code, description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3 || window.isDestroyed()) return
    console.error('页面没有载入', description)
    window.show()
  })

  let reloadedAfterCrash = false
  window.webContents.on('render-process-gone', (_event, details) => {
    if (details.reason === 'clean-exit' || window.isDestroyed() || reloadedAfterCrash) return
    reloadedAfterCrash = true
    console.error('渲染进程退出', details.reason)
    window.webContents.reload()
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    void window.loadURL(rendererUrl)
  } else {
    void window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

function registerBridge(
  session: LibrarySession,
  commands: CommandRegistry,
  desk: DeskStore,
  clock: CommandClock,
  noteIndex: NoteIndex,
  vault: VaultStore
): void {
  ipcMain.handle('keepnote:run', (event, command: CommandName, args?: CommandArgs) => {
    return runCommand(event.sender, command, args, session, commands, desk, clock)
  })
  ipcMain.handle('keepnote:query', (_event, name: QueryName, args?: QueryArgs) => {
    return runQuery(name, args, session, desk, clock, noteIndex, vault)
  })
  session.subscribe(() => {
    const contents = mainWindow?.webContents
    if (!contents || contents.isDestroyed()) return
    contents.send('keepnote:event:library-changed')
  })
}

const opensDocument = new Set<CommandName>(['today', 'diary', 'new', 'open'])

async function runCommand(
  sender: WebContents,
  command: CommandName,
  args: CommandArgs | undefined,
  session: LibrarySession,
  commands: CommandRegistry,
  desk: DeskStore,
  clock: CommandClock
): Promise<BridgeResult<CommandSuccess | null>> {
  if (command === 'ping') {
    sender.send('keepnote:event:ready')
    return { ok: true, value: null }
  }
  if (command === 'open-library') {
    const chosen = await chooseDirectory()
    const opened = await session.open(chosen)
    if (opened.ok && chosen) desk.write({ day: clock.today(), root: chosen, path: null })
    return opened
  }
  const result = await commands.execute(command, args)
  const root = session.location()
  if (result.ok && result.value && root && opensDocument.has(command)) {
    desk.write({ day: clock.today(), root, path: result.value.path })
  }
  return result
}

async function runQuery(
  name: QueryName,
  args: QueryArgs | undefined,
  session: LibrarySession,
  desk: DeskStore,
  clock: CommandClock,
  noteIndex: NoteIndex,
  vault: VaultStore
): Promise<BridgeResult<DeskView | ChangedView | Awaited<ReturnType<LibrarySession['current']>> | ReturnType<typeof completeLine> | null>> {
  if (name === 'ping') return { ok: true, value: null }
  if (name === 'library') return { ok: true, value: await session.current() }
  if (name === 'desk') {
    const saved = desk.read()
    const root = session.location()
    return { ok: true, value: { today: clock.today(), day: saved.day, name: root ? baseName(root) : '', path: saved.path } }
  }
  if (name === 'complete') return { ok: true, value: completeLine(args?.text ?? '', noteIndex.all()) }
  if (name === 'changed') return { ok: true, value: await changedToday(session, clock, noteIndex, vault) }
  return unknownCommand
}

async function changedToday(
  session: LibrarySession,
  clock: CommandClock,
  noteIndex: NoteIndex,
  vault: VaultStore
): Promise<ChangedView> {
  const root = session.location()
  if (!root) return { pending: [], accepted: [] }
  await noteIndex.refresh()
  const day = clock.today()
  const destination = workPathFor(day)
  let recorded: string[] = []
  try {
    recorded = outputTitles(await vault.readMarkdown(root, destination))
  } catch {
    recorded = []
  }
  return classifyChanged(noteIndex.changedOn(day), recorded, destination, noteIndex.all())
}

async function chooseDirectory(): Promise<string | null> {
  const options = { title: '选择库', properties: ['openDirectory' as const] }
  const result =
    mainWindow && !mainWindow.isDestroyed()
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options)
  if (result.canceled || !result.filePaths[0]) return null
  return result.filePaths[0]
}
