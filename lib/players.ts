// Player skill model for the (for-entertainment) live odds.
//
// Rating is driven primarily by Zach's TIER ranking (his considered call on who's
// actually better), with handicap as a small refinement and current-form notes
// folded in. Higher rating = better. All constants here are meant to be tuned.

type Tier = 1 | 2 | 3 | 4 | 5

type PlayerInfo = {
  hcp: number
  tier: Tier
  form?: number // +/- current-form nudge
  adj?: number // misc manual edge (e.g. overall ranking) on top of tier/hcp
  note?: string // qualitative, surfaced in the UI tooltip later if wanted
}

// Keyed by lowercased first name (matches the names stored on matches).
export const PLAYERS: Record<string, PlayerInfo> = {
  pat: { hcp: 9.5, tier: 1, adj: 4, note: 'ranked #1' },
  jack: { hcp: 8.6, tier: 1 },
  nate: { hcp: 16.5, tier: 2 },
  sean: { hcp: 14.9, tier: 2, form: 4, note: 'playing well' },
  mitch: { hcp: 16.6, tier: 2 },
  zach: { hcp: 18.1, tier: 3, form: 4, note: 'playing well' },
  danny: { hcp: 21.8, tier: 3, form: -5, note: 'playing worse lately' },
  charlie: { hcp: 22.1, tier: 4 },
  mike: { hcp: 20, tier: 4 },
  sam: { hcp: 18.9, tier: 4, note: 'unpredictable — tier 3 upside' },
  joe: { hcp: 27.5, tier: 5 },
  henry: { hcp: 28.3, tier: 5 },
}

const TIER_BASE: Record<Tier, number> = { 1: 88, 2: 74, 3: 62, 4: 52, 5: 40 }
const HCP_PIVOT = 15 // handicap near this contributes ~0
const HCP_FACTOR = 0.3 // strokes -> rating points (small; tier dominates)
const DEFAULT_RATING = 55 // unknown name

export function ratingFor(name: string): number {
  const p = PLAYERS[name.trim().toLowerCase()]
  if (!p) return DEFAULT_RATING
  return TIER_BASE[p.tier] + (HCP_PIVOT - p.hcp) * HCP_FACTOR + (p.form ?? 0) + (p.adj ?? 0)
}
