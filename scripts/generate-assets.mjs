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

// Cases: front-facing weapon crate (original drawing) with per-case palette and emblem.
const emblems = {
  bolt: 'M104 52 L84 86 H100 L94 112 L118 74 H102 Z',
  star: 'M100 50 L108 74 H132 L112 88 L120 112 L100 98 L80 112 L88 88 L68 74 H92 Z',
  ring: 'M100 56 A26 26 0 1 1 99.9 56 Z M100 70 A12 12 0 1 0 100.1 70 Z',
  diamond: 'M100 50 L126 82 L100 114 L74 82 Z',
  crown: 'M72 104 L68 64 L88 80 L100 56 L112 80 L132 64 L128 104 Z',
  flame: 'M100 50 Q128 76 116 102 Q108 116 100 116 Q84 116 80 100 Q76 84 92 72 Q92 86 100 88 Q96 70 100 50 Z',
  skull: 'M100 54 Q128 54 128 80 Q128 94 118 98 V110 H82 V98 Q72 94 72 80 Q72 54 100 54 Z M88 78 A6 6 0 1 0 88.1 78 Z M112 78 A6 6 0 1 0 112.1 78 Z',
  leaf: 'M76 108 Q76 60 128 56 Q126 108 76 108 Z M80 104 L120 62',
  wave: 'M70 90 Q85 70 100 90 T130 90 M70 76 Q85 56 100 76 T130 76',
  eye: 'M68 82 Q100 50 132 82 Q100 114 68 82 Z M100 72 A10 10 0 1 0 100.1 72 Z',
  moon: 'M112 54 A30 30 0 1 0 128 102 A24 24 0 1 1 112 54 Z',
  cube: 'M100 54 L126 68 V98 L100 112 L74 98 V68 Z M74 68 L100 82 L126 68 M100 82 V112',
}

const palettes = [
  ['starter', '#6B7686', '#2B313B', 'bolt'],
  ['neon-rush', '#22C3E6', '#0F4A5C', 'wave'],
  ['emerald', '#3FAE5A', '#15401F', 'leaf'],
  ['night-ops', '#4A5361', '#16191F', 'eye'],
  ['violet-core', '#7C5CFF', '#2B1F66', 'diamond'],
  ['arctic', '#8FB8D8', '#27435A', 'star'],
  ['ember', '#E0662A', '#5A1E10', 'flame'],
  ['lunar', '#8C95C8', '#262B4E', 'moon'],
  ['phantom', '#A34FD6', '#35104F', 'skull'],
  ['prism', '#D8324F', '#4A1024', 'ring'],
  ['royal', '#D9A13A', '#5A3A0C', 'crown'],
  ['quantum', '#3E7BFF', '#141F66', 'cube'],
]

for (const [slug, light, deep, emblem] of palettes) {
  const id = slug.replace(/-/g, '')
  const body = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 160" fill="none">
  <defs>
    <linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${deep}"/></linearGradient>
    <linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".6" stop-color="${deep}"/></linearGradient>
    <linearGradient id="${id}m" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E8E2D0"/><stop offset="1" stop-color="#8A7E62"/></linearGradient>
    <radialGradient id="${id}g" cx=".5" cy=".6" r=".5"><stop offset="0" stop-color="${light}" stop-opacity=".35"/><stop offset="1" stop-color="${light}" stop-opacity="0"/></radialGradient>
    <filter id="${id}s" x="-10%" y="-10%" width="120%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000" flood-opacity=".55"/></filter>
  </defs>
  <ellipse cx="110" cy="90" rx="104" ry="64" fill="url(#${id}g)"/>
  <g filter="url(#${id}s)">
    <path d="M22 50 Q22 34 38 32 H182 Q198 34 198 50 V60 H22 Z" fill="url(#${id}l)"/>
    <rect x="22" y="58" width="176" height="84" rx="6" fill="url(#${id}f)"/>
    <path d="M22 62 H198" stroke="#000" stroke-opacity=".45" stroke-width="3"/>
    <path d="M40 36 V58 M70 34 V58 M150 34 V58 M180 36 V58" stroke="#000" stroke-opacity=".22" stroke-width="3"/>
    <path d="M30 70 V134 M190 70 V134" stroke="#000" stroke-opacity=".25" stroke-width="4"/>
    <rect x="22" y="58" width="176" height="84" rx="6" stroke="#fff" stroke-opacity=".12" stroke-width="1.5"/>
    <rect x="44" y="52" width="16" height="22" rx="2" fill="url(#${id}m)"/>
    <rect x="160" y="52" width="16" height="22" rx="2" fill="url(#${id}m)"/>
    <rect x="48" y="66" width="8" height="5" rx="1" fill="#3b3426"/>
    <rect x="164" y="66" width="8" height="5" rx="1" fill="#3b3426"/>
    <rect x="198" y="84" width="8" height="30" rx="2" fill="#000" fill-opacity=".35"/>
    <rect x="14" y="84" width="8" height="30" rx="2" fill="#000" fill-opacity=".35"/>
    <path d="M40 132 H180" stroke="#fff" stroke-opacity=".08" stroke-width="2"/>
    <g transform="translate(46 30) scale(.64)"><path d="${emblems[emblem]}" fill="url(#${id}m)" fill-rule="evenodd" stroke="#2b2418" stroke-opacity=".6" stroke-width="3"/></g>
    <text x="110" y="134" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="10" letter-spacing="3" fill="#000" fill-opacity=".35">GRADERUP</text>
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
console.log(`✓ generated ${Object.keys(items).length} item and ${palettes.length} case images`)

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
