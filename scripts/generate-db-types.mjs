import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const projectId = process.env.SUPABASE_PROJECT_ID

if (!projectId) {
  console.error('SUPABASE_PROJECT_ID fehlt. Bitte zuerst in .env.local setzen.')
  process.exit(1)
}

const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const outputFile = resolve('src/lib/types/database.types.ts')

try {
  const stdout = execFileSync(
    npxCommand,
    ['supabase', 'gen', 'types', 'typescript', '--project-id', projectId],
    {
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'inherit'],
      env: process.env,
    }
  )

  mkdirSync(dirname(outputFile), { recursive: true })
  writeFileSync(outputFile, stdout)
  console.log(`TypeScript-Typen geschrieben nach ${outputFile}`)
} catch (error) {
  console.error('Fehler beim Generieren der Supabase-Typen.')
  process.exit(error?.status ?? 1)
}
