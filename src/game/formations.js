// Formation slots in team-relative coordinates:
//   x: 0 = own goal line, 1 = opponent goal line
//   y: 0 = left touchline, 1 = right touchline (looking towards the opponent goal)
// This is the team's "shape" when the ball is at the centre spot; the match
// engine shifts it up/down and side to side as the ball moves.

const GK = { role: 'GK', label: 'POR', x: 0.03, y: 0.5 }

export const FORMATIONS = {
  '4-4-2': [
    GK,
    { role: 'LB', label: 'LI', x: 0.2, y: 0.13 },
    { role: 'CB', label: 'DFC', x: 0.17, y: 0.38 },
    { role: 'CB', label: 'DFC', x: 0.17, y: 0.62 },
    { role: 'RB', label: 'LD', x: 0.2, y: 0.87 },
    { role: 'LW', label: 'MI', x: 0.4, y: 0.15 },
    { role: 'CM', label: 'MC', x: 0.37, y: 0.4 },
    { role: 'CM', label: 'MC', x: 0.37, y: 0.6 },
    { role: 'RW', label: 'MD', x: 0.4, y: 0.85 },
    { role: 'ST', label: 'DC', x: 0.56, y: 0.4 },
    { role: 'ST', label: 'DC', x: 0.56, y: 0.6 },
  ],
  '4-3-3': [
    GK,
    { role: 'LB', label: 'LI', x: 0.2, y: 0.13 },
    { role: 'CB', label: 'DFC', x: 0.17, y: 0.38 },
    { role: 'CB', label: 'DFC', x: 0.17, y: 0.62 },
    { role: 'RB', label: 'LD', x: 0.2, y: 0.87 },
    { role: 'CM', label: 'MC', x: 0.38, y: 0.3 },
    { role: 'DM', label: 'MCD', x: 0.31, y: 0.5 },
    { role: 'CM', label: 'MC', x: 0.38, y: 0.7 },
    { role: 'LW', label: 'EI', x: 0.56, y: 0.15 },
    { role: 'ST', label: 'DC', x: 0.6, y: 0.5 },
    { role: 'RW', label: 'ED', x: 0.56, y: 0.85 },
  ],
  '4-2-3-1': [
    GK,
    { role: 'LB', label: 'LI', x: 0.2, y: 0.13 },
    { role: 'CB', label: 'DFC', x: 0.17, y: 0.38 },
    { role: 'CB', label: 'DFC', x: 0.17, y: 0.62 },
    { role: 'RB', label: 'LD', x: 0.2, y: 0.87 },
    { role: 'DM', label: 'MCD', x: 0.31, y: 0.4 },
    { role: 'DM', label: 'MCD', x: 0.31, y: 0.6 },
    { role: 'LW', label: 'EI', x: 0.47, y: 0.15 },
    { role: 'AM', label: 'MCO', x: 0.47, y: 0.5 },
    { role: 'RW', label: 'ED', x: 0.47, y: 0.85 },
    { role: 'ST', label: 'DC', x: 0.6, y: 0.5 },
  ],
  '3-5-2': [
    GK,
    { role: 'CB', label: 'DFC', x: 0.17, y: 0.28 },
    { role: 'CB', label: 'DFC', x: 0.15, y: 0.5 },
    { role: 'CB', label: 'DFC', x: 0.17, y: 0.72 },
    { role: 'LB', label: 'CRI', x: 0.36, y: 0.1 },
    { role: 'CM', label: 'MC', x: 0.39, y: 0.34 },
    { role: 'DM', label: 'MCD', x: 0.31, y: 0.5 },
    { role: 'CM', label: 'MC', x: 0.39, y: 0.66 },
    { role: 'RB', label: 'CRD', x: 0.36, y: 0.9 },
    { role: 'ST', label: 'DC', x: 0.57, y: 0.4 },
    { role: 'ST', label: 'DC', x: 0.57, y: 0.6 },
  ],
  '5-3-2': [
    GK,
    { role: 'LB', label: 'CRI', x: 0.24, y: 0.1 },
    { role: 'CB', label: 'DFC', x: 0.16, y: 0.3 },
    { role: 'CB', label: 'DFC', x: 0.14, y: 0.5 },
    { role: 'CB', label: 'DFC', x: 0.16, y: 0.7 },
    { role: 'RB', label: 'CRD', x: 0.24, y: 0.9 },
    { role: 'CM', label: 'MC', x: 0.37, y: 0.3 },
    { role: 'DM', label: 'MCD', x: 0.33, y: 0.5 },
    { role: 'CM', label: 'MC', x: 0.37, y: 0.7 },
    { role: 'ST', label: 'DC', x: 0.55, y: 0.4 },
    { role: 'ST', label: 'DC', x: 0.55, y: 0.6 },
  ],
}

export const FORMATION_KEYS = Object.keys(FORMATIONS)

export const DEFAULT_TACTICS = {
  formation: '4-3-3',
  mentality: 0, // -2 muy defensiva .. +2 muy ofensiva
  pressing: 1, // 0 baja, 1 media, 2 alta
  tempo: 1, // 0 lento, 1 normal, 2 rápido
  width: 1, // 0 estrecho, 1 normal, 2 amplio
}

export const MENTALITY_LABELS = { '-2': 'Muy defensiva', '-1': 'Defensiva', 0: 'Equilibrada', 1: 'Ofensiva', 2: 'Muy ofensiva' }
export const PRESSING_LABELS = ['Baja', 'Media', 'Alta']
export const TEMPO_LABELS = ['Lento', 'Normal', 'Rápido']
export const WIDTH_LABELS = ['Estrecho', 'Normal', 'Amplio']

// Default tactical role for each slot of every formation (see roles.js).
export const FORMATION_ROLES = {
  '4-4-2': ['GK_STD', 'FB_STD', 'CB_BPD', 'CB_STD', 'FB_STD', 'W_WINGER', 'CM_B2B', 'CM_PLAYMAKER', 'W_WINGER', 'ST_TARGET', 'ST_POACHER'],
  '4-3-3': ['GK_STD', 'FB_STD', 'CB_BPD', 'CB_STD', 'FB_STD', 'CM_MEZZALA', 'DM_ANCHOR', 'CM_B2B', 'W_INSIDE', 'ST_ADV', 'W_INSIDE'],
  '4-2-3-1': ['GK_STD', 'FB_STD', 'CB_BPD', 'CB_STD', 'FB_STD', 'DM_WINNER', 'DM_REGISTA', 'W_INSIDE', 'AM_ENGANCHE', 'W_WINGER', 'ST_ADV'],
  '3-5-2': ['GK_STD', 'CB_STD', 'CB_COVER', 'CB_BPD', 'FB_WB', 'CM_B2B', 'DM_REGISTA', 'CM_MEZZALA', 'FB_WB', 'ST_TARGET', 'ST_POACHER'],
  '5-3-2': ['GK_STD', 'FB_WB', 'CB_STD', 'CB_COVER', 'CB_STD', 'FB_WB', 'CM_B2B', 'DM_ANCHOR', 'CM_PLAYMAKER', 'ST_ADV', 'ST_PRESS'],
}
