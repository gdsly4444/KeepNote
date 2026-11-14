import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['main/**/*.test.ts', 'renderer/**/*.test.ts', 'renderer/**/*.test.tsx'],
    environment: 'node'
  }
})
