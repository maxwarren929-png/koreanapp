import { cp, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(projectRoot, 'dist')
const rootAssetsDir = path.join(projectRoot, 'assets')

await rm(rootAssetsDir, { recursive: true, force: true })
await cp(path.join(distDir, 'assets'), rootAssetsDir, { recursive: true })
await writeFile(path.join(projectRoot, 'index.html'), await readFile(path.join(distDir, 'index.html')))
await cp(path.join(distDir, 'favicon.svg'), path.join(projectRoot, 'favicon.svg'))
await cp(path.join(distDir, 'manifest.webmanifest'), path.join(projectRoot, 'manifest.webmanifest'))
await writeFile(path.join(projectRoot, '.nojekyll'), '')

console.log('Synced the production build to the GitHub Pages branch root.')
