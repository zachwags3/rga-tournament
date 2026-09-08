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
  // Updated Sept 2026 — Zach's current RGA tiers and handicaps. Form/adj nudges
  // cleared; tier + handicap now drive the rating. Pat and Mike withdrew from the
  // Kickoff Classic field, but their ratings stay here for future events.
  pat: { hcp: 8.4, tier: 1 },
  jack: { hcp: 8.6, tier: 1 },
  zach: { hcp: 13.5, tier: 2 },
  nate: { hcp: 14, tier: 2 },
  mitch: { hcp: 14.3, tier: 2 },
  sean: { hcp: 15, tier: 3 },
  sam: { hcp: 21.7, tier: 4 },
  joe: { hcp: 23.3, tier: 4 },
  mike: { hcp: 25, tier: 4 },
  henry: { hcp: 28.3, tier: 5 },
  // Not in the Sept 2026 ranking — left at their previous values.
  danny: { hcp: 21.8, tier: 3, form: -5, note: 'playing worse lately' },
  charlie: { hcp: 22.1, tier: 4 },
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
