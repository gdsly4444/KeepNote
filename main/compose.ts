import { app, BrowserWindow, ipcMain, type WebContents } from 'electron'
import { join } from 'node:path'
import type { CommandName, CommandResult, QueryName } from '../shared'
import { quitsWhenLastWindowCloses } from './platform'

const unknownCommand: CommandResult = { ok: false, code: 'unknown-command', message: '未知命令' }

let mainWindow: BrowserWindow | null = null

export function startApp(): void {
  registerBridge()

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

function registerBridge(): void {
  ipcMain.handle('keepnote:run', (event, command: CommandName) => {
    return runCommand(event.sender, command)
  })
  ipcMain.handle('keepnote:query', (_event, name: QueryName) => {
    return runQuery(name)
  })
}

function runCommand(sender: WebContents, command: CommandName): CommandResult {
  if (command !== 'ping') return unknownCommand
  sender.send('keepnote:event:ready')
  return { ok: true }
}

function runQuery(name: QueryName): CommandResult {
  if (name !== 'ping') return unknownCommand
  return { ok: true }
}
