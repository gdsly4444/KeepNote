import { app } from 'electron'
import { startApp } from './compose'

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  startApp()
}
