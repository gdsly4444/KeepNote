import { spawnSync } from 'node:child_process'

const fixtures = [
  'main/fixtures/illegal-platform-import.ts',
  'renderer/fixtures/illegal-main-import.ts'
]

for (const file of fixtures) {
  const result = spawnSync('node_modules/.bin/eslint', ['--no-ignore', file], { stdio: 'pipe', encoding: 'utf8' })
  if (result.status === 0) {
    console.error(`${file} 应当被边界检查拒绝`)
    process.exit(1)
  }
  const output = `${result.stdout}\n${result.stderr}`
  if (!output.includes('boundaries/')) {
    console.error(`${file} 失败了，但不是因为边界规则：\n${output}`)
    process.exit(1)
  }
}

console.log('边界检查会拒绝跨层引用和绕过模块入口')
