import { COURSE, SCRAMBLE_TEAMS, TOTAL_HOLES, parFor, type ScrambleTeam } from './config'

// One row per team per hole, as stored in Supabase.
export type ScrambleScore = {
  team_slug: string
  hole_number: number
  strokes: number | null
}

export type LeaderRow = {
  team: ScrambleTeam
  pos: string        // "1", "T2", or "—" before anyone starts
  strokes: number    // gross strokes over the holes actually played
  parPlayed: number  // par for exactly those holes
  toPar: number
  thru: number       // highest hole completed
  played: number     // count of holes completed
  started: boolean
  complete: boolean
}

export const fmtToPar = (n: number) => (n === 0 ? 'E' : n > 0 ? `+${n}` : `${n}`)

// Map of "slug:hole" -> strokes, for the scorecard grid.
export function scoreMap(scores: ScrambleScore[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const s of scores) {
    if (s.strokes != null && s.strokes > 0) m.set(`${s.team_slug}:${s.hole_number}`, s.strokes)
  }
  return m
}

// Stroke-play leaderboard. To-par is computed against the par of the exact holes
// a team has completed, so a team mid-round is compared fairly against the field.
export function buildLeaderboard(scores: ScrambleScore[]): LeaderRow[] {
  const byTeam = new Map<string, ScrambleScore[]>()
  for (const s of scores) {
    if (s.strokes == null || s.strokes <= 0) continue
    const arr = byTeam.get(s.team_slug) ?? []
    arr.push(s)
    byTeam.set(s.team_slug, arr)
  }

  const rows: LeaderRow[] = SCRAMBLE_TEAMS.map(team => {
    const mine = byTeam.get(team.slug) ?? []
    const strokes = mine.reduce((sum, s) => sum + (s.strokes ?? 0), 0)
    const parPlayed = mine.reduce((sum, s) => sum + parFor(s.hole_number), 0)
    const thru = mine.length ? Math.max(...mine.map(s => s.hole_number)) : 0
    return {
      team,
      pos: '—',
      strokes,
      parPlayed,
      toPar: strokes - parPlayed,
      thru,
      played: mine.length,
      started: mine.length > 0,
      complete: mine.length >= TOTAL_HOLES,
    }
  })

  // Lowest to-par leads; ties broken by holes completed (further along shown first).
  rows.sort((a, b) => a.toPar - b.toPar || b.played - a.played)

  // Positions, with T-prefix on ties (teams yet to start share the field's E).
  let i = 0
  while (i < rows.length) {
    let j = i
    while (j + 1 < rows.length && rows[j + 1].toPar === rows[i].toPar) j++
    const tied = j - i + 1
    for (let k = i; k <= j; k++) rows[k].pos = `${tied > 1 ? 'T' : ''}${i + 1}`
    i = j + 1
  }
  return rows
}

// Out / In / Total for one team, used by the scorecard grid.
export function splits(slug: string, map: Map<string, number>) {
  const sum = (from: number, to: number) =>
    COURSE.filter(h => h.hole >= from && h.hole <= to)
      .reduce((s, h) => s + (map.get(`${slug}:${h.hole}`) ?? 0), 0)
  return { out: sum(1, 9), in: sum(10, 18), total: sum(1, 18) }
}
