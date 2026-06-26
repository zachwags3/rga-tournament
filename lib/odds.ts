import { ratingFor } from './players'

// --- Tunable feel constants -------------------------------------------------
const SCALE = 60 // bigger = closer odds for a given rating gap
const HALVE = 0.42 // baseline probability a hole is halved
const SYNERGY = 2 // scramble/shamble: a pair plays a touch better than its parts
// Weight the WEAKER partner more: a bad partner drags a scramble, so a lone stud
// + weak player is rated below a balanced pair of the same average.
const W_MAX = 0.32 // weight on the stronger partner
const W_MIN = 0.68 // weight on the weaker partner
// ---------------------------------------------------------------------------

const logistic = (x: number) => 1 / (1 + Math.exp(-x))

// Manual per-matchup overrides for lines Zach wants pinned regardless of the model.
// `even` forces a 50/50 opening; the model still moves it live from there.
type Override = { a: string[]; b: string[]; mode: 'even' }
const OVERRIDES: Override[] = [
  { a: ['zach', 'danny'], b: ['jack', 'sam'], mode: 'even' },
]

const namesKey = (arr: string[]) => arr.map(s => s.trim().toLowerCase()).sort().join('|')

// Effective side ratings for a matchup, applying any override (order-independent).
export function effectiveRatings(team1: string[], team2: string[]): { rA: number; rB: number } {
  const r1 = sideRating(team1)
  const r2 = sideRating(team2)
  const k1 = namesKey(team1)
  const k2 = namesKey(team2)
  for (const o of OVERRIDES) {
    const oa = namesKey(o.a)
    const ob = namesKey(o.b)
    if ((k1 === oa && k2 === ob) || (k1 === ob && k2 === oa)) {
      if (o.mode === 'even') {
        const mid = (r1 + r2) / 2
        return { rA: mid, rB: mid }
      }
    }
  }
  return { rA: r1, rB: r2 }
}

// Combine a side's player ratings into one number.
export function sideRating(names: string[]): number {
  const rs = names.map(ratingFor)
  if (rs.length === 0) return 55
  if (rs.length === 1) return rs[0]
  const max = Math.max(...rs)
  const min = Math.min(...rs)
  return W_MAX * max + W_MIN * min + SYNERGY
}

// Probability side A wins a single hole (the rest split between B-win and halve).
function holeWinProb(rA: number, rB: number): number {
  return (1 - HALVE) * logistic((rA - rB) / SCALE)
}

export type WinProbs = { pA: number; pTie: number; pB: number }

// Distribution of the match result given current lead (holesUp, + favors A) and
// holes remaining. Rolls the per-hole outcomes forward — a clinched match falls
// out naturally (remaining holes can't flip a lead bigger than what's left).
export function matchWinProbs(
  rA: number,
  rB: number,
  holesUp: number,
  remaining: number
): WinProbs {
  const pWinA = holeWinProb(rA, rB)
  const pWinB = holeWinProb(rB, rA)
  const pHalve = 1 - pWinA - pWinB

  let dist = new Map<number, number>([[holesUp, 1]])
  for (let i = 0; i < remaining; i++) {
    const next = new Map<number, number>()
    const bump = (net: number, prob: number) =>
      next.set(net, (next.get(net) ?? 0) + prob)
    for (const [net, prob] of dist) {
      bump(net + 1, prob * pWinA)
      bump(net, prob * pHalve)
      bump(net - 1, prob * pWinB)
    }
    dist = next
  }

  let pA = 0, pTie = 0, pB = 0
  for (const [net, prob] of dist) {
    if (net > 0) pA += prob
    else if (net < 0) pB += prob
    else pTie += prob
  }
  return { pA, pTie, pB }
}

// Dampened live odds: blend the live position toward the opening line so a single
// hole doesn't swing the number too hard. The blend tightens toward the true live
// model as the round progresses (RESPONSIVENESS at hole 1 -> full by the last hole).
const RESPONSIVENESS = 0.35
export function liveProbs(
  rA: number,
  rB: number,
  holesUp: number,
  remaining: number,
  totalHoles: number
): WinProbs {
  const live = matchWinProbs(rA, rB, holesUp, remaining)
  const open = matchWinProbs(rA, rB, 0, totalHoles)
  const played = totalHoles - remaining
  const w = Math.min(1, RESPONSIVENESS + (1 - RESPONSIVENESS) * (played / totalHoles))
  const b = (l: number, o: number) => o + (l - o) * w
  let pA = b(live.pA, open.pA)
  let pTie = b(live.pTie, open.pTie)
  let pB = b(live.pB, open.pB)
  // A side that mathematically can't win the match must read 0 (don't let the
  // blend toward the opening line invent a win chance for an eliminated side).
  if (live.pA === 0) pA = 0
  if (live.pB === 0) pB = 0
  const s = pA + pTie + pB || 1
  return { pA: pA / s, pTie: pTie / s, pB: pB / s }
}

// Three-way display line: keep the model's relative favoritism but show the tie
// ("split") as a small 4–6% band (closer matchup -> nearer 6%, lopsided -> nearer
// 4%), and let it shrink below that as a match nears clinching. All sum to 100%.
export function displayLine(
  pA: number,
  pTie: number,
  pB: number,
  remaining?: number
): { aPct: number; bPct: number; tiePct: number; pAd: number; pBd: number } {
  const s = pA + pB > 0 ? pA / (pA + pB) : 0.5
  const edge = Math.min(1, Math.abs(s - 0.5) * 2)
  const band = 0.06 - 0.02 * edge // small 4-6% cap for opening/early
  const capped = Math.min(band, pTie)
  // Early in a match the tie is held to the small band; as the match nears its end
  // the true (often large) match-tie probability is revealed — e.g. 1 up with 1 to
  // play is roughly a coin flip between "leader wins" and "match halved".
  const w = remaining == null ? 0 : Math.max(0, Math.min(1, 1 - (remaining - 1) / 4))
  const tie = capped + (pTie - capped) * w
  const pAd = s * (1 - tie)
  const pBd = (1 - s) * (1 - tie)
  const aPct = Math.round(pAd * 100)
  const bPct = Math.round(pBd * 100)
  return { aPct, bPct, tiePct: 100 - aPct - bPct, pAd, pBd }
}

// Aggregate per-match outcome probabilities into Cup (overall) win probabilities.
// Each match is worth 1 point; a team wins the Cup with more than half the points.
// Convolves the points distribution (tracked in half-point units -> integer *2).
export type CupProbs = { pGray: number; pTie: number; pNavy: number }
export function cupProbs(
  matches: { pGray: number; pTie: number; pNavy: number }[]
): CupProbs {
  if (matches.length === 0) return { pGray: 0.5, pTie: 0, pNavy: 0.5 }
  let dist = new Map<number, number>([[0, 1]]) // key = gray points * 2
  for (const m of matches) {
    const next = new Map<number, number>()
    const add = (k: number, v: number) => next.set(k, (next.get(k) ?? 0) + v)
    for (const [k, prob] of dist) {
      add(k + 2, prob * m.pGray) // gray wins -> +1 pt
      add(k + 1, prob * m.pTie) // halved -> +0.5 each
      add(k + 0, prob * m.pNavy) // navy wins -> +0
    }
    dist = next
  }
  const N = matches.length // total points; threshold N/2 -> key N in *2 units
  let pGray = 0, pTie = 0, pNavy = 0
  for (const [k, prob] of dist) {
    if (k > N) pGray += prob
    else if (k < N) pNavy += prob
    else pTie += prob
  }
  return { pGray, pTie, pNavy }
}

// Fair American moneyline from a win probability (no vig).
export function toAmerican(p: number): string {
  if (p >= 0.999) return '-100000'
  if (p <= 0.001) return '+100000'
  const round5 = (x: number) => Math.round(x / 5) * 5
  if (p >= 0.5) return `-${round5((100 * p) / (1 - p))}`
  return `+${round5((100 * (1 - p)) / p)}`
}

export const pct = (p: number) => `${Math.round(p * 100)}%`
