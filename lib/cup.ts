import { calcMatchPlayStatus } from './matchplay'
import { effectiveRatings, liveProbs, cupProbs, type CupProbs } from './odds'
import type { Round, Match, HoleScore, Team } from '@/types/database'

export type MatchWithScores = Match & { hole_scores: HoleScore[] }
export type RoundWithMatches = Round & { matches: MatchWithScores[] }

// Assemble a snapshot's flat rows into rounds-with-matches (sorted, scores nested).
export function assembleRounds(
  rounds: Round[],
  matches: Match[],
  holeScores: HoleScore[]
): RoundWithMatches[] {
  return [...rounds]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(r => ({
      ...r,
      matches: matches
        .filter(m => m.round_id === r.id)
        .sort((a, b) => a.match_number - b.match_number)
        .map(m => ({ ...m, hole_scores: holeScores.filter(h => h.match_id === m.id) })),
    }))
}

export type RoundMarker = { label: string; frac: number } // frac = 0..1 position along the x-axis

export type CupResult = {
  gray?: Team
  navy?: Team
  hasMatches: boolean
  cupNow: { g: number; n: number; s: number }
  seriesV: number[] // Gray's win share over time (0–100, 50 = even), one point per scored hole
  roundMarkers: RoundMarker[] // x-axis ticks at the start of each round
}

// Short round label for the chart axis, e.g. "Saturday AM — 2v2 Scramble" -> "Sat AM".
function shortRoundLabel(name: string): string {
  return name.split('—')[0].trim().replace('Saturday', 'Sat').replace('Sunday', 'Sun')
}

// Cup Winner probabilities + live-movement series, derived from the match-play model.
// Shared by the live Odds page and the frozen History snapshot so they always agree.
export function computeCup(teams: Team[], rounds: RoundWithMatches[]): CupResult {
  const gray = teams.find(t => t.name.toLowerCase().includes('gray')) ?? teams[0]
  const navy = teams.find(t => t.name.toLowerCase().includes('navy')) ?? teams[1]

  // Per-match Gray/Navy outcome probabilities, optionally as of a point in time.
  const matchProbsAt = (cutoff: number | null) => {
    const out: { pGray: number; pTie: number; pNavy: number }[] = []
    for (const round of rounds) {
      for (const m of round.matches) {
        if (!m.team1_id || !m.team2_id) continue
        if (!m.team1_player_names?.length || !m.team2_player_names?.length) continue
        const holes = cutoff === null ? m.hole_scores : m.hole_scores.filter(h => Date.parse(h.created_at) <= cutoff)
        const st = calcMatchPlayStatus(holes, round.holes)
        const complete = st.isComplete || (cutoff === null && m.status === 'complete')
        let p1: number, pt: number, p2: number
        if (complete) {
          const w = st.isComplete ? st.winner : m.result === 'team1_win' ? 'team1' : m.result === 'team2_win' ? 'team2' : 'halved'
          p1 = w === 'team1' ? 1 : 0
          p2 = w === 'team2' ? 1 : 0
          pt = w === 'halved' ? 1 : 0
        } else {
          const { rA, rB } = effectiveRatings(m.team1_player_names, m.team2_player_names)
          const lp = liveProbs(rA, rB, st.holesUp, st.holesRemaining, round.holes)
          p1 = lp.pA; pt = lp.pTie; p2 = lp.pB
        }
        const t1Gray = m.team1_id === gray?.id
        out.push(t1Gray ? { pGray: p1, pTie: pt, pNavy: p2 } : { pGray: p2, pTie: pt, pNavy: p1 })
      }
    }
    // Every match is worth exactly 1 RGA point; pad unplayed points to the full pool
    // (sum of points_available) as neutral coin-flips so a partial lead isn't overstated.
    const totalPoints = rounds.reduce((sum, r) => sum + (r.points_available ?? 0), 0)
    for (let i = out.length; i < totalPoints; i++) {
      out.push({ pGray: 0.5, pTie: 0, pNavy: 0.5 })
    }
    return out
  }

  // Anchor the opening Cup line to a pick'em (Gray -110 / Navy -110), then let it move.
  const TARGET_GRAY = 0.5
  const share = (c: CupProbs) => (c.pGray + c.pNavy > 0 ? c.pGray / (c.pGray + c.pNavy) : 0.5)
  const bias = TARGET_GRAY - share(cupProbs(matchProbsAt(0)))
  const cupPct = (c: CupProbs) => {
    const sAdj = Math.min(0.999, Math.max(0.001, share(c) + bias))
    const tie = Math.min(0.01, c.pTie)
    const gp = Math.round(sAdj * (1 - tie) * 100)
    const np = Math.round((1 - sAdj) * (1 - tie) * 100)
    return { g: gp, n: np, s: sAdj }
  }

  const hasMatches = matchProbsAt(null).length > 0
  const cupNow = cupPct(cupProbs(matchProbsAt(null)))

  // Replay: opening + one point per scored hole (in timestamp order).
  const times = Array.from(
    new Set(rounds.flatMap(r => r.matches.flatMap(m => m.hole_scores.map(h => Date.parse(h.created_at)))))
  ).sort((a, b) => a - b)
  const seriesPts = [0, ...times].map(t => cupPct(cupProbs(matchProbsAt(t))))
  const seriesV = seriesPts.map(p => (p.g + p.n > 0 ? (p.g / (p.g + p.n)) * 100 : 50))

  // Round-start markers: where each round's first scored hole lands on the timeline.
  const roundMarkers: RoundMarker[] = []
  if (times.length > 1) {
    for (const r of [...rounds].sort((a, b) => a.sort_order - b.sort_order)) {
      const ts = r.matches.flatMap(m => m.hole_scores.map(h => Date.parse(h.created_at)))
      if (ts.length === 0) continue
      const idx = times.indexOf(Math.min(...ts))
      if (idx < 0) continue
      roundMarkers.push({ label: shortRoundLabel(r.name), frac: idx / times.length })
    }
  }

  return { gray, navy, hasMatches, cupNow, seriesV, roundMarkers }
}
