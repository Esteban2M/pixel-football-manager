// Competition formats. A format is plain JSON, so it can be edited, exported and imported.
//
// {
//   name, description,
//   points: { win, draw, loss },
//   tiebreakers: ['goalDiff' | 'goalsFor' | 'headToHead' | 'wins' | 'awayGoals'],   // applied after points
//   zones: [{ from, to, label, color }],          // coloured bands in the table (positions, 1-based)
//   stages: [ stage, ... ]
// }
//
// Stage types
//   league    round robin.  rounds: times each pair meets (1-4); groups: number of groups (snake seeding);
//             split: [{ name, size }] splits the previous table into groups by position (size null = the rest);
//             carryPoints: start from the previous table; halvePoints: carried points are halved (Belgium).
//   swiss     each team plays `matches` games against opponents near it in the table, no rematches
//             (UEFA Champions League "league phase").
//   knockout  ties: 'single' | 'double' (two legs, aggregate) | 'bo3' (best of three, MLS round one);
//             finalTies overrides the final; tieBreak / finalTieBreak: 'seed' (better seed goes through, Liga MX),
//             'penalties' or 'awayGoals'; reseed: re-pair best vs worst every round; byes are given to the top seeds
//             automatically when the number of teams is not a power of two.
//   Every stage after the first has `qualify`: { top: N } | { perGroup: N } | { from, to } (positions in the
//   previous stage's combined ranking). Without it, all teams move on (used by splits).

export const TIEBREAKER_LABELS = {
  goalDiff: 'Diferencia de goles',
  goalsFor: 'Goles a favor',
  headToHead: 'Enfrentamiento directo',
  wins: 'Victorias',
  awayGoals: 'Goles como visitante',
}

export const FORMAT_PRESETS = {
  'liga-mx': {
    name: 'Liga MX (torneo corto)',
    description: 'Apertura/Clausura 2026: todos contra todos a una vuelta (17 jornadas con 18 equipos). Los 8 primeros van a la Liguilla: 1.º vs 8.º, 2.º vs 7.º… a ida y vuelta. En cuartos y semis, con empate global avanza el mejor ubicado; la final se define con penales. Sin Play-In ni descenso.',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['goalDiff', 'goalsFor', 'headToHead', 'wins'],
    zones: [{ from: 1, to: 8, label: 'Liguilla', color: '#00e436' }],
    stages: [
      { type: 'league', name: 'Fase regular', rounds: 1 },
      { type: 'knockout', name: 'Liguilla', qualify: { top: 8 }, ties: 'double', finalTies: 'double', tieBreak: 'seed', finalTieBreak: 'penalties', reseed: true },
    ],
  },
  'liga-mx-playin': {
    name: 'Liga MX con Play-In (2021-2025)',
    description: 'Formato anterior: los 6 primeros directo a Liguilla; del 7.º al 10.º juegan un repechaje a partido único por los lugares 7 y 8 (simplificado como eliminatoria con descanso para los 6 mejores).',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['goalDiff', 'goalsFor', 'headToHead', 'wins'],
    zones: [
      { from: 1, to: 6, label: 'Liguilla directa', color: '#00e436' },
      { from: 7, to: 10, label: 'Play-In', color: '#ffa300' },
    ],
    stages: [
      { type: 'league', name: 'Fase regular', rounds: 1 },
      { type: 'knockout', name: 'Play-In y Liguilla', qualify: { top: 10 }, ties: 'double', finalTies: 'double', firstRoundTies: 'single', tieBreak: 'seed', finalTieBreak: 'penalties', reseed: true },
    ],
  },
  'premier-league': {
    name: 'Premier League (Inglaterra)',
    description: 'Todos contra todos a doble vuelta (38 jornadas con 20 equipos). El primero es campeón. Desempate: diferencia de goles, goles a favor y enfrentamiento directo.',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['goalDiff', 'goalsFor', 'headToHead'],
    zones: [
      { from: 1, to: 4, label: 'Champions League', color: '#29adff' },
      { from: 5, to: 5, label: 'Europa League', color: '#ffa300' },
      { from: -3, to: -1, label: 'Descenso', color: '#ff004d' },
    ],
    stages: [{ type: 'league', name: 'Liga', rounds: 2 }],
  },
  laliga: {
    name: 'LaLiga (España)',
    description: 'Doble vuelta. A diferencia de Inglaterra, el primer desempate es el enfrentamiento directo.',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['headToHead', 'goalDiff', 'goalsFor'],
    zones: [
      { from: 1, to: 4, label: 'Champions League', color: '#29adff' },
      { from: -3, to: -1, label: 'Descenso', color: '#ff004d' },
    ],
    stages: [{ type: 'league', name: 'Liga', rounds: 2 }],
  },
  'serie-a': {
    name: 'Serie A (Italia)',
    description: 'Doble vuelta con enfrentamiento directo como primer desempate.',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['headToHead', 'goalDiff', 'goalsFor'],
    zones: [
      { from: 1, to: 4, label: 'Champions League', color: '#29adff' },
      { from: -3, to: -1, label: 'Descenso', color: '#ff004d' },
    ],
    stages: [{ type: 'league', name: 'Serie A', rounds: 2 }],
  },
  bundesliga: {
    name: 'Bundesliga (Alemania)',
    description: 'Doble vuelta (34 jornadas con 18 equipos). El 16.º juega promoción; los dos últimos descienden.',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['goalDiff', 'goalsFor', 'headToHead'],
    zones: [
      { from: 1, to: 4, label: 'Champions League', color: '#29adff' },
      { from: -3, to: -3, label: 'Promoción', color: '#ffa300' },
      { from: -2, to: -1, label: 'Descenso', color: '#ff004d' },
    ],
    stages: [{ type: 'league', name: 'Bundesliga', rounds: 2 }],
  },
  scotland: {
    name: 'Premiership de Escocia (split)',
    description: 'Tres vueltas (33 jornadas con 12 equipos); después la tabla se parte en dos mitades que juegan una vuelta más, conservando sus puntos.',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['goalDiff', 'goalsFor', 'headToHead'],
    zones: [{ from: -1, to: -1, label: 'Descenso', color: '#ff004d' }],
    stages: [
      { type: 'league', name: 'Fase regular', rounds: 3 },
      { type: 'league', name: 'Split', rounds: 1, carryPoints: true, split: [{ name: 'Grupo campeonato', size: null, half: true }, { name: 'Grupo descenso', size: null }] },
    ],
  },
  belgium: {
    name: 'Pro League de Bélgica (puntos a la mitad)',
    description: 'Doble vuelta y luego los 6 mejores juegan un play-off a doble vuelta empezando con la MITAD de sus puntos (redondeados hacia arriba).',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['goalDiff', 'goalsFor', 'wins'],
    stages: [
      { type: 'league', name: 'Fase regular', rounds: 2 },
      { type: 'league', name: 'Champions play-off', qualify: { top: 6 }, rounds: 2, carryPoints: true, halvePoints: true },
    ],
  },
  mls: {
    name: 'MLS (conferencias + playoffs)',
    description: 'Dos conferencias con doble vuelta interna. Los 4 mejores de cada una van a los playoffs: primera ronda al mejor de tres partidos (empates a penales) y después partido único.',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['wins', 'goalDiff', 'goalsFor'],
    stages: [
      { type: 'league', name: 'Temporada regular', rounds: 2, groups: 2, groupNames: ['Conferencia Este', 'Conferencia Oeste'] },
      { type: 'knockout', name: 'MLS Cup Playoffs', qualify: { perGroup: 4 }, ties: 'single', firstRoundTies: 'bo3', tieBreak: 'penalties', finalTieBreak: 'penalties', reseed: false },
    ],
  },
  argentina: {
    name: 'Liga Profesional Argentina (zonas)',
    description: 'Dos zonas que juegan a una vuelta; los 8 mejores de cada zona van a una eliminatoria a partido único (1.º vs 8.º de la otra zona…), penales si hay empate.',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['goalDiff', 'goalsFor', 'headToHead'],
    stages: [
      { type: 'league', name: 'Fase de zonas', rounds: 1, groups: 2, groupNames: ['Zona A', 'Zona B'] },
      { type: 'knockout', name: 'Fase final', qualify: { perGroup: 8 }, ties: 'single', tieBreak: 'penalties', finalTieBreak: 'penalties', reseed: false },
    ],
  },
  'champions-league': {
    name: 'Champions League (fase liga suiza)',
    description: 'Fase liga: cada equipo juega 8 partidos contra rivales distintos de nivel parecido (sistema suizo) en una tabla única. Del 1.º al 8.º pasan directo a octavos; del 9.º al 24.º juegan un playoff. Eliminatorias a ida y vuelta y final a partido único.',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['goalDiff', 'goalsFor', 'awayGoals', 'wins'],
    zones: [
      { from: 1, to: 8, label: 'Octavos', color: '#00e436' },
      { from: 9, to: 24, label: 'Playoff', color: '#ffa300' },
    ],
    stages: [
      { type: 'swiss', name: 'Fase liga', matches: 8 },
      { type: 'knockout', name: 'Eliminatorias', qualify: { top: 24 }, ties: 'double', finalTies: 'single', tieBreak: 'penalties', finalTieBreak: 'penalties', reseed: false },
    ],
  },
  'world-cup': {
    name: 'Mundial (grupos + eliminatorias)',
    description: 'Grupos de 4 a una vuelta; pasan los 2 primeros de cada grupo a eliminatorias a partido único con penales.',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['goalDiff', 'goalsFor', 'headToHead'],
    stages: [
      { type: 'league', name: 'Fase de grupos', rounds: 1, groupSize: 4 },
      { type: 'knockout', name: 'Eliminatorias', qualify: { perGroup: 2 }, ties: 'single', tieBreak: 'penalties', finalTieBreak: 'penalties', reseed: false },
    ],
  },
  cup: {
    name: 'Copa (eliminación directa)',
    description: 'Eliminación directa a partido único desde la primera ronda; los mejor sembrados descansan si hacen falta byes.',
    points: { win: 3, draw: 1, loss: 0 },
    tiebreakers: ['goalDiff', 'goalsFor'],
    stages: [{ type: 'knockout', name: 'Copa', ties: 'single', tieBreak: 'penalties', finalTieBreak: 'penalties', reseed: false }],
  },
}

const STAGE_TYPES = ['league', 'swiss', 'knockout']
const TIE_TYPES = ['single', 'double', 'bo3']
const TIE_BREAKS = ['seed', 'penalties', 'awayGoals']

const int = (v, d, min, max) => {
  const n = Number.isFinite(Number(v)) ? Math.round(Number(v)) : d
  return Math.max(min, Math.min(max, n))
}

// Validates a format and fills defaults. Returns { format, errors }.
export function normalizeFormat(raw) {
  const errors = []
  if (typeof raw === 'string') {
    if (FORMAT_PRESETS[raw]) return { format: structuredClone(FORMAT_PRESETS[raw]), errors }
    return { format: null, errors: [`Formato desconocido: "${raw}". Usa uno de: ${Object.keys(FORMAT_PRESETS).join(', ')}`] }
  }
  if (!raw || typeof raw !== 'object') return { format: null, errors: ['El formato debe ser un objeto JSON.'] }
  const f = {
    name: String(raw.name ?? 'Formato personalizado'),
    description: String(raw.description ?? ''),
    points: { win: int(raw.points?.win, 3, 0, 10), draw: int(raw.points?.draw, 1, 0, 10), loss: int(raw.points?.loss, 0, -5, 10) },
    tiebreakers: (Array.isArray(raw.tiebreakers) ? raw.tiebreakers : ['goalDiff', 'goalsFor']).filter((t) => {
      if (TIEBREAKER_LABELS[t]) return true
      errors.push(`Criterio de desempate desconocido: "${t}"`)
      return false
    }),
    zones: Array.isArray(raw.zones) ? raw.zones.map((z) => ({ from: int(z.from, 1, -99, 99), to: int(z.to, 1, -99, 99), label: String(z.label ?? ''), color: String(z.color ?? '#29adff') })) : [],
    stages: [],
  }
  const stages = Array.isArray(raw.stages) ? raw.stages : []
  if (!stages.length) errors.push('El formato necesita al menos una fase en "stages".')
  stages.forEach((st, i) => {
    const where = `stages[${i}]`
    if (!STAGE_TYPES.includes(st?.type)) {
      errors.push(`${where}: "type" debe ser ${STAGE_TYPES.join(' | ')}`)
      return
    }
    const s = { type: st.type, name: String(st.name ?? `Fase ${i + 1}`) }
    if (i > 0 && st.qualify) {
      const q = st.qualify
      if (q.top) s.qualify = { top: int(q.top, 8, 2, 256) }
      else if (q.perGroup) s.qualify = { perGroup: int(q.perGroup, 2, 1, 64) }
      else if (q.from || q.to) s.qualify = { from: int(q.from, 1, 1, 256), to: int(q.to, 8, 1, 256) }
      else errors.push(`${where}.qualify: usa { top }, { perGroup } o { from, to }`)
    }
    if (st.type === 'league') {
      s.rounds = int(st.rounds, 1, 1, 4)
      if (st.groupSize) s.groupSize = int(st.groupSize, 4, 2, 64)
      else s.groups = int(st.groups, 1, 1, 32)
      if (Array.isArray(st.groupNames)) s.groupNames = st.groupNames.map(String)
      if (Array.isArray(st.split)) s.split = st.split.map((g) => ({ name: String(g.name ?? 'Grupo'), size: g.size == null ? null : int(g.size, 6, 1, 256), half: !!g.half }))
      s.carryPoints = !!st.carryPoints
      s.halvePoints = !!st.halvePoints
    } else if (st.type === 'swiss') {
      s.matches = int(st.matches, 8, 1, 30)
    } else {
      const tie = (v, d, key) => {
        if (v == null) return d
        if (TIE_TYPES.includes(v)) return v
        errors.push(`${where}.${key}: usa ${TIE_TYPES.join(' | ')}`)
        return d
      }
      const brk = (v, d, key) => {
        if (v == null) return d
        if (TIE_BREAKS.includes(v)) return v
        errors.push(`${where}.${key}: usa ${TIE_BREAKS.join(' | ')}`)
        return d
      }
      s.ties = tie(st.ties, 'single', 'ties')
      s.finalTies = tie(st.finalTies, s.ties, 'finalTies')
      if (st.firstRoundTies) s.firstRoundTies = tie(st.firstRoundTies, s.ties, 'firstRoundTies')
      s.tieBreak = brk(st.tieBreak, 'penalties', 'tieBreak')
      s.finalTieBreak = brk(st.finalTieBreak, 'penalties', 'finalTieBreak')
      if (s.finalTieBreak === 'seed') s.finalTieBreak = 'penalties'
      s.reseed = st.reseed !== false
    }
    f.stages.push(s)
  })
  return { format: errors.length && !f.stages.length ? null : f, errors }
}
