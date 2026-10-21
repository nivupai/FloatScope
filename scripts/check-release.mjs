// Read-only build verification. Does not contact GitHub or deploy anything.
import { strict as assert } from 'node:assert'
import { readFileSync, statSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { resolve, sep } from 'node:path'
import console from 'node:console'

const root = fileURLToPath(new URL('../', import.meta.url))
const directory = resolve(root, 'dist')
const html = readFileSync(resolve(directory, 'index.html'), 'utf8')
const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const lock = JSON.parse(
  readFileSync(resolve(root, 'package-lock.json'), 'utf8'),
)
assert.equal(manifest.name, 'fp-play')
assert.equal(manifest.version, lock.version)
assert.equal(manifest.version, lock.packages[''].version)
assert.match(html, /<title>FP Play[^<]*<\/title>/)
assert.match(html, /<noscript\s*>/)
const assets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
  .map(([, path]) => path)
  .filter((path) => !/^(https?:|data:|#)/.test(path))
assert(
  assets.some((path) => path.endsWith('.js')),
  'Missing application JavaScript',
)
assert(
  assets.some((path) => path.endsWith('.css')),
  'Missing application CSS',
)
assert(
  assets.some((path) => path.endsWith('favicon.svg')),
  'Missing favicon',
)
for (const asset of assets) {
  assert(
    asset.startsWith('/fp-play/'),
    `Incorrect GitHub Pages asset path: ${asset}`,
  )
  const file = resolve(directory, asset.slice('/fp-play/'.length))
  assert(file.startsWith(directory + sep), 'Asset escapes the build directory')
  assert(statSync(file).isFile(), `Missing built asset: ${asset}`)
}
console.log(
  `Release ${manifest.version}: ${assets.length} built assets verified under /fp-play/. No deployment performed.`,
)
