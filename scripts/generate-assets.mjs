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

// ─── 3D crates ──────────────────────────────────────────────────────────────
// Each crate is a box W×H×D. Faces are separate textures (front / top / side) used by the CSS-3D
// <Crate3D> component; the same textures are also composed into a flat 3/4-view SVG (orthographic
// projection with the same rotation as the CSS pose) for places that need a plain image.
// All artwork is original (drawn here).
const CW = 240
const CH = 140
const CD = 110
mkdirSync(join(root, 'cases', '3d'), { recursive: true })

const scratchesFor = (w, h, n, rnd) => {
  let out = ''
  for (let i = 0; i < n; i++) {
    const x = 6 + rnd() * (w - 12)
    const y = 6 + rnd() * (h - 12)
    const l = 3 + rnd() * 12
    const ang = (rnd() - 0.5) * 1.4
    out += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l${(l * Math.cos(ang)).toFixed(1)} ${(l * Math.sin(ang)).toFixed(1)}" stroke="#fff" stroke-opacity="${(0.05 + rnd() * 0.12).toFixed(2)}" stroke-width="${(0.5 + rnd() * 0.8).toFixed(1)}"/>`
  }
  return out
}

function crateFaces(slug, main, dark, accent, art, hazard, P) {
  rs = [...slug].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647 || 1
  const light = mix(main, '#ffffff', 0.3)
  const bumper = mix(dark, '#000000', 0.4)
  const isKnife = Boolean(knifeArt[art])
  const code = `${slug.slice(0, 3).toUpperCase()}-${String(100 + Math.floor(rnd() * 900))}`
  const tapeColor = mix(accent, '#ffd21a', 0.55)
  const ridges = (x, h) => Array.from({ length: Math.floor((h - 12) / 8) }, (_, i) => `<path d="M${x + 3} ${9 + i * 8} h10" stroke="#000" stroke-opacity=".3" stroke-width="2"/><path d="M${x + 3} ${10.6 + i * 8} h10" stroke="#fff" stroke-opacity=".07"/>`).join('')
  const latch = (x) => `
    <rect x="${x + 1.5}" y="38.5" width="24" height="36" rx="3.5" fill="#000" fill-opacity=".35"/>
    <rect x="${x}" y="36" width="24" height="36" rx="3.5" fill="url(#${P}mt)"/>
    <rect x="${x + 4}" y="45" width="16" height="22" rx="2.5" fill="url(#${P}md)"/>
    <path d="M${x + 4} 50 h16" stroke="#000" stroke-opacity=".35" stroke-width="1.2"/>
    <rect x="${x + 7}" y="38" width="10" height="5" rx="1.5" fill="#1b1d22"/>
    <path d="M${x + 1.5} 37.5 h21" stroke="#fff" stroke-opacity=".6"/>`
  const barcode = Array.from({ length: 16 }, (_, i) => `<rect x="${157 + i * 2.1}" y="24" width="${rnd() < 0.5 ? 0.9 : 1.5}" height="8" fill="#23262c"/>`).join('')
  const artTf = isKnife ? 'translate(58 49) scale(.62) rotate(-12 100 70)' : 'translate(60 50) scale(.6)'
  const weapon = items[art]
  const defs = `
    <linearGradient id="${P}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(main, '#ffffff', 0.08)}"/><stop offset=".5" stop-color="${main}"/><stop offset="1" stop-color="${mix(main, dark, 0.6)}"/></linearGradient>
    <linearGradient id="${P}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${mix(light, '#ffffff', 0.2)}"/><stop offset=".6" stop-color="${light}"/><stop offset="1" stop-color="${main}"/></linearGradient>
    <linearGradient id="${P}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(main, dark, 0.25)}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="${P}b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${bumper}"/><stop offset=".5" stop-color="${mix(bumper, '#ffffff', 0.1)}"/><stop offset="1" stop-color="${bumper}"/></linearGradient>
    <linearGradient id="${P}gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="${P}mt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2f4f7"/><stop offset=".5" stop-color="#aab0b9"/><stop offset="1" stop-color="#6b707a"/></linearGradient>
    <linearGradient id="${P}md" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9097a2"/><stop offset="1" stop-color="#4a4f58"/></linearGradient>
    <linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset="1" stop-color="#9aa3b3"/></linearGradient>
    <linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4457"/><stop offset="1" stop-color="#151a24"/></linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${mix(accent, main, 0.5)}"/></linearGradient>
    <filter id="${P}r" x="-10%" y="-10%" width="120%" height="120%"><feFlood flood-color="#ff2d55"/><feComposite in2="SourceAlpha" operator="in"/></filter>
    <filter id="${P}c" x="-10%" y="-10%" width="120%" height="120%"><feFlood flood-color="#19e3ff"/><feComposite in2="SourceAlpha" operator="in"/></filter>
    <clipPath id="${P}st"><rect x="58" y="60" width="124" height="58" rx="6"/></clipPath>
    <clipPath id="${P}s1"><rect x="0" y="70" width="240" height="6"/></clipPath>
    <clipPath id="${P}s2"><rect x="0" y="96" width="240" height="5"/></clipPath>
    <clipPath id="${P}ct"><rect width="${CW}" height="${CD}"/></clipPath>`

  const front = `
  <rect width="${CW}" height="${CH}" fill="url(#${P}f)"/>
  <rect width="${CW}" height="46" fill="#fff" fill-opacity=".06"/>
  <path d="M20 16 H220 M20 38 H220" stroke="#000" stroke-opacity=".12" stroke-width="2"/><path d="M20 17.5 H220 M20 39.5 H220" stroke="#fff" stroke-opacity=".07"/>
  <rect y="45" width="${CW}" height="6" fill="#000" fill-opacity=".45"/><path d="M0 51.6 H240" stroke="#fff" stroke-opacity=".18"/>
  <path d="M20 126 H220" stroke="#000" stroke-opacity=".28" stroke-width="2"/><path d="M20 127.6 H220" stroke="#fff" stroke-opacity=".08"/>
  <rect width="16" height="${CH}" fill="url(#${P}b)"/>${ridges(1, CH)}
  <rect x="224" width="16" height="${CH}" fill="url(#${P}b)"/>${ridges(224, CH)}
  <g transform="rotate(-2.5 180 22)">
    <rect x="152" y="8" width="60" height="28" rx="1.5" fill="#000" fill-opacity=".25" transform="translate(1 1.5)"/>
    <rect x="152" y="8" width="60" height="28" rx="1.5" fill="#eeece4"/>
    <text x="156" y="15.5" font-family="Arial, sans-serif" font-weight="700" font-size="5.2" fill="#23262c">GRADERUP SUPPLY</text>
    <path d="M156 19 h36" stroke="#23262c" stroke-opacity=".55" stroke-width="1.2"/>
    ${barcode}
    <text x="191" y="32" font-family="Arial, sans-serif" font-weight="700" font-size="4.8" fill="${mix(accent, '#000000', 0.35)}">${code}</text>
  </g>
  <circle cx="44" cy="24" r="11.5" fill="#000" fill-opacity=".3" transform="translate(1 1.5)"/>
  <circle cx="44" cy="24" r="11.5" fill="${accent}"/><circle cx="44" cy="24" r="8.7" fill="#101318"/>
  <path d="M44 18 L45.8 22.2 L50.3 22.5 L46.9 25.3 L48 29.6 L44 27.2 L40 29.6 L41.1 25.3 L37.7 22.5 L42.2 22.2 Z" fill="${accent}"/>
  <rect x="59.2" y="62" width="124" height="58" rx="6" fill="#000" fill-opacity=".3"/>
  <rect x="58" y="60" width="124" height="58" rx="6" fill="#0d1015"/>
  <g clip-path="url(#${P}st)">
    <rect x="58" y="60" width="124" height="58" fill="${accent}" fill-opacity=".1"/>
    ${Array.from({ length: 10 }, (_, i) => `<path d="M58 ${64 + i * 6} H182" stroke="#fff" stroke-opacity=".035"/>`).join('')}
    <g transform="translate(-3 0)" opacity=".85"><g transform="${artTf}" filter="url(#${P}r)">${weapon}</g></g>
    <g transform="translate(3 0)" opacity=".85"><g transform="${artTf}" filter="url(#${P}c)">${weapon}</g></g>
    <g transform="${artTf}">${weapon}</g>
    <g clip-path="url(#${P}s1)" transform="translate(7 0)"><g transform="${artTf}">${weapon}</g></g>
    <g clip-path="url(#${P}s2)" transform="translate(-6 0)"><g transform="${artTf}">${weapon}</g></g>
  </g>
  <rect x="58" y="60" width="124" height="58" rx="6" stroke="${accent}" stroke-opacity=".85" stroke-width="1.6"/>
  <path d="M63 65 h10 M63 65 v7 M177 113 h-10 M177 113 v-7" stroke="${accent}" stroke-width="1.6"/>
  ${latch(22)}${latch(194)}
  <rect x="108" y="38" width="24" height="19" rx="3" fill="url(#${P}mt)"/>
  <circle cx="120" cy="45.5" r="2.6" fill="#1b1d22"/><rect x="119" y="46.5" width="2" height="6" rx="1" fill="#1b1d22"/>
  <text x="120.6" y="136.6" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="7.5" letter-spacing="3" fill="#fff" fill-opacity=".14">GRADERUP</text>
  <text x="120" y="136" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="7.5" letter-spacing="3" fill="#000" fill-opacity=".42">GRADERUP</text>
  ${scratchesFor(CW, CH, 30, rnd)}
  <rect width="${CW}" height="${CH}" fill="url(#${P}gl)"/>
  <rect x=".5" y=".5" width="${CW - 1}" height="${CH - 1}" stroke="#fff" stroke-opacity=".22"/>
  <path d="M0 .8 H240" stroke="#fff" stroke-opacity=".5" stroke-width="1.6"/>`

  const tape = hazard
    ? `<g clip-path="url(#${P}ct)"><g transform="rotate(-32 50 60)"><rect x="-40" y="52" width="200" height="14" fill="${tapeColor}"/>${Array.from({ length: 20 }, (_, i) => `<path d="M${-40 + i * 11} 66 l7 -14 h5 l-7 14 z" fill="#111"/>`).join('')}</g></g>`
    : ''
  const top = `
  <rect width="${CW}" height="${CD}" fill="url(#${P}t)"/>
  <rect x="6" y="6" width="${CW - 12}" height="${CD - 12}" rx="6" stroke="#000" stroke-opacity=".16" stroke-width="2"/>
  <rect x="7.5" y="7.5" width="${CW - 15}" height="${CD - 15}" rx="5" stroke="#fff" stroke-opacity=".18"/>
  ${tape}
  <rect x="84" y="46" width="12" height="18" rx="2.5" fill="#1a1c21"/><rect x="144" y="46" width="12" height="18" rx="2.5" fill="#1a1c21"/>
  <rect x="80" y="52" width="80" height="14" rx="7" fill="#000" fill-opacity=".35"/>
  <rect x="80" y="48" width="80" height="14" rx="7" fill="#17191d"/><path d="M86 51.5 h68" stroke="#fff" stroke-opacity=".22" stroke-width="1.4"/>
  ${[[14, 14], [226, 14], [14, 96], [226, 96]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6" fill="url(#${P}mt)"/>`).join('')}
  <text x="120" y="88" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="9" letter-spacing="4" fill="#000" fill-opacity=".22">GRADERUP</text>
  <text x="22" y="26" font-family="Arial, sans-serif" font-weight="700" font-size="6" fill="#000" fill-opacity=".35">${code}</text>
  ${scratchesFor(CW, CD, 18, rnd)}
  <rect width="${CW}" height="${CD}" fill="url(#${P}gl)"/>
  <rect x=".5" y=".5" width="${CW - 1}" height="${CD - 1}" stroke="#fff" stroke-opacity=".3"/>`

  const side = `
  <rect width="${CD}" height="${CH}" fill="url(#${P}s)"/>
  <rect y="45" width="${CD}" height="6" fill="#000" fill-opacity=".45"/><path d="M0 51.6 H110" stroke="#fff" stroke-opacity=".14"/>
  <rect width="14" height="${CH}" fill="url(#${P}b)"/>${ridges(0, CH)}
  <rect x="96" width="14" height="${CH}" fill="url(#${P}b)"/>${ridges(96, CH)}
  <rect x="30" y="72" width="10" height="16" rx="2" fill="#15171b"/><rect x="70" y="72" width="10" height="16" rx="2" fill="#15171b"/>
  <rect x="28" y="84" width="54" height="11" rx="5.5" fill="#000" fill-opacity=".35"/>
  <rect x="28" y="80" width="54" height="11" rx="5.5" fill="#17191d"/><path d="M33 83 h44" stroke="#fff" stroke-opacity=".2"/>
  <path d="M55 14 L66 33 H44 Z" fill="${tapeColor}" stroke="#111" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M55 20 v7" stroke="#111" stroke-width="2.2" stroke-linecap="round"/><circle cx="55" cy="30" r="1.2" fill="#111"/>
  ${scratchesFor(CD, CH, 14, rnd)}
  <rect x=".5" y=".5" width="${CD - 1}" height="${CH - 1}" stroke="#fff" stroke-opacity=".12"/>`

  return { defs, front, top, side }
}

// CSS pose of the crate: rotateX(-20deg) rotateY(-28deg) (see .crate3d-box in globals.css).
const POSE_X = -20
const POSE_Y = -28
const d2r = (a) => (a * Math.PI) / 180
const rotX = (a) => [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]]
const rotY = (a) => [[Math.cos(a), 0, Math.sin(a)], [0, 1, 0], [-Math.sin(a), 0, Math.cos(a)]]
const matMul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)))
const apply = (A, p) => A.map((r) => r[0] * p[0] + r[1] * p[1] + r[2] * p[2])
const POSE = matMul(rotX(d2r(POSE_X)), rotY(d2r(POSE_Y)))
// Face transforms, as in CSS: front translateZ(D/2); right rotateY(90) translateZ(W/2); top rotateX(90) translateZ(H/2).
const FACES = {
  front: { w: CW, h: CH, f: (p) => [p[0], p[1], p[2] + CD / 2] },
  side: { w: CD, h: CH, f: (p) => apply(rotY(d2r(90)), [p[0], p[1], p[2] + CW / 2]) },
  top: { w: CW, h: CD, f: (p) => apply(rotX(d2r(90)), [p[0], p[1], p[2] + CH / 2]) },
}
const project = (face, u, v) => {
  const F = FACES[face]
  const q = apply(POSE, F.f([u - F.w / 2, v - F.h / 2, 0]))
  return [q[0], q[1]]
}
const affine = (face) => {
  const o = project(face, 0, 0)
  const ux = project(face, 1, 0)
  const vy = project(face, 0, 1)
  return `matrix(${[ux[0] - o[0], ux[1] - o[1], vy[0] - o[0], vy[1] - o[1], o[0], o[1]].map((n) => n.toFixed(5)).join(' ')})`
}
// Fixed viewBox centred on the box centre so the flat image lines up with the CSS-3D box (see CrateStage).
const VB = { x: -170, y: -150, w: 340, h: 300 }

for (const [slug, main, dark, accent, art, hazard] of crateTheme) {
  const f = crateFaces(slug, main, dark, accent, art, hazard, 'f')
  const face = (body, w, h) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" preserveAspectRatio="none"><defs>${f.defs}</defs>${body}</svg>\n`
  writeFileSync(join(root, 'cases', '3d', `${slug}-front.svg`), face(f.front, CW, CH))
  writeFileSync(join(root, 'cases', '3d', `${slug}-top.svg`), face(f.top, CW, CD))
  writeFileSync(join(root, 'cases', '3d', `${slug}-side.svg`), face(f.side, CD, CH))

  // Flat 3/4 view: the three visible faces, affinely projected, with face shading + contact shadow.
  const [sx, sy] = apply(POSE, [0, CH / 2, 0])
  const flat = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" fill="none">
  <defs>${f.defs}<filter id="fsh" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="7"/></filter></defs>
  <ellipse cx="${sx.toFixed(1)}" cy="${(sy + 14).toFixed(1)}" rx="${(CW * 0.56).toFixed(1)}" ry="16" fill="#000" fill-opacity=".55" filter="url(#fsh)"/>
  <g transform="${affine('side')}">${f.side}<rect width="${CD}" height="${CH}" fill="#000" fill-opacity=".32"/></g>
  <g transform="${affine('top')}">${f.top}<rect width="${CW}" height="${CD}" fill="#fff" fill-opacity=".06"/></g>
  <g transform="${affine('front')}">${f.front}</g>
</svg>
`
  writeFileSync(join(root, 'cases', `${slug}.svg`), flat)
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
