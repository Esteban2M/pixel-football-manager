import { makePlayer } from '../game/player.js'
import { DEFAULT_TACTICS } from '../game/formations.js'
import { cruzAzulCrest, americaCrest } from './crests.js'

// Squads registered for the Liga MX Apertura 2026 (as of September/October 2026).
// Attributes are estimates made for gameplay, not official ratings.
// Row format: [number, name, short name, nationality, age, roles, "VEL RES FUE PAS REG REM ENT COL POR"]

const CRUZ_AZUL_ROWS = [
  [23, 'Kevin Mier', 'Mier', 'COL', 26, ['GK'], '10 12 12 11 6 3 5 15 16'],
  [1, 'Andrés Gudiño', 'Gudiño', 'MEX', 29, ['GK'], '9 12 13 10 5 3 5 14 14'],
  [30, 'Emmanuel Ochoa', 'Ochoa', 'MEX', 21, ['GK'], '10 11 11 9 5 3 5 11 12'],
  [4, 'Willer Ditta', 'Ditta', 'COL', 29, ['CB'], '13 14 16 11 8 6 16 15 1'],
  [33, 'Gonzalo Piovi', 'Piovi', 'ARG', 32, ['CB', 'LB'], '12 14 14 13 10 6 15 15 1'],
  [5, 'Jesús Orozco', 'Orozco', 'MEX', 24, ['CB', 'LB'], '13 14 13 12 9 6 14 13 1'],
  [12, 'Alan Montes', 'Montes', 'MEX', 26, ['CB'], '12 13 15 11 8 6 14 13 1'],
  [28, 'Raymundo Rubio', 'Rubio', 'MEX', 25, ['CB'], '11 13 14 10 7 5 13 12 1'],
  [3, 'Omar Campos', 'Campos', 'MEX', 24, ['LB'], '15 15 11 13 13 7 13 12 1'],
  [22, 'Jorge Rodarte', 'Rodarte', 'MEX', 23, ['RB'], '14 14 11 12 11 6 12 12 1'],
  [6, 'Erik Lira', 'Lira', 'MEX', 26, ['DM', 'CM'], '12 16 13 13 11 8 15 15 1'],
  [19, 'Carlos Rodríguez', 'Ch. Rodríguez', 'MEX', 29, ['CM', 'DM'], '12 15 11 15 13 9 12 14 1'],
  [16, 'Jeremy Márquez', 'Márquez', 'MEX', 26, ['CM', 'DM'], '12 14 12 13 12 9 13 13 1'],
  [8, 'Agustín Palavecino', 'Palavecino', 'ARG', 30, ['CM', 'AM'], '12 14 11 15 14 12 10 13 1'],
  [20, 'José Paradela', 'Paradela', 'ARG', 28, ['AM', 'CM'], '12 14 10 16 15 13 8 13 1'],
  [18, 'Luka Romero', 'L. Romero', 'ARG', 22, ['AM', 'RW'], '14 12 9 14 15 12 6 11 1'],
  [10, 'Andrés Montaño', 'Montaño', 'MEX', 24, ['LW', 'AM'], '15 13 9 13 15 12 6 11 1'],
  [17, 'Amaury García', 'A. García', 'MEX', 24, ['RW', 'LW'], '15 13 10 12 14 11 6 11 1'],
  [29, 'Carlos Rotondi', 'Rotondi', 'ARG', 29, ['RW', 'RB'], '15 15 11 13 14 11 10 12 1'],
  [25, 'Fernando Sámano', 'Sámano', 'MEX', 20, ['CM'], '11 12 10 11 11 8 10 10 1'],
  [32, 'Cristian Jiménez', 'C. Jiménez', 'MEX', 21, ['CM', 'AM'], '12 12 9 11 12 9 8 10 1'],
  [7, 'Nicolás Ibáñez', 'Ibáñez', 'ARG', 32, ['ST'], '11 12 15 10 12 16 5 15 1'],
  [11, 'Christian Ebere', 'Ebere', 'NGA', 28, ['ST'], '15 13 15 9 12 14 5 13 1'],
  [14, 'Juan José Calero', 'Calero', 'COL', 26, ['ST'], '14 13 14 10 12 14 5 13 1'],
  [21, 'Gabriel Fernández', 'Toro Fernández', 'URU', 32, ['ST'], '11 13 15 11 11 14 7 14 1'],
  [27, 'Bryan Gamboa', 'Gamboa', 'MEX', 21, ['ST', 'RW'], '14 12 11 10 12 11 5 10 1'],
]

const AMERICA_ROWS = [
  [30, 'Rodolfo Cota', 'Cota', 'MEX', 39, ['GK'], '7 10 12 10 5 3 5 15 14'],
  [1, 'Luis Ángel Malagón', 'Malagón', 'MEX', 29, ['GK'], '11 12 12 11 6 3 5 15 16'],
  [21, 'Fernando Tapia', 'Tapia', 'MEX', 25, ['GK'], '9 11 12 9 5 3 5 11 12'],
  [3, 'Israel Reyes', 'I. Reyes', 'MEX', 26, ['CB', 'RB'], '14 15 13 12 10 6 15 14 1'],
  [4, 'Sebastián Cáceres', 'Cáceres', 'URU', 27, ['CB'], '13 14 15 11 8 6 15 14 1'],
  [14, 'Santiago Bueno', 'Bueno', 'URU', 28, ['CB'], '12 13 15 11 8 6 15 14 1'],
  [15, 'Santiago Ramos Mingo', 'Ramos Mingo', 'ARG', 25, ['CB'], '12 13 14 12 8 5 14 13 1'],
  [24, 'Franco Rossano', 'Rossano', 'URU', 25, ['CB'], '12 13 14 11 8 6 13 13 1'],
  [29, 'Ramón Juárez', 'R. Juárez', 'MEX', 25, ['CB'], '12 13 15 11 8 7 14 13 1'],
  [32, 'Miguel Vázquez', 'M. Vázquez', 'MEX', 23, ['CB'], '12 12 13 10 8 5 12 12 1'],
  [5, 'Kevin Álvarez', 'K. Álvarez', 'MEX', 27, ['RB'], '15 15 11 12 12 7 13 12 1'],
  [2, 'Emilio Lara', 'E. Lara', 'MEX', 24, ['RB', 'LB'], '15 14 11 12 12 7 12 11 1'],
  [26, 'Cristian Borja', 'C. Borja', 'COL', 33, ['LB'], '13 13 12 13 12 8 13 13 1'],
  [6, 'Edwin Cerrillo', 'Cerrillo', 'USA', 26, ['DM'], '11 15 13 13 11 7 14 14 1'],
  [13, 'Alan Cervantes', 'Cervantes', 'MEX', 28, ['CM', 'DM'], '12 15 12 14 12 9 13 14 1'],
  [20, 'Alexis Gutiérrez', 'A. Gutiérrez', 'MEX', 26, ['CM'], '12 14 11 13 13 9 11 12 1'],
  [28, 'Érick Sánchez', 'E. Sánchez', 'MEX', 27, ['CM', 'AM'], '13 15 10 14 14 11 10 13 1'],
  [27, 'Ícaro Da Conceição', 'Ícaro', 'BRA', 24, ['CM'], '12 13 12 12 12 9 11 11 1'],
  [23, 'Raphael Veiga', 'Veiga', 'BRA', 31, ['AM'], '12 13 11 17 15 15 7 14 1'],
  [8, 'Carlos Álvarez', 'C. Álvarez', 'ESP', 23, ['AM', 'RW'], '14 13 10 15 15 12 7 12 1'],
  [10, 'Alejandro Zendejas', 'Zendejas', 'USA', 28, ['RW', 'AM'], '14 14 10 14 15 13 8 13 1'],
  [12, 'Isaías Violante', 'Violante', 'MEX', 23, ['RW', 'LW'], '15 13 9 12 15 11 6 11 1'],
  [34, 'Dagoberto Espinoza', 'D. Espinoza', 'MEX', 23, ['RB', 'RW'], '14 14 11 11 12 8 11 11 1'],
  [7, 'Brian Rodríguez', 'B. Rodríguez', 'URU', 26, ['LW'], '17 13 9 12 15 12 6 11 1'],
  [22, 'Oscar Perea', 'Perea', 'COL', 21, ['LW', 'RW'], '16 12 10 11 14 11 5 10 1'],
  [9, 'Henry Martín', 'Henry', 'MEX', 34, ['ST'], '11 13 15 12 12 15 7 15 1'],
  [93, 'Miguel Borja', 'M. Borja', 'COL', 33, ['ST'], '11 12 16 10 11 16 5 15 1'],
  [19, 'Raúl Zúñiga', 'Zúñiga', 'COL', 25, ['ST'], '13 13 15 9 11 13 5 12 1'],
  [11, 'Víctor Dávila', 'Dávila', 'CHI', 29, ['RW', 'ST'], '14 14 11 12 14 14 6 13 1'],
]


// Physical profile: height in cm (ESPN squad pages, Sept/Oct 2026; a few marked ~ are estimates),
// look = [skin 0-5, hair style, hair colour, beard] (see pixel/palette.js), preferred tactical role.
// Looks are approximations of each player's real appearance; refine them in the Pixel Art Studio.
const PHYSICAL = {
  // Cruz Azul
  'cruz-azul-23': [188, [3, 1, 0, 1], 'GK_SWEEP'],
  'cruz-azul-1': [183, [1, 1, 1, 3], 'GK_STD'],
  'cruz-azul-30': [188, [1, 1, 0, 0], 'GK_STD'],
  'cruz-azul-4': [180, [5, 0, 0, 1], 'CB_STD'],
  'cruz-azul-33': [180, [0, 9, 1, 3], 'CB_BPD'],
  'cruz-azul-5': [188, [2, 1, 0, 0], 'CB_BPD'],
  'cruz-azul-12': [191, [2, 1, 0, 1], 'CB_STD'],
  'cruz-azul-28': [183, [2, 1, 0, 0], 'CB_COVER'],
  'cruz-azul-3': [175, [2, 3, 0, 0], 'FB_WB'],
  'cruz-azul-22': [178, [2, 1, 0, 0], 'FB_STD'], // ~
  'cruz-azul-6': [173, [2, 2, 0, 1], 'DM_ANCHOR'],
  'cruz-azul-19': [170, [2, 1, 0, 3], 'CM_PLAYMAKER'],
  'cruz-azul-16': [178, [2, 1, 0, 1], 'CM_B2B'],
  'cruz-azul-8': [178, [1, 1, 1, 3], 'CM_MEZZALA'],
  'cruz-azul-20': [180, [1, 2, 1, 3], 'AM_ENGANCHE'],
  'cruz-azul-18': [165, [1, 2, 1, 0], 'AM_ENGANCHE'],
  'cruz-azul-10': [175, [2, 1, 0, 0], 'W_INSIDE'],
  'cruz-azul-17': [180, [3, 3, 0, 0], 'W_WINGER'],
  'cruz-azul-29': [183, [0, 9, 2, 3], 'FB_WB'],
  'cruz-azul-25': [175, [2, 1, 0, 0], 'CM_B2B'], // ~
  'cruz-azul-32': [173, [2, 1, 0, 0], 'CM_MEZZALA'], // ~
  'cruz-azul-7': [180, [0, 1, 1, 3], 'ST_POACHER'],
  'cruz-azul-11': [178, [5, 0, 0, 1], 'ST_ADV'],
  'cruz-azul-14': [185, [4, 1, 0, 0], 'ST_TARGET'],
  'cruz-azul-21': [185, [0, 1, 2, 3], 'ST_TARGET'],
  'cruz-azul-27': [178, [2, 1, 0, 0], 'ST_PRESS'], // ~
  // América
  'america-30': [183, [1, 0, 0, 1], 'GK_STD'],
  'america-1': [180, [2, 1, 0, 1], 'GK_SWEEP'],
  'america-21': [185, [2, 1, 0, 0], 'GK_STD'],
  'america-3': [178, [2, 1, 0, 1], 'CB_BPD'],
  'america-4': [180, [1, 1, 1, 3], 'CB_STD'],
  'america-14': [191, [0, 1, 2, 3], 'CB_STD'],
  'america-15': [185, [0, 2, 2, 1], 'CB_BPD'],
  'america-24': [175, [1, 1, 1, 0], 'CB_COVER'],
  'america-29': [173, [2, 1, 0, 0], 'CB_COVER'],
  'america-32': [183, [2, 1, 0, 0], 'CB_STD'], // ~
  'america-5': [175, [2, 1, 0, 1], 'FB_WB'],
  'america-2': [180, [2, 1, 0, 0], 'FB_STD'],
  'america-26': [178, [5, 0, 0, 4], 'FB_STD'],
  'america-6': [175, [2, 1, 1, 0], 'DM_ANCHOR'],
  'america-13': [178, [2, 1, 0, 1], 'DM_WINNER'],
  'america-20': [180, [2, 2, 0, 0], 'CM_B2B'],
  'america-28': [168, [2, 7, 0, 1], 'CM_MEZZALA'],
  'america-27': [180, [3, 1, 0, 0], 'CM_B2B'], // ~
  'america-23': [178, [2, 1, 0, 3], 'AM_ENGANCHE'],
  'america-8': [168, [0, 2, 1, 1], 'AM_SHADOW'],
  'america-10': [168, [1, 2, 1, 1], 'W_INSIDE'],
  'america-12': [173, [2, 1, 0, 0], 'W_INSIDE'],
  'america-34': [175, [3, 1, 0, 0], 'FB_WB'], // ~
  'america-7': [175, [1, 1, 1, 1], 'W_WINGER'],
  'america-22': [175, [5, 1, 0, 0], 'W_WINGER'],
  'america-9': [178, [3, 0, 0, 3], 'ST_TARGET'],
  'america-93': [183, [3, 1, 0, 1], 'ST_POACHER'],
  'america-19': [180, [4, 1, 0, 0], 'ST_ADV'],
  'america-11': [173, [2, 1, 0, 1], 'W_INSIDE'],
}

const INJURIES = {
  'america-1': { injury: 8, injuryNote: 'Rotura del tendón de Aquiles' },
  'america-11': { injury: 10, injuryNote: 'Rotura de ligamento cruzado' },
}

const ATTR_ORDER = ['pace', 'stamina', 'strength', 'passing', 'dribbling', 'finishing', 'tackling', 'positioning', 'goalkeeping']

function rowsToPlayers(teamId, rows) {
  return rows.map(([number, name, short, nationality, age, roles, attrStr]) => {
    const values = attrStr.split(' ').map(Number)
    const attrs = Object.fromEntries(ATTR_ORDER.map((k, i) => [k, values[i]]))
    const id = `${teamId}-${number}`
    const [height, look, prefRole] = PHYSICAL[id] ?? [178, null, null]
    const appearance = look ? { skin: look[0], hair: look[1], hairColor: look[2], beard: look[3] } : undefined
    return makePlayer({ id, number, name, short, nationality, age, roles, attrs, height, prefRole, appearance, ...INJURIES[id] })
  })
}

export function createBaseTeams() {
  return [
    {
      id: 'cruz-azul',
      name: 'Cruz Azul',
      short: 'CAZ',
      nickname: 'La Máquina Celeste',
      coach: 'Joel Huiqui',
      custom: false,
      kits: {
        home: { shirt: '#1352c9', trim: '#ffffff', pattern: 0, shorts: '#1352c9', socks: '#1352c9' },
        away: { shirt: '#ffffff', trim: '#1352c9', pattern: 0, shorts: '#ffffff', socks: '#ffffff' },
        gk: '#3d3d3d',
      },
      crest: cruzAzulCrest(),
      tactics: {
        ...DEFAULT_TACTICS,
        formation: '4-3-3',
        mentality: 1,
        pressing: 1,
        tempo: 1,
        roles: ['GK_SWEEP', 'FB_WB', 'CB_BPD', 'CB_STD', 'FB_STD', 'CM_MEZZALA', 'DM_ANCHOR', 'CM_PLAYMAKER', 'W_INSIDE', 'ST_POACHER', 'W_WINGER'],
      },
      lineup: null,
      players: rowsToPlayers('cruz-azul', CRUZ_AZUL_ROWS),
    },
    {
      id: 'america',
      name: 'América',
      short: 'AME',
      nickname: 'Las Águilas',
      coach: 'Guillermo Almada',
      custom: false,
      kits: {
        home: { shirt: '#ffe11b', trim: '#00205b', pattern: 0, shorts: '#00205b', socks: '#ffe11b' },
        away: { shirt: '#00205b', trim: '#ffe11b', pattern: 0, shorts: '#00205b', socks: '#00205b' },
        gk: '#2a9d3a',
      },
      crest: americaCrest(),
      tactics: {
        ...DEFAULT_TACTICS,
        formation: '4-2-3-1',
        mentality: 1,
        pressing: 2,
        tempo: 2,
        roles: ['GK_STD', 'FB_STD', 'CB_BPD', 'CB_STD', 'FB_WB', 'DM_WINNER', 'DM_REGISTA', 'W_WINGER', 'AM_ENGANCHE', 'W_INSIDE', 'ST_TARGET'],
      },
      lineup: null,
      players: rowsToPlayers('america', AMERICA_ROWS),
    },
  ]
}
