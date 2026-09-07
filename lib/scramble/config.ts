// One-off RGA exhibition event: the Kickoff Classic.
//
// Everything about this event lives here so it can be switched off in one place
// once it's over — flip ENABLED to false and the Scoreboard page reverts to the
// normal Cup leaderboard (i.e. the "On to 2027…" off-season screen).
export const SCRAMBLE_ENABLED = true

export const SCRAMBLE = {
  shortName: 'Kickoff Classic',
  fullName: 'Inaugural Robert T. Lynch Sunday Sunrise Scramble Exhibition Invitational',
  presentedBy: 'presented by The RGA',
  dateLabel: 'Sun Sept 13',
  formatLabel: '2-man scramble',
  courseLabel: 'Robert T. Lynch',
} as const

export type ScrambleTeam = {
  slug: string
  captain: string
  partner: string
  teeTime: string
}

// Draft order was Henry, Joe, Mike, Sam, Sean; picks came off Nate, Zach, Pat,
// Jack, Mitch. Listed here in tee-time order. Displayed as "Captain & Partner".
export const SCRAMBLE_TEAMS: ScrambleTeam[] = [
  { slug: 'sam-jack',    captain: 'Sam',   partner: 'Jack',  teeTime: '7:40' },
  { slug: 'joe-zach',    captain: 'Joe',   partner: 'Zach',  teeTime: '7:40' },
  { slug: 'henry-nate',  captain: 'Henry', partner: 'Nate',  teeTime: '7:50' },
  { slug: 'sean-mitch',  captain: 'Sean',  partner: 'Mitch', teeTime: '7:50' },
  { slug: 'mike-pat',    captain: 'Mike',  partner: 'Pat',   teeTime: '8:00' },
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

// Robert T. Lynch Municipal — Blue tees, 6211 yds, 121/70.4, par 70.
export type CourseHole = { hole: number; par: number; hcp: number; yards: number }
export const COURSE: CourseHole[] = [
  { hole: 1,  par: 4, hcp: 12, yards: 372 },
  { hole: 2,  par: 4, hcp: 10, yards: 341 },
  { hole: 3,  par: 3, hcp: 16, yards: 175 },
  { hole: 4,  par: 4, hcp: 14, yards: 321 },
  { hole: 5,  par: 3, hcp: 18, yards: 208 },
  { hole: 6,  par: 5, hcp: 2,  yards: 521 },
  { hole: 7,  par: 4, hcp: 8,  yards: 347 },
  { hole: 8,  par: 4, hcp: 4,  yards: 401 },
  { hole: 9,  par: 4, hcp: 6,  yards: 395 },
  { hole: 10, par: 4, hcp: 11, yards: 338 },
  { hole: 11, par: 4, hcp: 13, yards: 301 },
  { hole: 12, par: 3, hcp: 17, yards: 132 },
  { hole: 13, par: 4, hcp: 5,  yards: 400 },
  { hole: 14, par: 4, hcp: 1,  yards: 426 },
  { hole: 15, par: 5, hcp: 7,  yards: 547 },
  { hole: 16, par: 4, hcp: 9,  yards: 387 },
  { hole: 17, par: 3, hcp: 15, yards: 179 },
  { hole: 18, par: 4, hcp: 3,  yards: 420 },
]

export const TOTAL_HOLES = COURSE.length
export const COURSE_PAR = COURSE.reduce((s, h) => s + h.par, 0) // 70
export const parFor = (hole: number) => COURSE.find(h => h.hole === hole)?.par ?? 4
// Cumulative par through N holes — used for to-par while a round is in progress.
export const parThrough = (holes: number) =>
  COURSE.filter(h => h.hole <= holes).reduce((s, h) => s + h.par, 0)
