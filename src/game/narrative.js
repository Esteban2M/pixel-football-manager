// Stories around the matches: rivalries, headlines and press conferences.
import { createRng } from './rng.js'
import { allFixtures } from './competition.js'
import { regularPositions } from './manager.js'

// Built-in derbies. Teams can add their own with a `rivals: [{ id, name }]` field in JSON.
export const RIVALRIES = [
  ['america', 'guadalajara', 'Clásico Nacional'],
  ['america', 'cruz-azul', 'Clásico Joven'],
  ['america', 'pumas', 'Clásico Capitalino'],
  ['cruz-azul', 'pumas', 'Clásico de la Capital'],
  ['tigres', 'monterrey', 'Clásico Regio'],
  ['guadalajara', 'atlas', 'Clásico Tapatío'],
  ['toluca', 'america', 'Clásico del Centro'],
  ['puebla', 'atlante', 'Clásico Poblano-Azulgrana'],
  ['leon', 'queretaro', 'Clásico del Bajío'],
]

export function rivalryName(world, a, b) {
  for (const [x, y, name] of RIVALRIES) if ((x === a && y === b) || (x === b && y === a)) return name
  for (const [id, other] of [
    [a, b],
    [b, a],
  ]) {
    const t = world.teams.find((tm) => tm.id === id)
    const r = t?.rivals?.find((rv) => (rv.id ?? rv) === other)
    if (r) return r.name ?? 'Clásico'
  }
  return null
}

const side = (f, id) => (f.home === id ? 0 : 1)

function userPlayed(career) {
  const id = career.userTeamId
  return allFixtures(career.competition).filter((f) => f.result && (f.home === id || f.away === id))
}

// Current streak of the user's team: { kind: 'W' | 'D' | 'L', n }.
export function streak(career) {
  const id = career.userTeamId
  const games = userPlayed(career)
  let kind = null
  let n = 0
  for (let i = games.length - 1; i >= 0; i--) {
    const f = games[i]
    const s = side(f, id)
    const d = f.result.score[s] - f.result.score[1 - s]
    const k = d > 0 ? 'W' : d < 0 ? 'L' : 'D'
    if (kind && k !== kind) break
    kind = k
    n++
  }
  return { kind, n }
}

const news = (career, text) => career.news.push({ round: career.matchdayNo, text: `📰 ${text}` })

// Headlines after the user's match of the round.
export function headlines(world, career, fixture) {
  if (!fixture?.result) return
  const id = career.userTeamId
  const team = world.teams.find((t) => t.id === id)
  const s = side(fixture, id)
  const rivalId = s === 0 ? fixture.away : fixture.home
  const rival = world.teams.find((t) => t.id === rivalId)
  const gf = fixture.result.score[s]
  const ga = fixture.result.score[1 - s]
  const derby = rivalryName(world, id, rivalId)
  if (derby) {
    if (gf > ga) news(career, `¡${team.name} se queda con el ${derby}! ${gf}-${ga} ante ${rival.name}. La afición está de fiesta.`)
    else if (gf < ga) news(career, `${rival.name} gana el ${derby} (${ga}-${gf}). Golpe duro para ${team.name}.`)
    else news(career, `${derby} sin vencedor: ${gf}-${ga}.`)
  } else if (gf - ga >= 3) news(career, `¡Goleada! ${team.name} aplasta ${gf}-${ga} a ${rival.name}.`)
  else if (ga - gf >= 3) news(career, `Noche para olvidar: ${rival.name} golea ${ga}-${gf} a ${team.name}.`)

  const goals = fixture.result.goals.filter((g) => g.team === s && !g.own)
  const byPlayer = {}
  for (const g of goals) byPlayer[g.playerId] = (byPlayer[g.playerId] ?? 0) + 1
  for (const [pid, n] of Object.entries(byPlayer)) {
    const p = team.players.find((x) => x.id === pid)
    if (!p) continue
    if (n >= 3) news(career, `${n === 3 ? '¡Hat-trick' : n === 4 ? '¡Póker' : '¡Manita'} de ${p.name}! ${n} goles ante ${rival.name}.`)
    else if (p.age <= 20) news(career, `El juvenil ${p.name} (${p.age} años) marca ante ${rival.name}. ¿Nace una estrella?`)
  }

  const st = streak(career)
  if (st.kind === 'W' && st.n >= 3) news(career, `${team.name} encadena ${st.n} victorias seguidas.`)
  if (st.kind === 'L' && st.n >= 3) news(career, `Crisis en ${team.name}: ${st.n} derrotas consecutivas.`)

  const pos = regularPositions(career.competition)[id]
  career.flags ??= {}
  if (pos === 1 && !career.flags.leader && career.competition.stage === 0) news(career, `${team.name} es el nuevo líder del torneo.`)
  career.flags.leader = pos === 1
}

// ---------- press conferences ----------

function topForm(team) {
  return team.players
    .filter((p) => p.stats.apps >= 2)
    .map((p) => ({ p, avg: p.stats.ratingSum / p.stats.apps }))
    .sort((a, b) => b.avg - a.avg)[0]
}

// Builds the next press conference (or none) before the user's next match.
export function makePress(world, career, nextFixture, seed) {
  if (!nextFixture) return null
  const rng = createRng(seed)
  const id = career.userTeamId
  const team = world.teams.find((t) => t.id === id)
  const rivalId = nextFixture.home === id ? nextFixture.away : nextFixture.home
  const rival = world.teams.find((t) => t.id === rivalId)
  const derby = rivalryName(world, id, rivalId)
  const st = streak(career)
  const pressId = `${nextFixture.id}`
  if (derby) {
    return {
      id: pressId,
      question: `Se viene el ${derby} ante ${rival.name}. ¿Qué le dices a la afición?`,
      options: [
        { text: '«Es un partido más, tres puntos como cualquier otro.»', effects: {} },
        { text: '«Vamos a ganarlo. No hay otra opción.»', effects: { morale: 1, promise: 'win' }, hint: 'Moral +1 · si no ganas, la directiva lo notará' },
        { text: '«Respetamos mucho al rival, es un equipo peligroso.»', effects: { board: 1 }, hint: 'Directiva +1' },
      ],
      fixtureId: nextFixture.id,
    }
  }
  if (st.kind === 'L' && st.n >= 2) {
    return {
      id: pressId,
      question: `${st.n} derrotas seguidas. ¿Peligra tu puesto?`,
      options: [
        { text: '«Asumo toda la responsabilidad.»', effects: { board: 3 }, hint: 'Directiva +3' },
        { text: '«Los jugadores tienen que dar mucho más.»', effects: { morale: -1, board: 1 }, hint: 'Moral −1 · directiva +1' },
        { text: '«Es una mala racha, ya cambiará.»', effects: { morale: 1 }, hint: 'Moral +1' },
      ],
      fixtureId: nextFixture.id,
    }
  }
  if (st.kind === 'W' && st.n >= 3) {
    return {
      id: pressId,
      question: `${st.n} triunfos al hilo. ¿${team.name} es candidato al título?`,
      options: [
        { text: '«Partido a partido. No nos volvemos locos.»', effects: { board: 1 }, hint: 'Directiva +1' },
        { text: '«Sí. Vamos por el campeonato.»', effects: { morale: 1, promise: 'win' }, hint: 'Moral +1 · promesa de ganar el próximo' },
        { text: '«Todavía tenemos mucho que mejorar.»', effects: { morale: -1, board: 2 }, hint: 'Moral −1 · directiva +2' },
      ],
      fixtureId: nextFixture.id,
    }
  }
  if (!rng.chance(0.3)) return null
  const star = topForm(team)
  if (star && star.avg >= 7) {
    return {
      id: pressId,
      question: `${star.p.name} está jugando a un gran nivel (${star.avg.toFixed(1)} de promedio). ¿Lo ves en la Selección?`,
      options: [
        { text: '«Se lo merece. Es de lo mejor del torneo.»', effects: { player: { id: star.p.id, morale: 2 } }, hint: `Moral de ${star.p.short} +2` },
        { text: '«Tiene que seguir trabajando, aún le falta.»', effects: { player: { id: star.p.id, morale: -1 }, board: 1 }, hint: `Moral de ${star.p.short} −1 · directiva +1` },
        { text: '«No hablo de individualidades.»', effects: {} },
      ],
      fixtureId: nextFixture.id,
    }
  }
  const kids = team.players.filter((p) => p.age <= 20).sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0))
  if (kids.length) {
    const kid = kids[0]
    return {
      id: pressId,
      question: `La afición pide minutos para ${kid.name} (${kid.age} años). ¿Tendrá oportunidades?`,
      options: [
        { text: '«Claro, los jóvenes son el futuro del club.»', effects: { player: { id: kid.id, morale: 2 }, board: 1 }, hint: `Moral de ${kid.short} +2 · directiva +1` },
        { text: '«Tendrá que ganarse el puesto como todos.»', effects: {} },
        { text: '«Todavía no está preparado.»', effects: { player: { id: kid.id, morale: -2 } }, hint: `Moral de ${kid.short} −2` },
      ],
      fixtureId: nextFixture.id,
    }
  }
  return null
}

const clampMorale = (v) => Math.max(-2, Math.min(2, v))

export function answerPress(world, career, optionIndex) {
  const press = career.press
  if (!press) return
  const opt = press.options[optionIndex]
  const team = world.teams.find((t) => t.id === career.userTeamId)
  const e = opt.effects ?? {}
  if (e.morale) for (const p of team.players) p.morale = clampMorale((p.morale ?? 0) + e.morale)
  if (e.player) {
    const p = team.players.find((x) => x.id === e.player.id)
    if (p) p.morale = clampMorale((p.morale ?? 0) + e.player.morale)
  }
  if (e.board && career.board) career.board.confidence = Math.min(100, career.board.confidence + e.board)
  if (e.promise) career.promise = { kind: e.promise, fixtureId: press.fixtureId }
  career.news.push({ round: career.matchdayNo, text: `🎙 ${opt.text}` })
  career.press = null
}

// After the match: a promise to win is kept or broken.
export function settlePromise(world, career) {
  const pr = career.promise
  if (!pr) return
  const f = allFixtures(career.competition).find((x) => x.id === pr.fixtureId)
  if (!f?.result) return
  const s = side(f, career.userTeamId)
  const won = f.result.score[s] > f.result.score[1 - s]
  if (career.board) career.board.confidence = Math.max(0, Math.min(100, career.board.confidence + (won ? 3 : -5)))
  news(career, won ? 'El DT cumplió su palabra: victoria prometida, victoria conseguida.' : 'El DT prometió ganar y no cumplió. La directiva toma nota.')
  career.promise = null
}

export function squadMood(team) {
  const avg = team.players.reduce((s, p) => s + (p.morale ?? 0), 0) / Math.max(1, team.players.length)
  return { avg, label: avg >= 1 ? 'Eufórico' : avg >= 0.3 ? 'Contento' : avg > -0.3 ? 'Normal' : avg > -1 ? 'Tenso' : 'Roto' }
}

