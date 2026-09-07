import { ratingFor } from '../players'
import { TOTAL_HOLES, type ScrambleTeam } from './config'
import type { LeaderRow } from './scoring'

// --- Tunables ---------------------------------------------------------------
const W_MAX = 0.32   // weight on the stronger partner (a weak partner drags a scramble)
const W_MIN = 0.68   // weight on the weaker partner
const SYNERGY = 2
const REF_RATING = 62   // pair rating that plays to BASE_TO_PAR
const BASE_TO_PAR = 8   // expected 18-hole score-to-par at the reference rating
const SLOPE = 0.18      // strokes better per rating point above the reference
const HOLE_SD = 1.25    // per-hole scoring standard deviation for a 2-man scramble
const FORM_WEIGHT = 6   // holes of live play needed before form counts ~50%
// ---------------------------------------------------------------------------

export function pairRating(team: ScrambleTeam): number {
  const a = ratingFor(team.captain)
  const b = ratingFor(team.partner)
  return W_MAX * Math.max(a, b) + W_MIN * Math.min(a, b) + SYNERGY
}

// Pre-round expectation for a pair's 18-hole score relative to par.
export function priorToPar(team: ScrambleTeam): number {
  return BASE_TO_PAR - SLOPE * (pairRating(team) - REF_RATING)
}

const erf = (x: number) => {
  const s = x < 0 ? -1 : 1
  x = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * x)
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x)
  return s * y
}
const cdf = (x: number, m: number, s: number) => 0.5 * (1 + erf((x - m) / (s * Math.SQRT2)))
const pdf = (x: number, m: number, s: number) =>
  Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI))

export type TeamProjection = { slug: string; mean: number; sd: number }

// Project each team's finishing score-to-par: what they've already banked, plus
// their remaining holes at a rate that blends their pre-round prior with how
// they're actually playing today.
export function projections(rows: LeaderRow[]): TeamProjection[] {
  return rows.map(r => {
    const remaining = Math.max(0, TOTAL_HOLES - r.played)
    const prior = priorToPar(r.team) / TOTAL_HOLES
    const live = r.played > 0 ? r.toPar / r.played : prior
    const w = r.played / (r.played + FORM_WEIGHT)
    const rate = prior * (1 - w) + live * w
    return {
      slug: r.team.slug,
      mean: r.toPar + rate * remaining,
      sd: remaining > 0 ? Math.max(0.4, HOLE_SD * Math.sqrt(remaining)) : 0.01,
    }
  })
}

// P(each team posts the lowest score), by numerically integrating
// f_i(x) * prod_{j != i} (1 - F_j(x)) over the plausible scoring range.
export function winProbabilities(rows: LeaderRow[]): Map<string, number> {
  const proj = projections(rows)
  const out = new Map<string, number>()
  const lo = -25, hi = 45, step = 0.2
  let total = 0
  for (const p of proj) {
    let acc = 0
    for (let x = lo; x <= hi; x += step) {
      let survive = 1
      for (const q of proj) if (q.slug !== p.slug) survive *= 1 - cdf(x, q.mean, q.sd)
      acc += pdf(x, p.mean, p.sd) * survive * step
    }
    out.set(p.slug, acc)
    total += acc
  }
  if (total > 0) for (const [k, v] of out) out.set(k, v / total)
  return out
}
