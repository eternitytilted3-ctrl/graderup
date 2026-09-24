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

// Cases: 3/4-perspective weapon crates (original drawing) — lid, front, side, ribs, latches,
// rivets, stencil, scratches, optional hazard band, and a large weapon silhouette on the front panel.
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

let rs = 1
const rnd = () => ((rs = (rs * 48271) % 2147483647) / 2147483647)

for (const [slug, main, dark, accent, art, hazard] of crateTheme) {
  rs = [...slug].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647 || 1
  const id = slug.replace(/[^a-z]/g, '')
  // Scratches (weathering)
  let scratches = ''
  for (let i = 0; i < 26; i++) {
    const x = 30 + rnd() * 170
    const y = 72 + rnd() * 92
    const l = 4 + rnd() * 14
    const a = (rnd() - 0.5) * 1.2
    scratches += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l${(l * Math.cos(a)).toFixed(1)} ${(l * Math.sin(a)).toFixed(1)}" stroke="#fff" stroke-opacity="${(0.05 + rnd() * 0.12).toFixed(2)}" stroke-width="${(0.6 + rnd()).toFixed(1)}"/>`
  }
  const rivets = [
    [28, 70], [192, 70], [28, 160], [192, 160], [110, 70], [110, 160],
  ].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="url(#${id}m)"/><circle cx="${x - 0.6}" cy="${y - 0.6}" r="0.8" fill="#fff" fill-opacity=".7"/>`).join('')
  const hazardBand = hazard
    ? `<clipPath id="${id}hz"><rect x="22" y="150" width="176" height="18"/></clipPath>
       <g clip-path="url(#${id}hz)">${Array.from({ length: 16 }, (_, i) => `<path d="M${14 + i * 14} 168 l12 -18 h7 l-12 18 z" fill="${accent}" fill-opacity=".85"/>`).join('')}</g>
       <rect x="22" y="150" width="176" height="18" fill="none" stroke="#000" stroke-opacity=".35"/>`
    : `<rect x="22" y="152" width="176" height="14" fill="#000" fill-opacity=".22"/>`
  const weapon = items[art]
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 190" fill="none">
  <defs>
    <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${main}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${main}"/><stop offset=".5" stop-color="${main}" stop-opacity=".95"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${dark}"/><stop offset="1" stop-color="#07090c"/></linearGradient>
    <linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1ede2"/><stop offset="1" stop-color="#8a8272"/></linearGradient>
    <linearGradient id="${id}p" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></linearGradient>
    <radialGradient id="${id}g" cx=".5" cy=".62" r=".55"><stop offset="0" stop-color="${accent}" stop-opacity=".35"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset="1" stop-color="#9aa3b3"/></linearGradient>
    <linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a4457"/><stop offset="1" stop-color="#151a24"/></linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${accent}"/><stop offset="1" stop-color="${main}"/></linearGradient>
    <filter id="${id}sh" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="10" stdDeviation="7" flood-color="#000" flood-opacity=".6"/></filter>
    <filter id="${id}ws" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000" flood-opacity=".7"/></filter>
  </defs>
  <ellipse cx="128" cy="112" rx="124" ry="78" fill="url(#${id}g)"/>
  <g filter="url(#${id}sh)">
    <!-- side -->
    <path d="M200 58 L238 36 V144 L200 170 Z" fill="url(#${id}s)"/>
    <path d="M206 70 L232 55 M206 150 L232 134" stroke="#000" stroke-opacity=".35" stroke-width="4"/>
    <rect x="212" y="90" width="16" height="30" rx="3" transform="skewY(-30) translate(0 124)" fill="#000" fill-opacity=".35"/>
    <!-- lid -->
    <path d="M20 58 L200 58 L238 36 L60 36 Z" fill="url(#${id}t)"/>
    <path d="M20 58 L200 58 L238 36" stroke="#fff" stroke-opacity=".35" stroke-width="1.3"/>
    <path d="M58 52 L210 52 M72 44 L226 44" stroke="#000" stroke-opacity=".18" stroke-width="3"/>
    <!-- front -->
    <rect x="20" y="58" width="180" height="112" rx="3" fill="url(#${id}f)"/>
    <rect x="20" y="58" width="180" height="10" fill="#000" fill-opacity=".3"/>
    ${hazardBand}
    <rect x="20" y="58" width="12" height="112" fill="#000" fill-opacity=".25"/>
    <rect x="188" y="58" width="12" height="112" fill="#000" fill-opacity=".3"/>
    <!-- panel with weapon -->
    <rect x="42" y="76" width="136" height="68" rx="4" fill="url(#${id}p)" stroke="${accent}" stroke-opacity=".45" stroke-width="1.2"/>
    <path d="M46 80 h18 M46 80 v10 M174 140 h-18 M174 140 v-10" stroke="${accent}" stroke-opacity=".8" stroke-width="1.6"/>
    <g transform="translate(47 74) scale(.63)" filter="url(#${id}ws)">${weapon}</g>
    ${scratches}
    ${rivets}
    <!-- latches -->
    <rect x="44" y="50" width="20" height="26" rx="2.5" fill="url(#${id}m)"/><rect x="49" y="66" width="10" height="6" rx="1" fill="#2e281c"/>
    <rect x="156" y="50" width="20" height="26" rx="2.5" fill="url(#${id}m)"/><rect x="161" y="66" width="10" height="6" rx="1" fill="#2e281c"/>
    <!-- padlock -->
    <rect x="102" y="60" width="16" height="13" rx="2" fill="url(#${id}m)"/><path d="M105 60 v-4 a5 5 0 0 1 10 0 v4" stroke="url(#${id}m)" stroke-width="2.4" fill="none"/>
    <text x="110" y="${hazard ? 184 : 162}" opacity="${hazard ? 0 : 1}" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="9" letter-spacing="3" fill="#000" fill-opacity=".45">GRADERUP</text>
    <rect x="20" y="58" width="180" height="112" rx="3" stroke="#fff" stroke-opacity=".12"/>
  </g>
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
