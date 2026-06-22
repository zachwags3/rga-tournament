import type { Round, Match, HoleScore, Team } from '@/types/database'

export type FeedPost = {
  id: string
  ts: string // ISO timestamp for sorting + display
  borderColor: string
  text: string
}

type Side = 'team1' | 'team2'

export type FeedInput = {
  rounds: Round[]
  matches: Match[]
  holeScores: HoleScore[]
  teams: Team[]
  // round_id -> (hole_number -> par)
  parsByRound: Record<string, Record<number, number>>
}

const NEUTRAL_BORDER = '#cbd5e1' // muted gray for halves / all-square

const NUM_WORDS = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

function numWord(n: number): string {
  return NUM_WORDS[n] ?? String(n)
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function joinNames(names: string[]): string {
  if (!names || names.length === 0) return 'TBD'
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

// Describe the new match standing from the perspective of the side that just won the hole.
function standingClause(newHolesUp: number, winner: Side): string {
  const margin = winner === 'team1' ? newHolesUp : -newHolesUp
  if (margin > 0) return `to go ${margin} up`
  if (margin === 0) return `to draw all square`
  return `to within ${Math.abs(margin)}`
}

export function buildFeed(input: FeedInput): FeedPost[] {
  const { rounds, matches, holeScores, teams, parsByRound } = input
  const posts: FeedPost[] = []

  const colorFor = (id: string | null): string =>
    (id && teams.find(t => t.id === id)?.color) || NEUTRAL_BORDER

  const roundsById = new Map(rounds.map(r => [r.id, r]))

  for (const match of matches) {
    const round = roundsById.get(match.round_id)
    if (!round) continue

    const t1Names = joinNames(match.team1_player_names)
    const t2Names = joinNames(match.team2_player_names)
    const namesFor = (s: Side) => (s === 'team1' ? t1Names : t2Names)
    const oppFor = (s: Side) => (s === 'team1' ? t2Names : t1Names)
    const colorForSide = (s: Side) =>
      colorFor(s === 'team1' ? match.team1_id : match.team2_id)

    const pars = parsByRound[match.round_id] ?? {}

    const scores = match.id
      ? holeScores
          .filter(h => h.match_id === match.id && h.winner != null)
          .sort((a, b) => a.hole_number - b.hole_number)
      : []

    let holesUp = 0 // positive = team1 ahead
    let decided = 0
    let streakSide: Side | null = null
    let streakLen = 0
    let matchClosed = false

    for (const h of scores) {
      decided++
      const remaining = round.holes - decided

      if (h.winner === 'halved') {
        streakSide = null
        streakLen = 0
        continue // ties are not posted
      }

      const side = h.winner as Side
      holesUp += side === 'team1' ? 1 : -1

      // streak bookkeeping
      if (streakSide === side) streakLen++
      else { streakSide = side; streakLen = 1 }

      const ts = h.created_at
      const idBase = `${match.id}-h${h.hole_number}`

      // 1) Closeout / final-hole result takes precedence over a generic hole post
      const isCloseout = !matchClosed && Math.abs(holesUp) > remaining && remaining >= 0
      const isFinalHole = decided === round.holes
      if (isCloseout || (isFinalHole && !matchClosed)) {
        matchClosed = true
        const margin = Math.abs(holesUp)
        if (isCloseout && remaining > 0) {
          posts.push({
            id: `${idBase}-result`,
            ts,
            borderColor: colorForSide(side),
            text: `${namesFor(side)} close out ${oppFor(side)}, ${margin}&${remaining}.`,
          })
        } else {
          posts.push({
            id: `${idBase}-result`,
            ts,
            borderColor: colorForSide(side),
            text: `${namesFor(side)} beat ${oppFor(side)} ${margin} up.`,
          })
        }
        continue
      }

      // 2) Shot-based posts (ace > eagle/albatross > birdie/plain), with standing + streak
      const winScore = side === 'team1' ? h.team1_score : h.team2_score
      const par = pars[h.hole_number] ?? null
      const diff = par != null && winScore != null ? winScore - par : null
      const clause = standingClause(holesUp, side)
      const streakNote = streakLen >= 2 ? ` That's ${numWord(streakLen)} in a row.` : ''

      if (winScore === 1) {
        posts.push({
          id: `${idBase}-ace`,
          ts,
          borderColor: colorForSide(side),
          text: `Ace. ${namesFor(side)} hole out on the ${ordinal(h.hole_number)} ${clause}.${streakNote}`,
        })
      } else if (diff != null && diff <= -2) {
        const label = diff <= -3 ? 'albatross' : 'eagle'
        posts.push({
          id: `${idBase}-eagle`,
          ts,
          borderColor: colorForSide(side),
          text: `${namesFor(side)} make ${label} on the ${ordinal(h.hole_number)} ${clause}.${streakNote}`,
        })
      } else {
        const shot = diff === -1 ? ' with a birdie' : ''
        posts.push({
          id: `${idBase}-hole`,
          ts,
          borderColor: colorForSide(side),
          text: `${namesFor(side)} win hole ${h.hole_number}${shot} ${clause}.${streakNote}`,
        })
      }
    }

    // 3) Turn (front nine) summary — 18-hole rounds only, once hole 9 is in and the
    // match hadn't already been closed before reaching the turn.
    if (round.holes === 18) {
      const front = scores.filter(h => h.hole_number <= 9)
      const hole9 = front.find(h => h.hole_number === 9)
      const closedBeforeTurn = matchClosed && decided <= 9
      if (hole9 && !closedBeforeTurn) {
        let up = 0
        for (const h of front) {
          if (h.winner === 'team1') up++
          else if (h.winner === 'team2') up--
        }
        if (up === 0) {
          posts.push({
            id: `${match.id}-turn`,
            ts: hole9.created_at,
            borderColor: NEUTRAL_BORDER,
            text: `${t1Names} and ${t2Names} are all square through the front nine.`,
          })
        } else {
          const leadSide: Side = up > 0 ? 'team1' : 'team2'
          posts.push({
            id: `${match.id}-turn`,
            ts: hole9.created_at,
            borderColor: colorForSide(leadSide),
            text: `${namesFor(leadSide)} lead by ${Math.abs(up)} through the front nine.`,
          })
        }
      }
    }

    // 4) Fallback result if the match was finalized but no closeout/final post fired
    // (e.g. finalized early by admin without the math closing it out).
    if (match.status === 'complete' && match.result && !matchClosed) {
      const last = scores[scores.length - 1]
      const ts = last?.created_at ?? match.created_at
      if (match.result === 'halved') {
        posts.push({
          id: `${match.id}-result`,
          ts,
          borderColor: NEUTRAL_BORDER,
          text: `${t1Names} and ${t2Names} halve their match.`,
        })
      } else {
        const side: Side = match.result === 'team1_win' ? 'team1' : 'team2'
        posts.push({
          id: `${match.id}-result`,
          ts,
          borderColor: colorForSide(side),
          text: `${namesFor(side)} win their match over ${oppFor(side)}.`,
        })
      }
    }
  }

  // Newest first; tie-break keeps later holes above earlier ones at the same instant.
  posts.sort((a, b) => {
    const d = new Date(b.ts).getTime() - new Date(a.ts).getTime()
    if (d !== 0) return d
    return b.id.localeCompare(a.id)
  })

  return posts
}

// "Sat 2:14 PM" — weekday + clock time (multi-day friendly, no relative time).
export function formatFeedTime(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
