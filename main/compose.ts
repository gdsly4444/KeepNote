import { app, BrowserWindow, dialog, ipcMain, type WebContents } from 'electron'
import { join } from 'node:path'
import type { BridgeResult, CommandArgs, CommandName, CommandSuccess, LibraryStatus, QueryName } from '../shared'
import { createCommandRegistry, systemClock, type CommandRegistry } from './commands'
import { parseMarkdown } from './documents'
import { createLibrarySession, type LibrarySession } from './library'
import { quitsWhenLastWindowCloses } from './platform'
import { createNodeVault } from './vault'

const unknownCommand: BridgeResult<null> = { ok: false, code: 'unknown-command', message: '未知命令' }

let mainWindow: BrowserWindow | null = null

export function startApp(): void {
  const vault = createNodeVault()
  const session = createLibrarySession(vault, parseMarkdown)
  const commands = createCommandRegistry({
    notes: vault,
    parse: parseMarkdown,
    root: () => session.location(),
    clock: systemClock()
  })
  registerBridge(session, commands)
  app.on('before-quit', () => {
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

  void app.whenReady().then(() => {
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

function registerBridge(session: LibrarySession, commands: CommandRegistry): void {
  ipcMain.handle('keepnote:run', (event, command: CommandName, args?: CommandArgs) => {
    return runCommand(event.sender, command, args, session, commands)
  })
  ipcMain.handle('keepnote:query', (_event, name: QueryName) => {
    return runQuery(name, session)
  })
  session.subscribe(() => {
    const contents = mainWindow?.webContents
    if (!contents || contents.isDestroyed()) return
    contents.send('keepnote:event:library-changed')
  })
}

async function runCommand(
  sender: WebContents,
  command: CommandName,
  args: CommandArgs | undefined,
  session: LibrarySession,
  commands: CommandRegistry
): Promise<BridgeResult<CommandSuccess | null>> {
  if (command === 'ping') {
    sender.send('keepnote:event:ready')
    return { ok: true, value: null }
  }
  if (command === 'open-library') return session.open(await chooseDirectory())
  return commands.execute(command, args)
}

async function runQuery(
  name: QueryName,
  session: LibrarySession
): Promise<BridgeResult<LibraryStatus | null>> {
  if (name === 'ping') return { ok: true, value: null }
  if (name === 'library') return { ok: true, value: await session.current() }
  return unknownCommand
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
