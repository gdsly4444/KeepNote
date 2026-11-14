import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { CommandArgs, CommandName, EventName, KeepNoteBridge, QueryName } from '../shared'

const bridge: KeepNoteBridge = {
  run(command: CommandName, args?: CommandArgs) {
    return ipcRenderer.invoke('keepnote:run', command, args)
  },
  query(name: QueryName) {
    return ipcRenderer.invoke('keepnote:query', name)
  },
  subscribe(event: EventName, listener: () => void): () => void {
    const channel = `keepnote:event:${event}`
    const wrapped = (_ipcEvent: IpcRendererEvent): void => {
      listener()
    }
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  }
}

contextBridge.exposeInMainWorld('keepnote', bridge)
