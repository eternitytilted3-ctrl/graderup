import { createHash } from 'node:crypto'
import type { Rarity } from '../db/schema'

/**
 * Offline RUB price estimate for a CS2 skin — used ONLY when no market source (market.csgo.com,
 * Skinport) is reachable. Anchored on typical market levels: knife/glove model × finish, weapon
 * popularity × rarity, iconic skins, exterior. Deterministic (hash-based spread) so reseeds match.
 * Items priced this way get price_source = 'estimate'; run `npm run prices:sync` for real prices.
 */
export interface EstimateInput {
  marketHashName: string
  rarity: Rarity
  weapon: string
  pattern: string | null
  wear: string | null
}

const WEAR: Record<string, number> = { 'Factory New': 1.8, 'Minimal Wear': 1.3, 'Field-Tested': 1, 'Well-Worn': 0.85, 'Battle-Scarred': 0.75 }

/** Field-Tested, mid-tier finish, RUB. */
const KNIFE_BASE: Record<string, number> = {
  Karambit: 70000,
  'Butterfly Knife': 95000,
  'M9 Bayonet': 55000,
  'Talon Knife': 50000,
  'Skeleton Knife': 45000,
  'Stiletto Knife': 32000,
  Bayonet: 30000,
  'Classic Knife': 25000,
  'Kukri Knife': 22000,
  'Flip Knife': 20000,
  'Nomad Knife': 18000,
  'Ursus Knife': 15000,
  'Huntsman Knife': 14000,
  'Paracord Knife': 12000,
  'Survival Knife': 12000,
  'Bowie Knife': 11000,
  'Falchion Knife': 10000,
  'Gut Knife': 8000,
  'Shadow Daggers': 7500,
  'Navaja Knife': 7000,
  'Sport Gloves': 60000,
  'Specialist Gloves': 35000,
  'Moto Gloves': 25000,
  'Driver Gloves': 20000,
  'Hand Wraps': 18000,
  'Bloodhound Gloves': 15000,
  'Hydra Gloves': 12000,
  'Broken Fang Gloves': 12000,
}

const KNIFE_FINISH: Record<string, number> = {
  Fade: 2,
  'Marble Fade': 1.8,
  Doppler: 1.7,
  'Gamma Doppler': 1.9,
  Lore: 1.9,
  Autotronic: 1.4,
  'Tiger Tooth': 1.5,
  'Crimson Web': 1.4,
  Slaughter: 1.4,
  'Case Hardened': 1.2,
  'Black Laminate': 1,
  Freehand: 1,
  'Bright Water': 0.85,
  Ultraviolet: 0.95,
  'Damascus Steel': 0.85,
  'Blue Steel': 0.95,
  Night: 0.85,
  'Night Stripe': 0.7,
  Stained: 0.75,
  'Rust Coat': 0.65,
  Scorched: 0.6,
  'Urban Masked': 0.6,
  'Safari Mesh': 0.55,
  'Boreal Forest': 0.6,
  'Forest DDPAT': 0.6,
}

/** Field-Tested base by rarity for an average weapon, RUB. */
const RARITY_BASE: Record<Rarity, number> = { common: 4, uncommon: 8, rare: 20, epic: 90, legendary: 400, mythic: 1800 }

const WEAPON_MULT: Record<string, number> = {
  AWP: 2.5,
  'AK-47': 2.2,
  'M4A1-S': 1.8,
  M4A4: 1.7,
  'Desert Eagle': 1.5,
  'USP-S': 1.5,
  'Glock-18': 1.3,
  'SSG 08': 1.1,
  P90: 1,
  MP9: 0.9,
  'MAC-10': 0.9,
  'Five-SeveN': 0.9,
  P250: 0.8,
}

/** Iconic skins, Field-Tested-equivalent RUB (exterior multiplier still applies). */
const ICONIC: Record<string, number> = {
  'AWP | Dragon Lore': 700000,
  'AWP | Gungnir': 600000,
  'AWP | Medusa': 250000,
  'AWP | The Prince': 150000,
  'AWP | Desert Hydra': 120000,
  'AWP | Fade': 90000,
  'AWP | Lightning Strike': 45000,
  'AWP | Asiimov': 9000,
  'AWP | Containment Breach': 8000,
  'AWP | Wildfire': 7000,
  'AWP | Printstream': 5000,
  'AK-47 | Wild Lotus': 600000,
  'AK-47 | Gold Arabesque': 250000,
  'AK-47 | Fire Serpent': 70000,
  'AK-47 | Hydroponic': 40000,
  'AK-47 | X-Ray': 25000,
  'AK-47 | Case Hardened': 15000,
  'AK-47 | Vulcan': 12000,
  'AK-47 | Jaguar': 7000,
  'AK-47 | Bloodsport': 6000,
  'AK-47 | Asiimov': 6000,
  'AK-47 | Fuel Injector': 5000,
  'AK-47 | The Empress': 5000,
  'AK-47 | Redline': 2500,
  'M4A4 | Howl': 350000,
  'M4A4 | Poseidon': 60000,
  'M4A4 | Asiimov': 8000,
  'M4A1-S | Knight': 80000,
  'M4A1-S | Welcome to the Jungle': 60000,
  'M4A1-S | Hot Rod': 30000,
  'M4A1-S | Icarus Fell': 25000,
  'M4A1-S | Printstream': 10000,
  'Desert Eagle | Blaze': 50000,
  'Desert Eagle | Golden Koi': 6000,
  'Desert Eagle | Printstream': 5000,
  'Glock-18 | Fade': 150000,
  'Glock-18 | Gamma Doppler': 20000,
  'P90 | Emerald Dragon': 20000,
  'USP-S | Kill Confirmed': 6000,
  'USP-S | Printstream': 6000,
  'USP-S | The Traitor': 5000,
  'SSG 08 | Dragonfire': 5000,
}

function spread(key: string, lo: number, hi: number) {
  const u = createHash('sha1').update(key).digest().readUInt32BE(0) / 0xffffffff
  return Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * u)
}

export function estimateRubPrice(s: EstimateInput): number {
  const base = s.marketHashName.replace(/^★\s*/, '').replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/, '')
  const wear = WEAR[s.wear ?? ''] ?? 1
  let price: number
  if (s.marketHashName.startsWith('★')) {
    const model = KNIFE_BASE[s.weapon] ?? 15000
    const isGloves = /Gloves|Wraps/.test(s.weapon)
    // Vanilla knives (no finish) trade well above average finishes.
    const finish = !s.pattern ? 1.3 : isGloves ? spread(base, 0.6, 3) : (KNIFE_FINISH[s.pattern] ?? spread(base, 0.8, 1.3))
    price = model * finish * (isGloves ? 1 : spread(base, 0.9, 1.12))
  } else if (ICONIC[base]) {
    price = ICONIC[base]
  } else {
    price = RARITY_BASE[s.rarity] * (WEAPON_MULT[s.weapon] ?? 0.85) * spread(base, 0.45, 2.2)
  }
  return Math.max(3, Math.round(price * wear * 100) / 100)
}

const WEAR_RE = /\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/

/** Same estimate from a stored item (market_hash_name + rarity): "★ Karambit | Fade (Factory New)". */
export function estimateFromName(marketHashName: string, rarity: Rarity): number {
  const wear = marketHashName.match(WEAR_RE)?.[1] ?? null
  const core = marketHashName.replace(WEAR_RE, '').replace(/^★\s*/, '')
  const [weapon, pattern] = core.split(' | ')
  return estimateRubPrice({ marketHashName, rarity, weapon: weapon.trim(), pattern: pattern?.trim() || null, wear })
}
