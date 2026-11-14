import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: {
    build: {
      rolldownOptions: {
        input: resolve('main/index.ts')
      }
    }
  },
  preload: {
    build: {
      rolldownOptions: {
        input: resolve('preload/index.ts')
      }
    }
  },
  renderer: {
    root: resolve('renderer'),
    plugins: [react()],
    build: {
      rolldownOptions: {
        input: resolve('renderer/index.html')
      }
    }
  }
})
