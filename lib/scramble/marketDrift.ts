import { SCRAMBLE_TEAMS, TEE_OFF } from './config'

// Cosmetic pre-round "market movement" for the Odds page — like a sportsbook
// board ticking around in the days before kickoff. It has no relationship to
// anything real (no scores exist yet); it's manufactured variance that eases
// back to exactly the true opening line at tee-off, so "opening odds" stays
// honest once anyone actually starts playing.
const WINDOW_HOURS = 84 // drift kicks in starting 3.5 days out from tee-off
const TICK_HOURS = 3 // a new "line move" every few hours
const STEP = 1.3 // typical per-tick move, in win% points
const REVERSION = 0.65 // pulls the walk back toward 0 so it wanders instead of drifting away

export const TICKS = Math.round(WINDOW_HOURS / TICK_HOURS)
const ANCHOR_MS = Date.parse(TEE_OFF) - WINDOW_HOURS * 3600_000

// Deterministic hash -> [0,1). Every viewer sees the same "random" line at the
// same moment instead of each browser rolling its own.
function seeded(seed: string): number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507)
  h = Math.imul(h ^ (h >>> 13), 3266489909)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

export function tickAt(atMs: number): number {
  return Math.max(0, Math.min(TICKS, Math.floor((atMs - ANCHOR_MS) / (TICK_HOURS * 3600_000))))
}

// Zero at both ends of the window (true line opens the drift, drift eases back
// to that same true line right at tee-off) and largest mid-week.
function envelope(tick: number): number {
  return Math.sin(Math.PI * (tick / TICKS))
}

// Per-team drift (win% points) for tick 0..maxTick, as a mildly mean-reverting
// random walk so it reads as a wandering line rather than independent noise
// each tick. Roughly zero-sum across the field at every tick.
function driftSeries(maxTick: number): Record<string, number>[] {
  const walk: Record<string, number> = {}
  for (const t of SCRAMBLE_TEAMS) walk[t.slug] = 0
  const out: Record<string, number>[] = []
  for (let tick = 0; tick <= maxTick; tick++) {
    for (const t of SCRAMBLE_TEAMS) {
      const step = (seeded(`${t.slug}:${tick}`) * 2 - 1) * STEP
      walk[t.slug] = walk[t.slug] * REVERSION + step
    }
    const mean = SCRAMBLE_TEAMS.reduce((s, t) => s + walk[t.slug], 0) / SCRAMBLE_TEAMS.length
    const env = envelope(tick)
    const centered: Record<string, number> = {}
    for (const t of SCRAMBLE_TEAMS) centered[t.slug] = (walk[t.slug] - mean) * env
    out.push(centered)
  }
  return out
}

function bumpAndRenormalize(base: Map<string, number>, drift: Record<string, number>): Map<string, number> {
  const bumped = new Map<string, number>()
  let total = 0
  for (const [slug, p] of base) {
    const v = Math.max(0.005, p + (drift[slug] ?? 0) / 100)
    bumped.set(slug, v)
    total += v
  }
  if (total > 0) for (const [slug, v] of bumped) bumped.set(slug, v / total)
  return bumped
}

// Nudge a base win-probability map (fractions summing to 1) by the drift at
// `atMs`, and renormalize back to summing to 1.
export function applyDrift(base: Map<string, number>, atMs: number = Date.now()): Map<string, number> {
  const tick = tickAt(atMs)
  const drift = driftSeries(tick).at(-1) ?? {}
  return bumpAndRenormalize(base, drift)
}

// The full pre-round drift history from the start of the window through `atMs`,
// one point per tick — feeds the Momentum chart's pre-round segment. Shaped to
// drop straight into ScrambleMomentum in place of the live probabilitySeries.
export function driftHistory(
  base: Map<string, number>,
  atMs: number = Date.now()
): { holeAt: number[]; series: Record<string, number[]> } {
  const points = driftSeries(tickAt(atMs)).map(drift => bumpAndRenormalize(base, drift))
  const series: Record<string, number[]> = {}
  for (const t of SCRAMBLE_TEAMS) series[t.slug] = points.map(p => (p.get(t.slug) ?? 0) * 100)
  return { holeAt: points.map(() => 0), series }
}
