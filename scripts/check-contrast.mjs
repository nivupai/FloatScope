// Static WCAG contrast checks for the actual theme tokens, not a rendered-page audit.
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { URL } from 'node:url'
import console from 'node:console'

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8')
function palette(selector) {
  const start = css.indexOf(selector + ' {')
  assert(start >= 0, `Missing palette ${selector}`)
  const block = css.slice(start, css.indexOf('}', start))
  return Object.fromEntries(
    [...block.matchAll(/--([\w-]+):\s*(#[\da-f]{6})/gi)].map(
      ([, token, color]) => [token, color],
    ),
  )
}
function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((value) => Number.parseInt(value, 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    )
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}
function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const light = palette('.app-shell'),
  dark = palette(".app-shell[data-theme='dark']")
const systemDark = palette(".app-shell[data-theme='system']")
for (const [token, value] of Object.entries(dark))
  assert.equal(systemDark[token], value, `System-dark token ${token} drifted`)
let checks = 0,
  minimumText = Infinity,
  minimumControl = Infinity
for (const [name, colors] of [
  ['light', light],
  ['dark', dark],
]) {
  const check = (foreground, background, required, text) => {
    assert(
      colors[foreground] && colors[background],
      `Missing ${name} ${foreground}/${background}`,
    )
    const ratio = contrast(colors[foreground], colors[background])
    assert(
      ratio >= required,
      `${name} ${foreground}/${background}: ${ratio.toFixed(2)} < ${required}`,
    )
    if (text) minimumText = Math.min(minimumText, ratio)
    else minimumControl = Math.min(minimumControl, ratio)
    checks++
  }
  for (const foreground of ['text', 'muted'])
    for (const background of [
      'bg',
      'surface',
      'subtle',
      'accent-bg',
      'sign-bg',
      'exponent-bg',
      'fraction-bg',
    ])
      check(foreground, background, 4.5, true)
  for (const field of ['accent', 'sign', 'exponent', 'fraction']) {
    check(field, `${field}-bg`, 4.5, true)
    check(field, 'surface', 4.5, true)
    check('surface', field, 4.5, true) // Pressed bits use the surface color as text.
  }
  check('accent-contrast', 'accent', 4.5, true)
  check('error', 'surface', 4.5, true)
  check('error', 'subtle', 4.5, true)
  for (const background of ['surface', 'subtle'])
    check('control-border', background, 3, false)
  for (const background of [
    'surface',
    'subtle',
    'accent-bg',
    'sign-bg',
    'exponent-bg',
    'fraction-bg',
  ])
    check('accent', background, 3, false)
}
console.log(
  `${checks} theme-token contrast checks passed; text minimum ${minimumText.toFixed(2)}:1, control/focus minimum ${minimumControl.toFixed(2)}:1. Browser rendering remains a separate check.`,
)
