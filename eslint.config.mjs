import nextVitals from 'eslint-config-next/core-web-vitals'

const config = [
  ...nextVitals,
  {
    rules: {
      // New in eslint-config-next 16 (react-hooks 7). It flags setState calls in
      // effects, which cost an extra render but behave correctly. 23 places do
      // this today; they're on the backlog rather than rewritten in the Next 16
      // upgrade.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    ignores: ['.next/**', 'node_modules/**', 'public/ffmpeg/**', 'next-env.d.ts'],
  },
]

export default config
