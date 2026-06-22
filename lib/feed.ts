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

function fmtPts(n: number): string {
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

// Cumulative RGA team standing, e.g. "Gray up 2-0" or "Tied 1-1".
function rgaStanding(teamPoints: Record<string, number>, teams: Team[]): string {
  const a = teams[0]
  const b = teams[1]
  if (!a || !b) return ''
  const pa = teamPoints[a.id] ?? 0
  const pb = teamPoints[b.id] ?? 0
  if (pa > pb) return `${a.name} up ${fmtPts(pa)}-${fmtPts(pb)}`
  if (pb > pa) return `${b.name} up ${fmtPts(pb)}-${fmtPts(pa)}`
  return `Tied ${fmtPts(pa)}-${fmtPts(pb)}`
}

// Describe the new match standing from the perspective of the side that just won the hole.
function standingClause(newHolesUp: number, winner: Side, holeNumber: number): string {
  const margin = winner === 'team1' ? newHolesUp : -newHolesUp
  if (margin > 0) return `to go ${margin} UP`
  if (margin === 0) return `to tie it up, A/S thru ${holeNumber}`
  return `to within ${Math.abs(margin)}`
}

export function buildFeed(input: FeedInput): FeedPost[] {
  const { rounds, matches, holeScores, teams, parsByRound } = input
  const posts: FeedPost[] = []
  // Result posts get a running RGA standing appended after the full chronology is known.
  const resultRefs: { post: FeedPost; winner: Side | 'halved'; t1Id: string; t2Id: string }[] = []

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

    const pushResult = (post: FeedPost, winner: Side | 'halved') => {
      posts.push(post)
      resultRefs.push({ post, winner, t1Id: match.team1_id, t2Id: match.team2_id })
    }

    for (const h of scores) {
      if (matchClosed) break // match already decided — stop posting further holes

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

      // 1) Result (closeout or final-hole win) takes precedence over a generic hole post
      const isCloseout = Math.abs(holesUp) > remaining && remaining >= 0
      if (isCloseout) {
        matchClosed = true
        const margin = Math.abs(holesUp)
        const text = remaining > 0
          ? `${namesFor(side)} close out ${oppFor(side)}, ${margin}&${remaining}.`
          : `${namesFor(side)} beat ${oppFor(side)} ${margin} UP.`
        pushResult({ id: `${idBase}-result`, ts, borderColor: colorForSide(side), text }, side)
        continue
      }

      // 2) Shot-based posts (ace > eagle/albatross > birdie/plain), with standing + streak
      const winScore = side === 'team1' ? h.team1_score : h.team2_score
      const par = pars[h.hole_number] ?? null
      const diff = par != null && winScore != null ? winScore - par : null
      const clause = standingClause(holesUp, side, h.hole_number)
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

    // Match ran the full distance without clinching early (e.g. won/halved on the last hole)
    if (!matchClosed && decided === round.holes) {
      const last = scores[scores.length - 1]
      const ts = last?.created_at ?? match.created_at
      if (holesUp === 0) {
        matchClosed = true
        pushResult({
          id: `${match.id}-result`,
          ts,
          borderColor: NEUTRAL_BORDER,
          text: `${t1Names} and ${t2Names} halve their match.`,
        }, 'halved')
      } else {
        const side: Side = holesUp > 0 ? 'team1' : 'team2'
        matchClosed = true
        pushResult({
          id: `${match.id}-result`,
          ts,
          borderColor: colorForSide(side),
          text: `${namesFor(side)} beat ${oppFor(side)} ${Math.abs(holesUp)} UP.`,
        }, side)
      }
    }

    // 3) Turn (front nine) summary — 18-hole rounds only, once hole 9 is in and the
    // match hadn't already been clinched before reaching the turn.
    if (round.holes === 18) {
      const front = scores.filter(h => h.hole_number <= 9)
      const hole9 = front.find(h => h.hole_number === 9)
      if (hole9) {
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

    // 4) Safety net: match finalized by admin without the math clinching it
    if (!matchClosed && match.status === 'complete' && match.result) {
      const last = scores[scores.length - 1]
      const ts = last?.created_at ?? match.created_at
      if (match.result === 'halved') {
        pushResult({
          id: `${match.id}-result`,
          ts,
          borderColor: NEUTRAL_BORDER,
          text: `${t1Names} and ${t2Names} halve their match.`,
        }, 'halved')
      } else {
        const side: Side = match.result === 'team1_win' ? 'team1' : 'team2'
        pushResult({
          id: `${match.id}-result`,
          ts,
          borderColor: colorForSide(side),
          text: `${namesFor(side)} beat ${oppFor(side)}.`,
        }, side)
      }
    }
  }

  // Append cumulative RGA standing to each result, accumulating in completion order.
  const teamPoints: Record<string, number> = {}
  for (const r of [...resultRefs].sort((a, b) => new Date(a.post.ts).getTime() - new Date(b.post.ts).getTime())) {
    if (r.winner === 'halved') {
      teamPoints[r.t1Id] = (teamPoints[r.t1Id] ?? 0) + 0.5
      teamPoints[r.t2Id] = (teamPoints[r.t2Id] ?? 0) + 0.5
    } else {
      const wid = r.winner === 'team1' ? r.t1Id : r.t2Id
      teamPoints[wid] = (teamPoints[wid] ?? 0) + 1
    }
    const standing = rgaStanding(teamPoints, teams)
    if (standing) r.post.text += ` ${standing}`
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
