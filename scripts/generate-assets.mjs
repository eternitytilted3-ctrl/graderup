// Generates the original placeholder artwork used by GraderUP (items, cases, logo).
// All shapes are authored here — no third-party images. Run: node scripts/generate-assets.mjs
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(process.cwd(), 'public', 'assets')
mkdirSync(join(root, 'items'), { recursive: true })
mkdirSync(join(root, 'cases'), { recursive: true })

const metal = (id, a = '#E9EEF6', b = '#8C97AB') => `
  <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/>
  </linearGradient>`
const dark = (id, a = '#3A4457', b = '#1B2130') => metal(id, a, b)

const svg = (body, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 140" fill="none">
  <defs>${metal('m')}${dark('d')}
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9C86FF"/><stop offset="1" stop-color="#4FE3FF"/></linearGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity=".45"/></filter>
    ${defs}
  </defs>
  <g filter="url(#s)">${body}</g>
</svg>
`

// Each archetype is a stylised, original silhouette.
const items = {
  blade: `
    <path d="M28 104 L132 30 Q150 20 160 24 Q156 36 140 46 L52 112 Z" fill="url(#m)"/>
    <path d="M36 102 L136 34" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
    <path d="M44 110 L30 122 Q22 126 18 118 L30 104 Z" fill="url(#d)"/>
    <rect x="40" y="98" width="20" height="8" rx="2" transform="rotate(-35 50 102)" fill="url(#acc)"/>`,
  karambit: `
    <path d="M60 110 Q40 60 90 34 Q130 18 158 40 Q124 34 104 50 Q84 66 88 104 Z" fill="url(#m)"/>
    <path d="M70 100 Q58 66 92 44" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
    <circle cx="70" cy="116" r="12" stroke="url(#acc)" stroke-width="6"/>
    <rect x="76" y="96" width="30" height="12" rx="4" transform="rotate(-20 90 102)" fill="url(#d)"/>`,
  pistol: `
    <path d="M40 44 H156 Q164 44 164 52 V62 H66 Z" fill="url(#m)"/>
    <path d="M44 52 H150" stroke="#fff" stroke-opacity=".5" stroke-width="2"/>
    <path d="M66 62 H118 L110 72 H96 L84 116 Q82 122 74 122 H58 Q52 122 54 114 Z" fill="url(#d)"/>
    <path d="M96 72 Q100 88 88 90" stroke="url(#acc)" stroke-width="4"/>
    <rect x="148" y="36" width="8" height="8" rx="1" fill="url(#acc)"/>`,
  rifle: `
    <path d="M16 58 H150 L188 54 V62 L150 66 H16 Z" fill="url(#m)"/>
    <path d="M40 66 H120 V76 H40 Z" fill="url(#d)"/>
    <path d="M78 76 L70 108 H84 L94 76 Z" fill="url(#d)"/>
    <path d="M100 76 Q104 96 118 104 L126 96 Q112 90 112 76 Z" fill="url(#m)"/>
    <path d="M16 58 L6 86 H30 L40 66 Z" fill="url(#d)"/>
    <rect x="70" y="46" width="44" height="10" rx="3" fill="url(#acc)"/>
    <path d="M20 61 H146" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>`,
  sniper: `
    <path d="M8 64 H196 V70 H8 Z" fill="url(#m)"/>
    <rect x="70" y="42" width="58" height="14" rx="7" fill="url(#d)"/>
    <circle cx="128" cy="49" r="8" fill="url(#acc)"/>
    <path d="M20 70 H104 L96 84 H20 Z" fill="url(#d)"/>
    <path d="M20 70 L4 98 H34 L44 84 Z" fill="url(#m)"/>
    <path d="M86 84 L80 106 H92 L98 84 Z" fill="url(#d)"/>
    <path d="M10 66 H192" stroke="#fff" stroke-opacity=".45" stroke-width="1.5"/>`,
  smg: `
    <path d="M36 50 H150 Q158 50 158 58 V70 H36 Z" fill="url(#m)"/>
    <path d="M158 58 H182 V64 H158 Z" fill="url(#d)"/>
    <path d="M70 70 H96 L92 118 H74 Z" fill="url(#d)"/>
    <path d="M110 70 H126 L130 100 H116 Z" fill="url(#m)"/>
    <path d="M36 54 L18 60 V84 L40 70 Z" fill="url(#d)"/>
    <rect x="44" y="40" width="40" height="8" rx="2" fill="url(#acc)"/>`,
  shotgun: `
    <path d="M10 58 H176 Q184 58 184 64 H10 Z" fill="url(#m)"/>
    <path d="M60 64 H176 V72 H60 Z" fill="url(#d)"/>
    <rect x="96" y="72" width="44" height="12" rx="4" fill="url(#acc)"/>
    <path d="M10 58 L-2 90 H30 L60 72 V64 Z" fill="url(#d)"/>
    <path d="M14 61 H170" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>`,
  gloves: `
    <path d="M52 118 V70 Q52 60 60 60 V36 Q60 30 66 30 Q72 30 72 36 V58 V28 Q72 22 78 22 Q84 22 84 28 V58 V30 Q84 24 90 24 Q96 24 96 30 V60 V40 Q96 34 102 34 Q108 34 108 40 V86 Q108 100 98 110 L94 118 Z" fill="url(#m)"/>
    <rect x="50" y="110" width="48" height="14" rx="4" fill="url(#acc)"/>
    <path d="M118 118 V74 Q118 64 126 62 L128 44 Q130 38 136 40 Q142 42 140 48 L138 66 Q150 64 152 74 V100 Q152 110 144 116 Z" fill="url(#d)"/>
    <rect x="116" y="110" width="40" height="12" rx="4" fill="url(#m)"/>`,
  helmet: `
    <path d="M40 92 Q40 34 100 30 Q160 34 160 92 V104 H40 Z" fill="url(#d)"/>
    <path d="M56 70 H144 Q150 70 150 76 V90 Q150 96 144 96 H56 Q50 96 50 90 V76 Q50 70 56 70 Z" fill="url(#acc)"/>
    <path d="M62 76 H120" stroke="#fff" stroke-opacity=".6" stroke-width="3"/>
    <path d="M34 104 H166 V112 H34 Z" fill="url(#m)"/>`,
  grenade: `
    <ellipse cx="100" cy="84" rx="36" ry="40" fill="url(#d)"/>
    <path d="M70 70 H130 M66 88 H134 M72 106 H128" stroke="#556179" stroke-width="3"/>
    <rect x="86" y="32" width="28" height="18" rx="3" fill="url(#m)"/>
    <path d="M114 38 Q140 30 138 56" stroke="url(#acc)" stroke-width="5" fill="none"/>
    <circle cx="140" cy="60" r="7" stroke="url(#m)" stroke-width="3"/>`,
  sticker: `
    <path d="M100 18 L152 40 V86 Q152 112 100 128 Q48 112 48 86 V40 Z" fill="url(#acc)"/>
    <path d="M100 30 L140 47 V84 Q140 104 100 116 Q60 104 60 84 V47 Z" fill="#0D111A" fill-opacity=".55"/>
    <path d="M80 72 L96 88 L124 58" stroke="#fff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`,
  gem: `
    <path d="M60 50 L82 26 H118 L140 50 L100 120 Z" fill="url(#acc)"/>
    <path d="M60 50 H140 M82 26 L92 50 L100 120 L108 50 L118 26" stroke="#fff" stroke-opacity=".55" stroke-width="2" fill="none"/>
    <path d="M60 50 L100 120 L92 50 Z" fill="#fff" fill-opacity=".18"/>`,
  key: `
    <circle cx="62" cy="70" r="26" stroke="url(#m)" stroke-width="12"/>
    <circle cx="62" cy="70" r="8" fill="url(#acc)"/>
    <path d="M86 64 H170 V76 H86 Z" fill="url(#m)"/>
    <path d="M140 76 V94 H150 V76 M158 76 V88 H168 V76" fill="url(#d)" stroke="url(#d)" stroke-width="2"/>`,
  charm: `
    <path d="M100 14 V40" stroke="url(#m)" stroke-width="4"/>
    <circle cx="100" cy="14" r="7" stroke="url(#m)" stroke-width="3"/>
    <path d="M100 40 L140 62 V104 L100 126 L60 104 V62 Z" fill="url(#d)"/>
    <path d="M100 52 L128 68 V98 L100 114 L72 98 V68 Z" fill="url(#acc)"/>
    <path d="M100 52 V114 M72 68 L128 98 M128 68 L72 98" stroke="#fff" stroke-opacity=".35" stroke-width="2"/>`,
}

for (const [name, body] of Object.entries(items)) {
  writeFileSync(join(root, 'items', `${name}.svg`), svg(body))
}

// Case themes: body colour, dark shade, accent (stickers/tape), weapon art, caution tape.
const crateTheme = [
  // slug, main, dark, accent, weapon art, hazard band
  ['magnum', '#6d7480', '#2a2f37', '#ffb547', 'pistol', false],
  ['exposure', '#c8742e', '#4a2410', '#ffe0a8', 'smg', false],
  ['sprint', '#2f8f9d', '#0f3940', '#7ff0ff', 'pistol', false],
  ['ricochet', '#8b5a2b', '#352010', '#ffd27a', 'shotgun', false],
  ['neo', '#7c5cff', '#241a5e', '#00d4ff', 'smg', false],
  ['steel', '#9aa5b4', '#39414d', '#e8eef6', 'rifle', false],
  ['desert', '#c9a76a', '#5b4524', '#fff1c9', 'rifle', false],
  ['fog', '#3b4452', '#12161c', '#9fb0c8', 'sniper', false],
  ['green', '#3aa55a', '#133d20', '#c6ff9e', 'rifle', false],
  ['yellow', '#e0b12f', '#5e4308', '#fff3b0', 'sniper', false],
  ['blue', '#2f6fe0', '#0d2560', '#bfe0ff', 'rifle', false],
  ['red', '#d6334f', '#4f0c1a', '#ffc2cd', 'sniper', true],
  ['blade', '#2b2f36', '#0c0e11', '#e4ae39', 'karambit', true],
  ['gloves', '#8d3fd6', '#2c0e4d', '#f0c8ff', 'gloves', true],
  ['aurora', '#23b3a6', '#0a3c46', '#b6fff5', 'blade', true],
  ['monolith', '#4a4f58', '#15171b', '#ff5570', 'sniper', true],
  ['premium', '#d9a13a', '#4f3208', '#fff4d0', 'karambit', true],
]

// Knife silhouettes (original drawings) for knife-type cases. Handle on the left, blade to the right.
const handle = (style = 'plain') => {
  const base = `<rect x="18" y="62" width="64" height="16" rx="6" fill="url(#d)"/>`
  const extra = {
    plain: '',
    wrap: Array.from({ length: 6 }, (_, i) => `<path d="M${26 + i * 9} 62 l-4 16" stroke="url(#acc)" stroke-width="3"/>`).join(''),
    holes: `<circle cx="34" cy="70" r="4" fill="#0b0e14"/><circle cx="50" cy="70" r="4" fill="#0b0e14"/><circle cx="66" cy="70" r="4" fill="#0b0e14"/>`,
    ring: `<circle cx="16" cy="70" r="9" stroke="url(#m)" stroke-width="5" fill="none"/>`,
    butterfly: `<rect x="18" y="56" width="64" height="9" rx="4" fill="url(#m)"/><rect x="18" y="75" width="64" height="9" rx="4" fill="url(#m)"/>`,
    tee: `<rect x="60" y="44" width="18" height="52" rx="6" fill="url(#d)"/>`,
  }[style]
  return base + extra + `<rect x="78" y="58" width="8" height="24" rx="2" fill="url(#acc)"/>`
}
const edge = (d) => `<path d="${d}" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" fill="none"/>`
const knifeArt = {
  gut: handle() + `<path d="M86 62 H150 Q168 58 184 66 Q170 70 160 70 Q156 60 146 66 L150 78 H86 Z" fill="url(#m)"/>` + edge('M90 76 H150'),
  kukri: handle('plain') + `<path d="M86 60 Q120 56 150 70 Q172 82 188 70 Q180 92 150 88 Q118 84 86 80 Z" fill="url(#m)"/>` + edge('M92 78 Q130 82 170 84'),
  karambit: handle('ring') + `<path d="M86 60 Q140 40 178 64 Q150 58 128 70 Q110 80 86 80 Z" fill="url(#m)"/>` + edge('M92 76 Q116 70 136 62'),
  butterfly: handle('butterfly') + `<path d="M86 62 H160 L186 70 L160 78 H86 Z" fill="url(#m)"/>` + edge('M90 76 H160'),
  m9: handle('plain') + `<path d="M86 60 H166 L188 70 L168 80 H86 Z" fill="url(#m)"/>` + `<path d="M100 60 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4 l4 4" stroke="url(#m)" stroke-width="2" fill="none"/>` + edge('M90 76 H164'),
  bayonet: handle('plain') + `<path d="M86 62 H170 L190 70 L170 78 H86 Z" fill="url(#m)"/>` + `<path d="M84 50 v40" stroke="url(#m)" stroke-width="6"/>` + edge('M90 70 H176'),
  falchion: handle('plain') + `<path d="M86 60 Q140 52 186 58 Q170 78 140 82 H86 Z" fill="url(#m)"/>` + edge('M90 78 Q140 78 176 64'),
  huntsman: handle('plain') + `<path d="M86 60 H150 L166 66 L186 64 Q176 78 150 80 H86 Z" fill="url(#m)"/>` + `<path d="M96 60 l3 -3 l3 3 l3 -3 l3 3 l3 -3 l3 3 l3 -3 l3 3" stroke="url(#m)" stroke-width="2" fill="none"/>` + edge('M92 77 H150'),
  bowie: handle('plain') + `<path d="M86 56 H150 L164 62 L190 60 Q180 84 146 84 H86 Z" fill="url(#m)"/>` + edge('M92 80 H150'),
  daggers: handle('tee') + `<path d="M78 58 L150 64 L178 70 L150 76 L78 82 Z" fill="url(#m)"/>` + edge('M84 70 H170'),
  navaja: handle('plain') + `<path d="M86 64 Q140 56 186 50 Q170 72 130 78 H86 Z" fill="url(#m)"/>` + edge('M92 76 Q140 72 176 56'),
  stiletto: handle('plain') + `<path d="M86 65 H176 L194 70 L176 75 H86 Z" fill="url(#m)"/>` + edge('M90 70 H186'),
  talon: handle('ring') + `<path d="M86 62 Q146 44 184 56 Q156 60 136 72 Q116 80 86 80 Z" fill="url(#m)"/>` + edge('M92 76 Q120 70 146 60'),
  ursus: handle('plain') + `<path d="M86 60 H158 L182 74 L158 80 H86 Z" fill="url(#m)"/>` + edge('M90 78 H160'),
  classic: handle('plain') + `<path d="M86 62 H164 L186 70 L164 78 H86 Z" fill="url(#m)"/>` + edge('M92 70 H176'),
  paracord: handle('wrap') + `<path d="M86 62 H158 L184 70 L160 78 H86 Z" fill="url(#m)"/>` + edge('M92 76 H158'),
  survival: handle('wrap') + `<path d="M86 60 H156 L182 70 L156 80 H86 Z" fill="url(#m)"/>` + `<path d="M96 60 l3 -4 l3 4 l3 -4 l3 4 l3 -4 l3 4 l3 -4 l3 4 l3 -4 l3 4" stroke="url(#m)" stroke-width="2" fill="none"/>` + edge('M92 78 H156'),
  nomad: handle('plain') + `<path d="M86 60 H150 Q176 62 188 70 Q170 80 150 80 H86 Z" fill="url(#m)"/>` + edge('M92 78 H152'),
  skeleton: handle('holes') + `<path d="M86 60 H156 L184 70 L156 80 H86 Z" fill="url(#m)"/>` + edge('M92 78 H156'),
  flip: handle('plain') + `<path d="M86 62 H152 Q174 60 188 66 Q172 78 150 78 H86 Z" fill="url(#m)"/>` + `<circle cx="96" cy="70" r="3.5" fill="#0b0e14"/>` + edge('M104 76 H150'),
}
Object.assign(items, knifeArt)
crateTheme.push(
  ['buckshot', '#a3452a', '#3a1409', '#ffd0a0', 'shotgun', false],
  ['sidearm', '#46505e', '#141920', '#9fe8ff', 'pistol', false],
  ['scope', '#255d8a', '#0a2033', '#b8ecff', 'sniper', false],
  ['hook', '#6f3c2a', '#24110a', '#ffb98a', 'gut', true],
  ['kukri', '#3e6b2f', '#12240c', '#d8ff9e', 'kukri', true],
  ['karambit', '#1e1f24', '#050507', '#ff5570', 'karambit', true],
  ['butterfly', '#6a2bd6', '#1d0a45', '#f3c2ff', 'butterfly', true],
  ['m9', '#2b4a6f', '#0b1624', '#9fd4ff', 'm9', true],
  ['bayonet', '#5b6470', '#1b1f25', '#ffe08a', 'bayonet', true],
  ['falchion', '#8c2f39', '#2a0a0f', '#ffc2c8', 'falchion', true],
  ['huntsman', '#4f5a2c', '#181c0b', '#f0ff9e', 'huntsman', true],
  ['bowie', '#7a5b34', '#271a0b', '#ffe3b0', 'bowie', true],
  ['daggers', '#3b3f48', '#101216', '#b9c6ff', 'daggers', true],
  ['navaja', '#a05d2a', '#331a08', '#ffd5a8', 'navaja', true],
  ['stiletto', '#2e2e36', '#0a0a0d', '#e4ae39', 'stiletto', true],
  ['talon', '#1f6b6b', '#082222', '#9ffff1', 'talon', true],
  ['ursus', '#5e3d2a', '#1d110a', '#ffcfa3', 'ursus', true],
  ['classic', '#6a6f78', '#1f2227', '#ffffff', 'classic', true],
  ['paracord', '#2f5b3a', '#0d1f12', '#ffb547', 'paracord', true],
  ['survival', '#556b2f', '#1a220d', '#ff8a3d', 'survival', true],
  ['nomad', '#8a6a3a', '#2c1f0c', '#fff1c4', 'nomad', true],
  ['skeleton', '#3a3f4a', '#0d0f13', '#e0e6f0', 'skeleton', true],
  ['flip', '#2f63b5', '#0b1c3a', '#bcd9ff', 'flip', true],
)

let rs = 1
const rnd = () => ((rs = (rs * 48271) % 2147483647) / 2147483647)
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('')

// Front-facing hard-shell weapon case seen slightly from above (original drawing): lid with carry
// handle, rubber corner bumpers, side handles, two latches + padlock plate on the seam, a paper
// shipping label, a round patch sticker, a big "glitch" sticker with the case's weapon, embossed
// brand, optional caution tape and weathering. viewBox 260×200.
for (const [slug, main, dark, accent, art, hazard] of crateTheme) {
  rs = [...slug].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647 || 1
  const id = slug.replace(/[^a-z0-9]/g, '')
  const light = mix(main, '#ffffff', 0.28)
  const bumper = mix(dark, '#000000', 0.35)
  const isKnife = Boolean(knifeArt[art])

  let scratches = ''
  for (let i = 0; i < 34; i++) {
    const x = 24 + rnd() * 212
    const y = 54 + rnd() * 124
    const l = 3 + rnd() * 13
    const ang = (rnd() - 0.5) * 1.4
    scratches += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l${(l * Math.cos(ang)).toFixed(1)} ${(l * Math.sin(ang)).toFixed(1)}" stroke="#fff" stroke-opacity="${(0.05 + rnd() * 0.13).toFixed(2)}" stroke-width="${(0.5 + rnd() * 0.9).toFixed(1)}"/>`
  }
  let chips = ''
  for (let i = 0; i < 14; i++) {
    const top = rnd() < 0.5
    const x = 30 + rnd() * 200
    const y = top ? 51 + rnd() * 2 : 179 + rnd() * 2
    chips += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(1 + rnd() * 3).toFixed(1)}" ry="${(0.5 + rnd()).toFixed(1)}" fill="#fff" fill-opacity="${(0.15 + rnd() * 0.25).toFixed(2)}"/>`
  }
  const ridges = (x) => Array.from({ length: 14 }, (_, i) => `<path d="M${x + 4} ${60 + i * 8.4} h10" stroke="#000" stroke-opacity=".32" stroke-width="2"/><path d="M${x + 4} ${61.6 + i * 8.4} h10" stroke="#fff" stroke-opacity=".06" stroke-width="1"/>`).join('')
  const latch = (x) => `
    <rect x="${x}" y="84" width="26" height="40" rx="3.5" fill="#000" fill-opacity=".35" transform="translate(1.5 2.5)"/>
    <rect x="${x}" y="84" width="26" height="40" rx="3.5" fill="url(#${id}mt)"/>
    <rect x="${x + 4}" y="94" width="18" height="24" rx="2.5" fill="url(#${id}md)"/>
    <path d="M${x + 4} 99 h18" stroke="#000" stroke-opacity=".35" stroke-width="1.2"/>
    <rect x="${x + 8}" y="86" width="10" height="5" rx="1.5" fill="#1b1d22"/>
    <circle cx="${x + 5}" cy="89" r="1.4" fill="#2a2c31"/><circle cx="${x + 21}" cy="89" r="1.4" fill="#2a2c31"/>
    <path d="M${x + 1.5} 85.5 h23" stroke="#fff" stroke-opacity=".55" stroke-width="1"/>`
  const barcode = Array.from({ length: 16 }, (_, i) => `<rect x="${154 + i * 2.1}" y="72" width="${rnd() < 0.5 ? 0.9 : 1.5}" height="8" fill="#23262c"/>`).join('')
  const tape = hazard
    ? `<g clip-path="url(#${id}clip)"><g transform="rotate(-36 60 64)">
         <rect x="-40" y="58" width="170" height="13" fill="${mix(accent, '#ffd21a', 0.55)}"/>
         ${Array.from({ length: 18 }, (_, i) => `<path d="M${-40 + i * 11} 71 l7 -13 h5 l-7 13 z" fill="#111"/>`).join('')}
         <rect x="-40" y="58" width="170" height="13" fill="none" stroke="#000" stroke-opacity=".35"/>
       </g></g>`
    : ''
  const weapon = items[art]
  const artTf = isKnife ? 'translate(68 93) scale(.62) rotate(-12 100 70)' : 'translate(70 94) scale(.6)'
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 200" fill="none">
  <defs>
    <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${main}"/><stop offset=".55" stop-color="${mix(main, dark, 0.35)}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="${id}t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(light, '#ffffff', 0.15)}"/><stop offset="1" stop-color="${light}"/></linearGradient>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${bumper}"/><stop offset=".5" stop-color="${mix(bumper, '#ffffff', 0.08)}"/><stop offset="1" stop-color="${bumper}"/></linearGradient>
    <linearGradient id="${id}gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="${id}mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef0f3"/><stop offset=".5" stop-color="#a9aeb7"/><stop offset="1" stop-color="#6c717b"/></linearGradient>
    <linearGradient id="${id}md" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9097a2"/><stop offset="1" stop-color="#4a4f58"/></linearGradient>
    <linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset="1" stop-color="#9aa3b3"/></linearGradient>
    <linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4457"/><stop offset="1" stop-color="#151a24"/></linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${mix(accent, main, 0.5)}"/></linearGradient>
    <filter id="${id}bl" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="5"/></filter>
    <filter id="${id}r" x="-10%" y="-10%" width="120%" height="120%"><feFlood flood-color="#ff2d55"/><feComposite in2="SourceAlpha" operator="in"/></filter>
    <filter id="${id}c" x="-10%" y="-10%" width="120%" height="120%"><feFlood flood-color="#19e3ff"/><feComposite in2="SourceAlpha" operator="in"/></filter>
    <clipPath id="${id}clip"><path d="M36 30 H224 Q230 30 234 36 L244 50 V173 Q244 182 235 182 H25 Q16 182 16 173 V50 L26 36 Q30 30 36 30 Z"/></clipPath>
    <clipPath id="${id}st"><rect x="64" y="105" width="132" height="62" rx="6"/></clipPath>
    <clipPath id="${id}s1"><rect x="0" y="112" width="260" height="7"/></clipPath>
    <clipPath id="${id}s2"><rect x="0" y="140" width="260" height="5"/></clipPath>
  </defs>
  <ellipse cx="130" cy="186" rx="112" ry="9" fill="#000" fill-opacity=".55" filter="url(#${id}bl)"/>
  <!-- side handles -->
  <rect x="7" y="110" width="12" height="28" rx="3.5" fill="#15171b"/><rect x="9" y="113" width="3" height="22" rx="1.5" fill="#fff" fill-opacity=".08"/>
  <rect x="241" y="110" width="12" height="28" rx="3.5" fill="#15171b"/>
  <!-- lid top -->
  <path d="M36 30 H224 Q230 30 234 36 L244 50 H16 L26 36 Q30 30 36 30 Z" fill="url(#${id}t)"/>
  <path d="M30 34 H230" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>
  <rect x="92" y="35" width="10" height="8" rx="2" fill="#1e2024"/><rect x="158" y="35" width="10" height="8" rx="2" fill="#1e2024"/>
  <rect x="98" y="33" width="64" height="9" rx="4.5" fill="#17191d"/><path d="M102 35 h56" stroke="#fff" stroke-opacity=".18" stroke-width="1.2"/>
  <!-- front -->
  <rect x="16" y="50" width="228" height="132" rx="9" fill="url(#${id}f)"/>
  <rect x="16" y="50" width="228" height="48" rx="9" fill="#fff" fill-opacity=".05"/>
  <path d="M40 64 H220 M40 90 H220" stroke="#000" stroke-opacity=".12" stroke-width="2"/>
  <path d="M40 65.5 H220 M40 91.5 H220" stroke="#fff" stroke-opacity=".06" stroke-width="1"/>
  ${tape}
  <!-- seam -->
  <rect x="16" y="97" width="228" height="6" fill="#000" fill-opacity=".45"/>
  <path d="M16 103.8 H244" stroke="#fff" stroke-opacity=".16" stroke-width="1"/>
  <path d="M40 170 H220" stroke="#000" stroke-opacity=".28" stroke-width="2"/><path d="M40 171.6 H220" stroke="#fff" stroke-opacity=".08" stroke-width="1"/>
  <!-- bumpers -->
  <rect x="16" y="50" width="20" height="132" rx="9" fill="url(#${id}b)"/>${ridges(16)}
  <rect x="224" y="50" width="20" height="132" rx="9" fill="url(#${id}b)"/>${ridges(224)}
  <!-- paper shipping label -->
  <g transform="rotate(-2.5 180 70)">
    <rect x="149" y="55" width="64" height="29" rx="1.5" fill="#000" fill-opacity=".25" transform="translate(1 1.5)"/>
    <rect x="149" y="55" width="64" height="29" rx="1.5" fill="#eeece4"/>
    <text x="153" y="62.5" font-family="Arial, sans-serif" font-weight="700" font-size="5.4" fill="#23262c">GRADERUP SUPPLY</text>
    <path d="M153 66 h40 M153 69 h28" stroke="#23262c" stroke-opacity=".55" stroke-width="1.2"/>
    ${barcode}
    <text x="192" y="79" font-family="Arial, sans-serif" font-weight="700" font-size="5" fill="${mix(accent, '#000000', 0.35)}">${slug.slice(0, 3).toUpperCase()}-${String(100 + Math.floor(rnd() * 900))}</text>
  </g>
  <!-- round patch -->
  <circle cx="64" cy="74" r="12.5" fill="#000" fill-opacity=".3" transform="translate(1 1.5)"/>
  <circle cx="64" cy="74" r="12.5" fill="${accent}"/><circle cx="64" cy="74" r="9.5" fill="#101318"/>
  <path d="M64 67.5 L66 72 L70.8 72.3 L67.1 75.3 L68.3 80 L64 77.4 L59.7 80 L60.9 75.3 L57.2 72.3 L62 72 Z" fill="${accent}"/>
  <!-- glitch weapon sticker -->
  <rect x="64" y="105" width="132" height="62" rx="6" fill="#000" fill-opacity=".3" transform="translate(1.2 2)"/>
  <rect x="64" y="105" width="132" height="62" rx="6" fill="#0d1015"/>
  <g clip-path="url(#${id}st)">
    <rect x="64" y="105" width="132" height="62" fill="${accent}" fill-opacity=".08"/>
    ${Array.from({ length: 10 }, (_, i) => `<path d="M64 ${110 + i * 6} H196" stroke="#fff" stroke-opacity=".035"/>`).join('')}
    <g transform="translate(-3 0)" opacity=".85"><g transform="${artTf}" filter="url(#${id}r)">${weapon}</g></g>
    <g transform="translate(3 0)" opacity=".85"><g transform="${artTf}" filter="url(#${id}c)">${weapon}</g></g>
    <g transform="${artTf}">${weapon}</g>
    <g clip-path="url(#${id}s1)" transform="translate(7 0)"><g transform="${artTf}">${weapon}</g></g>
    <g clip-path="url(#${id}s2)" transform="translate(-6 0)"><g transform="${artTf}">${weapon}</g></g>
  </g>
  <rect x="64" y="105" width="132" height="62" rx="6" stroke="${accent}" stroke-opacity=".8" stroke-width="1.6"/>
  <path d="M69 110 h10 M69 110 v7 M191 162 h-10 M191 162 v-7" stroke="${accent}" stroke-width="1.6"/>
  <!-- latches + padlock plate -->
  ${latch(36)}${latch(198)}
  <rect x="118" y="88" width="24" height="20" rx="3" fill="url(#${id}mt)"/>
  <circle cx="130" cy="96" r="2.6" fill="#1b1d22"/><rect x="129" y="97" width="2" height="6" rx="1" fill="#1b1d22"/>
  <!-- emboss -->
  <text x="130.6" y="179.7" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="7.5" letter-spacing="3" fill="#fff" fill-opacity=".12">GRADERUP</text>
  <text x="130" y="179" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="7.5" letter-spacing="3" fill="#000" fill-opacity=".4">GRADERUP</text>
  <g clip-path="url(#${id}clip)">${scratches}${chips}</g>
  <rect x="16" y="50" width="228" height="132" rx="9" fill="url(#${id}gl)"/>
  <rect x="16.5" y="50.5" width="227" height="131" rx="8.5" stroke="#fff" stroke-opacity=".14"/>
</svg>
`
  writeFileSync(join(root, 'cases', `${slug}.svg`), body)
}

writeFileSync(
  join(root, 'logo.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7C5CFF"/><stop offset="1" stop-color="#00D4FF"/></linearGradient></defs>
  <rect x="4" y="4" width="56" height="56" rx="14" fill="#111722" stroke="url(#g)" stroke-width="3"/>
  <path d="M32 14 L48 32 H38 V50 H26 V32 H16 Z" fill="url(#g)"/>
</svg>
`,
)
console.log(`✓ generated ${Object.keys(items).length} item and ${crateTheme.length} case images`)

// Topographic contour pattern (tileable-ish), used as a subtle header/body texture.
{
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const loops = []
  const centers = [[180, 140], [620, 90], [420, 360], [760, 420], [90, 470]]
  for (const [cx, cy] of centers) {
    const phase = rnd() * 6
    for (let k = 1; k <= 9; k++) {
      const r = k * 22
      const pts = []
      for (let a = 0; a <= 64; a++) {
        const t = (a / 64) * Math.PI * 2
        const rr = r * (1 + 0.18 * Math.sin(3 * t + phase + k * 0.3) + 0.08 * Math.cos(5 * t + phase))
        pts.push(`${(cx + rr * Math.cos(t)).toFixed(1)},${(cy + rr * 0.75 * Math.sin(t)).toFixed(1)}`)
      }
      loops.push(`<polyline points="${pts.join(' ')}"/>`)
    }
  }
  writeFileSync(
    join(root, 'topo.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 560" fill="none" stroke="#9FB0C8" stroke-opacity=".09" stroke-width="1">${loops.join('')}</svg>\n`,
  )
}
