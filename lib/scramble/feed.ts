import { COURSE, SCRAMBLE_TEAMS, TOTAL_HOLES, parFor, strokesOnHole, teamName } from './config'
import { fmtToPar } from './scoring'

export type ScrambleScoreRow = {
  team_slug: string
  hole_number: number
  strokes: number | null
  created_at: string
}

export type FeedPost = {
  id: string
  at: number
  label: string | null   // tag shown on tinted cards, e.g. "FINAL"
  text: string
  tone: 'plain' | 'good' | 'final'
}

const clock = (ms: number) =>
  new Date(ms).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })

const OUT_PAR = COURSE.filter(h => h.hole <= 9).reduce((s, h) => s + h.par, 0)

// Derive the live feed from raw hole scores — nothing is stored, it's all on-read.
export function buildFeed(rows: ScrambleScoreRow[]): FeedPost[] {
  const scored = rows
    .filter(r => r.strokes != null && r.strokes > 0)
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))

  const posts: FeedPost[] = []
  const nameOf = (slug: string) => {
    const t = SCRAMBLE_TEAMS.find(x => x.slug === slug)
    return t ? teamName(t) : slug
  }

  // Standout holes
  for (const r of scored) {
    const par = parFor(r.hole_number)
    const diff = (r.strokes as number) - par
    let text: string | null = null
    if (r.strokes === 1) text = `${nameOf(r.team_slug)} made an ACE on ${r.hole_number}.`
    else if (diff <= -3) text = `${nameOf(r.team_slug)} made albatross on ${r.hole_number}.`
    else if (diff === -2) text = `${nameOf(r.team_slug)} made eagle on ${r.hole_number}.`
    else if (diff === -1) text = `${nameOf(r.team_slug)} birdied ${r.hole_number}.`
    if (text) posts.push({ id: `h-${r.team_slug}-${r.hole_number}`, at: Date.parse(r.created_at), label: null, text, tone: 'good' })
  }

  // Turn at the 9th and signing for 18
  for (const t of SCRAMBLE_TEAMS) {
    const mine = scored.filter(r => r.team_slug === t.slug)
    const front = mine.filter(r => r.hole_number <= 9)
    if (front.length === 9) {
      const s = front.reduce((a, r) => a + (r.strokes as number), 0)
      const at = Math.max(...front.map(r => Date.parse(r.created_at)))
      posts.push({
        id: `turn-${t.slug}`, at, label: 'FRONT 9', tone: 'plain',
        text: `${teamName(t)} turned in ${s} (${fmtToPar(s - OUT_PAR)}).`,
      })
    }
    if (mine.length === TOTAL_HOLES) {
      const s = mine.reduce((a, r) => a + (r.strokes as number), 0)
      const par = mine.reduce((a, r) => a + parFor(r.hole_number), 0)
      const at = Math.max(...mine.map(r => Date.parse(r.created_at)))
      posts.push({
        id: `fin-${t.slug}`, at, label: 'FINAL', tone: 'final',
        text: `${teamName(t)} signed for ${s}, net ${fmtToPar(s - par - t.strokes)}.`,
      })
    }
  }

  // Lead changes, by replaying the round in the order scores were entered
  const strokesBy: Record<string, number> = {}
  const parBy: Record<string, number> = {}
  const playedBy: Record<string, number> = {}
  const shotsBy: Record<string, number> = {}
  const net = (slug: string) => strokesBy[slug] - parBy[slug] - (shotsBy[slug] ?? 0)
  let leader: string | null = null
  for (const r of scored) {
    strokesBy[r.team_slug] = (strokesBy[r.team_slug] ?? 0) + (r.strokes as number)
    parBy[r.team_slug] = (parBy[r.team_slug] ?? 0) + parFor(r.hole_number)
    playedBy[r.team_slug] = (playedBy[r.team_slug] ?? 0) + 1
    const tm = SCRAMBLE_TEAMS.find(x => x.slug === r.team_slug)
    if (tm) shotsBy[r.team_slug] = (shotsBy[r.team_slug] ?? 0) + strokesOnHole(tm, r.hole_number)
    const live = Object.keys(strokesBy).filter(s => playedBy[s] >= 3)
    if (live.length < 2) continue
    const best = live.reduce((a, b) => (net(a) <= net(b) ? a : b))
    const tied = live.filter(s => net(s) === net(best)).length > 1
    if (!tied && best !== leader) {
      if (leader !== null) {
        posts.push({
          id: `lead-${best}-${r.hole_number}-${r.created_at}`,
          at: Date.parse(r.created_at), label: null, tone: 'plain',
          text: `${nameOf(best)} take the lead at ${fmtToPar(net(best))}.`,
        })
      }
      leader = best
    }
  }

  return posts.sort((a, b) => b.at - a.at)
}

export const postTime = (at: number) => clock(at)
