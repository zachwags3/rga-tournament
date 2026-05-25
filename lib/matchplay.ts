import type { HoleScore, MatchPlayStatus } from '@/types/database'

export function calcMatchPlayStatus(
  holeScores: HoleScore[],
  totalHoles: number
): MatchPlayStatus {
  // Sort by hole number
  const sorted = [...holeScores].sort((a, b) => a.hole_number - b.hole_number)

  let holesUp = 0 // positive = team1 ahead
  let holesPlayed = 0
  let isComplete = false
  let winner: 'team1' | 'team2' | 'halved' | null = null

  for (const hole of sorted) {
    if (hole.winner == null) continue
    holesPlayed++

    if (hole.winner === 'team1') holesUp++
    else if (hole.winner === 'team2') holesUp--

    const holesRemaining = totalHoles - holesPlayed
    // Match ends when lead > holes remaining
    if (Math.abs(holesUp) > holesRemaining) {
      isComplete = true
      winner = holesUp > 0 ? 'team1' : 'team2'
      break
    }
  }

  const holesRemaining = totalHoles - holesPlayed

  if (!isComplete && holesPlayed === totalHoles) {
    isComplete = true
    if (holesUp === 0) {
      winner = 'halved'
    } else {
      winner = holesUp > 0 ? 'team1' : 'team2'
    }
  }

  let resultLabel = ''
  if (isComplete) {
    if (winner === 'halved') {
      resultLabel = 'Halved'
    } else {
      const margin = Math.abs(holesUp)
      if (holesPlayed < totalHoles) {
        // Closed early, e.g. 3&2
        resultLabel = `${margin}&${holesRemaining}`
      } else {
        resultLabel = `${margin} UP (F)`
      }
    }
  } else if (holesPlayed === 0) {
    resultLabel = 'Not started'
  } else if (holesUp === 0) {
    resultLabel = 'All Square'
  } else {
    const margin = Math.abs(holesUp)
    const side = holesUp > 0 ? 'Team 1' : 'Team 2'
    resultLabel = `${margin} UP (${holesPlayed} played)`
  }

  return {
    holesUp,
    holesPlayed,
    holesRemaining,
    isComplete,
    resultLabel,
    winner,
  }
}

export function holeWinner(
  team1Score: number | null,
  team2Score: number | null
): 'team1' | 'team2' | 'halved' | null {
  if (team1Score == null || team2Score == null) return null
  if (team1Score < team2Score) return 'team1'
  if (team2Score < team1Score) return 'team2'
  return 'halved'
}

export function calcRgaPoints(
  winner: 'team1' | 'team2' | 'halved' | null
): { team1: number; team2: number } {
  if (winner === 'team1') return { team1: 1, team2: 0 }
  if (winner === 'team2') return { team1: 0, team2: 1 }
  if (winner === 'halved') return { team1: 0.5, team2: 0.5 }
  return { team1: 0, team2: 0 }
}
