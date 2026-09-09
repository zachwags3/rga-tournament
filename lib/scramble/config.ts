// One-off RGA exhibition event: the Kickoff Classic.
//
// Everything about this event lives here so it can be switched off in one place
// once it's over — flip ENABLED to false and the Scoreboard page reverts to the
// normal Cup leaderboard (i.e. the "On to 2027…" off-season screen).
export const SCRAMBLE_ENABLED = true

// Tabs parked for the Kickoff Classic weekend — the pages still work if you visit
// them directly, they're just hidden from the nav. Flip to false to bring them back.
export const HIDE_FEED_TAB = false
export const HIDE_STATS_TAB = true

export const SCRAMBLE = {
  shortName: 'Kickoff Classic',
  fullName: 'Inaugural Newton Commonwealth Sunday Sunrise Scramble Exhibition Invitational',
  presentedBy: 'presented by The RGA',
  dateLabel: 'Sun Sept 13',
  formatLabel: '2-man scramble',
  courseLabel: 'Newton Commonwealth',
} as const

// First tee: 7:30 AM Eastern on Sunday 13 Sept 2026. Written with an explicit
// offset (EDT, UTC-4) so it means the same instant regardless of the viewer's
// timezone. The countdown hides itself for good once this passes.
export const TEE_OFF = '2026-09-13T07:30:00-04:00'

export type ScrambleTeam = {
  slug: string
  captain: string
  partner: string
  teeTime: string
  color: string    // line colour on the momentum chart / dot on the board
  priorAdj: number // small opening-line calibration (18-hole strokes, +/-) — this
                    // field does NOT touch scoring; play is straight gross strokes.
                    // It only nudges the odds model's pre-round projection so a
                    // field Zach has judged evenly matched opens with even odds
                    // instead of leaning on the model's raw rating gap.
}

// Four teams: Mike and Pat withdrew, and since they were paired together the
// field drops cleanly from 5 teams to 4. Tee times moved up to 7:30 and 7:40.
// Listed in tee-time order. Displayed as "Captain & Partner".
export const SCRAMBLE_TEAMS: ScrambleTeam[] = [
  { slug: 'henry-jack', captain: 'Henry', partner: 'Jack',  teeTime: '7:30', color: '#7aa2ff', priorAdj: -1.31 },
  { slug: 'zach-nate',  captain: 'Zach',  partner: 'Nate',  teeTime: '7:30', color: '#5eead4', priorAdj: 1.88 },
  { slug: 'joe-pat',    captain: 'Joe',   partner: 'Pat',   teeTime: '7:40', color: '#e8c96a', priorAdj: 0.04 },
  { slug: 'sean-mitch', captain: 'Sean',  partner: 'Mitch', teeTime: '7:40', color: '#f9a8d4', priorAdj: 0.06 },
]

export const teamName = (t: ScrambleTeam) => `${t.captain} & ${t.partner}`
export const teamBySlug = (slug: string) => SCRAMBLE_TEAMS.find(t => t.slug === slug)

// Tee times in order, each with the teams going off at that time.
export function teeGroups(): { time: string; teams: ScrambleTeam[] }[] {
  const out: { time: string; teams: ScrambleTeam[] }[] = []
  for (const t of SCRAMBLE_TEAMS) {
    const g = out.find(x => x.time === t.teeTime)
    if (g) g.teams.push(t)
    else out.push({ time: t.teeTime, teams: [t] })
  }
  return out
}

// Newton Commonwealth — Blue tees, 5354 yds, 119/67, par 70.
export type CourseHole = { hole: number; par: number; hcp: number; yards: number }
export const COURSE: CourseHole[] = [
  { hole: 1,  par: 4, hcp: 15, yards: 277 },
  { hole: 2,  par: 5, hcp: 1,  yards: 533 },
  { hole: 3,  par: 3, hcp: 5,  yards: 193 },
  { hole: 4,  par: 3, hcp: 17, yards: 129 },
  { hole: 5,  par: 5, hcp: 3,  yards: 455 },
  { hole: 6,  par: 4, hcp: 9,  yards: 276 },
  { hole: 7,  par: 3, hcp: 11, yards: 177 },
  { hole: 8,  par: 5, hcp: 7,  yards: 488 },
  { hole: 9,  par: 3, hcp: 13, yards: 210 },
  { hole: 10, par: 4, hcp: 14, yards: 276 },
  { hole: 11, par: 4, hcp: 6,  yards: 307 },
  { hole: 12, par: 3, hcp: 12, yards: 159 },
  { hole: 13, par: 4, hcp: 16, yards: 268 },
  { hole: 14, par: 4, hcp: 10, yards: 247 },
  { hole: 15, par: 5, hcp: 8,  yards: 451 },
  { hole: 16, par: 3, hcp: 18, yards: 152 },
  { hole: 17, par: 4, hcp: 2,  yards: 378 },
  { hole: 18, par: 4, hcp: 4,  yards: 378 },
]

export const TOTAL_HOLES = COURSE.length
export const COURSE_PAR = COURSE.reduce((s, h) => s + h.par, 0) // 70
export const parFor = (hole: number) => COURSE.find(h => h.hole === hole)?.par ?? 4
// Cumulative par through N holes — used for to-par while a round is in progress.
export const parThrough = (holes: number) =>
  COURSE.filter(h => h.hole <= holes).reduce((s, h) => s + h.par, 0)

