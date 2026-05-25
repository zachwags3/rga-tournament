export type Database = {
  public: {
    Tables: {
      teams: {
        Row: Team
        Insert: Omit<Team, 'id' | 'created_at'>
        Update: Partial<Omit<Team, 'id' | 'created_at'>>
      }
      players: {
        Row: Player
        Insert: Omit<Player, 'id' | 'created_at'>
        Update: Partial<Omit<Player, 'id' | 'created_at'>>
      }
      rounds: {
        Row: Round
        Insert: Omit<Round, 'id' | 'created_at'>
        Update: Partial<Omit<Round, 'id' | 'created_at'>>
      }
      matches: {
        Row: Match
        Insert: Omit<Match, 'id' | 'created_at'>
        Update: Partial<Omit<Match, 'id' | 'created_at'>>
      }
      hole_scores: {
        Row: HoleScore
        Insert: Omit<HoleScore, 'id' | 'created_at'>
        Update: Partial<Omit<HoleScore, 'id' | 'created_at'>>
      }
    }
  }
}

export type Team = {
  id: string
  name: string
  captain_name: string
  color: string
  created_at: string
}

export type Player = {
  id: string
  name: string
  team_id: string | null
  pick_number: number | null
  is_captain: boolean
  created_at: string
}

export type Round = {
  id: string
  name: string
  format: 'scramble' | 'shamble' | 'singles'
  holes: number
  points_available: number
  sort_order: number
  status: 'pending' | 'active' | 'complete'
  created_at: string
}

export type Match = {
  id: string
  round_id: string
  match_number: number
  team1_player_names: string[]
  team2_player_names: string[]
  team1_id: string
  team2_id: string
  status: 'pending' | 'in_progress' | 'complete'
  result: 'team1_win' | 'team2_win' | 'halved' | null
  rga_points_team1: number
  rga_points_team2: number
  created_at: string
}

export type HoleScore = {
  id: string
  match_id: string
  hole_number: number
  team1_score: number | null
  team2_score: number | null
  winner: 'team1' | 'team2' | 'halved' | null
  created_at: string
}

export type MatchWithScores = Match & {
  hole_scores: HoleScore[]
  round: Round
}

export type MatchPlayStatus = {
  holesUp: number        // positive = team1 up, negative = team2 up, 0 = AS
  holesPlayed: number
  holesRemaining: number
  isComplete: boolean
  resultLabel: string    // e.g. "3&2", "2 UP", "AS", "1 UP (F)"
  winner: 'team1' | 'team2' | 'halved' | null
}
