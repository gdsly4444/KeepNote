import boundaries from 'eslint-plugin-boundaries'
import tseslint from 'typescript-eslint'

const entry = 'index.ts'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'out/**',
      'dist/**',
      'scripts/**',
      'docs/**',
      'main/fixtures/**',
      'renderer/fixtures/**'
    ]
  },
  {
    files: ['main/**/*.ts', 'preload/**/*.ts', 'renderer/**/*.ts', 'renderer/**/*.tsx', 'shared/**/*.ts'],
    plugins: { boundaries },
    languageOptions: {
      parser: tseslint.parser
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.ts', '.tsx', '.js', '.jsx']
        }
      },
      'boundaries/elements': [
        { type: 'module', pattern: 'main/*', partialMatch: false },
        { type: 'module', pattern: 'renderer/src/*', partialMatch: false },
        { type: 'layer', pattern: 'main', partialMatch: false },
        { type: 'layer', pattern: 'preload', partialMatch: false },
        { type: 'layer', pattern: 'renderer', partialMatch: false },
        { type: 'layer', pattern: 'shared', partialMatch: false }
      ]
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'disallow',
          policies: [
            { allow: { to: { module: { origin: ['external', 'core'] } } } },
            { allow: { dependency: { relationship: { to: 'internal' } } } },
            {
              from: { element: { path: ['main', 'main/*'] } },
              allow: { to: { element: { path: 'main/*', fileInternalPath: entry } } }
            },
            {
              from: { element: { path: ['renderer', 'renderer/src/*'] } },
              allow: { to: { element: { path: 'renderer/src/*', fileInternalPath: entry } } }
            },
            {
              from: { element: { path: ['main', 'main/*', 'preload', 'renderer', 'renderer/src/*'] } },
              allow: { to: { element: { path: 'shared', fileInternalPath: entry } } }
            }
          ]
        }
      ]
    }
  }
)
