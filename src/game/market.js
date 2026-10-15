// Transfer market: asking prices, offers and counter-offers, incoming bids, free agents,
// contract renewals and the AI clubs' own business between seasons. Money is in millions (M).
import { createRng } from './rng.js'
import { overall, newId } from './player.js'
import { resolveLineup, teamStrength } from './team.js'
import { playerValue, wageFor, ensurePlayer, formatMoney, generateFreeAgents } from './economy.js'

export const MAX_SQUAD = 30
export const MIN_SQUAD = 18
// The window is open between seasons and during the first matchdays.
export const WINDOW_MATCHDAYS = 3

export function windowOpen(career) {
  return !!career && !career.sacked && (career.finished || career.matchdayNo <= WINDOW_MATCHDAYS)
}

const r2 = (v) => Math.round(v * 100) / 100
const teamOf = (world, id) => world.teams.find((t) => t.id === id)

export function findPlayer(world, playerId) {
  for (const t of world.teams) {
    const p = t.players.find((x) => x.id === playerId)
    if (p) return { player: p, team: t }
  }
  const fa = (world.freeAgents ?? []).find((x) => x.id === playerId)
  return fa ? { player: fa, team: null } : null
}

function isStarter(team, p) {
  return resolveLineup(team).includes(p.id)
}

export function askingPrice(team, p) {
  let ask = playerValue(p) * (isStarter(team, p) ? 1.35 : 1.05)
  if ((p.contract ?? 2) <= 1) ask *= 0.8
  if (p.listed) ask *= 0.85
  return r2(Math.max(0.05, ask))
}

// What he wants to earn per year at a new club.
export function wageDemand(p, buyer) {
  const base = Math.max(wageFor(p), (p.wage ?? 0) * 1.1)
  // Joining a smaller club costs extra.
  const gap = buyer ? Math.max(0, overall(p) - teamStrength(buyer) - 4) : 0
  return r2(base * (1 + gap * 0.03))
}

function goalkeepers(team) {
  return team.players.filter((p) => p.roles[0] === 'GK').length
}

// Would the player join this club at all?
function interested(p, buyer, seed) {
  const o = overall(p)
  const str = teamStrength(buyer)
  if (o < 70 || o - str < 8) return true
  return createRng(`interest-${p.id}-${buyer.id}-${seed}`).chance(0.5)
}

// Decision of an AI club about a bid from `buyer` for `p`.
// Returns { status: 'accepted' | 'counter' | 'rejected' | 'refused', ask, wage, message }.
export function evaluateOffer(world, career, { playerId, fee, buyerId = career.userTeamId }) {
  const found = findPlayer(world, playerId)
  if (!found) return { status: 'refused', message: 'Jugador no encontrado.' }
  const { player: p, team: seller } = found
  const buyer = teamOf(world, buyerId)
  if (seller?.id === buyerId) return { status: 'refused', message: `${p.name} ya juega en tu equipo.` }
  const wage = wageDemand(p, buyer)
  if (!windowOpen(career)) return { status: 'refused', wage, message: 'El mercado está cerrado. Reabre al terminar la temporada.' }
  if (buyer.players.length >= MAX_SQUAD) return { status: 'refused', wage, message: `Tu plantilla está llena (${MAX_SQUAD}). Vende o libera a alguien.` }
  if (fee > buyer.finances.budget + 1e-9) return { status: 'refused', wage, message: `No tienes presupuesto: dispones de ${formatMoney(buyer.finances.budget)}.` }
  if (!interested(p, buyer, career.season)) return { status: 'refused', wage, message: `${p.name} no está interesado en jugar en ${buyer.name}.` }
  if (!seller) return { status: 'accepted', ask: 0, wage, message: `${p.name} acepta: agente libre, ${formatMoney(wage)} al año.` }
  const ask = askingPrice(seller, p)
  if (seller.players.length <= MIN_SQUAD) return { status: 'refused', ask, wage, message: `${seller.name} no puede quedarse con menos de ${MIN_SQUAD} jugadores.` }
  if (p.roles[0] === 'GK' && goalkeepers(seller) <= 2) return { status: 'refused', ask, wage, message: `${seller.name} no vende: se quedaría sin portero suplente.` }
  const key = `${playerId}`
  const tries = (career.negotiations[key] ?? 0) + 1
  if (fee >= ask) return { status: 'accepted', ask, wage, message: `${seller.name} acepta ${formatMoney(fee)} por ${p.name}.` }
  if (tries > 3) return { status: 'refused', ask, wage, message: `${seller.name} se cansó de negociar por ${p.name} en esta ventana.` }
  if (fee >= ask * 0.85) return { status: 'counter', ask, wage, tries, message: `${seller.name} contraoferta: ${formatMoney(ask)}.` }
  return { status: 'rejected', ask, wage, tries, message: `${seller.name} rechaza la oferta. Valoran a ${p.short} en bastante más.` }
}

function freeNumber(team, wanted) {
  const used = new Set(team.players.map((p) => p.number))
  if (!used.has(wanted)) return wanted
  for (let n = 2; n < 99; n++) if (!used.has(n)) return n
  return wanted
}

function log(career, entry) {
  career.transfers ??= []
  career.transfers.push({ season: career.seasonLabel, ...entry })
}

// Moves a player. `fromId` null = free agent; `toId` null = released to the free-agent pool.
export function transferPlayer(world, career, { playerId, fromId, toId, fee = 0, wage, years = 3 }) {
  const from = fromId ? teamOf(world, fromId) : null
  const to = toId ? teamOf(world, toId) : null
  const pool = (world.freeAgents ??= [])
  const list = from ? from.players : pool
  const i = list.findIndex((p) => p.id === playerId)
  if (i < 0) return null
  const [p] = list.splice(i, 1)
  ensurePlayer(p)
  p.listed = false
  if (from) {
    from.finances.budget = r2(from.finances.budget + fee)
    if (from.lineup) from.lineup = from.lineup.map((id) => (id === p.id ? null : id))
  }
  if (to) {
    to.finances.budget = r2(to.finances.budget - fee)
    p.number = freeNumber(to, p.number)
    p.wage = wage ?? wageDemand(p, to)
    p.contract = years
    p.morale = 1
    p.joined = career?.seasonLabel ?? null
    to.players.push(p)
  } else {
    p.contract = 0
    pool.push(p)
  }
  if (career) {
    log(career, { playerId: p.id, name: p.name, from: from?.id ?? null, to: to?.id ?? null, fee: r2(fee), ovr: overall(p), age: p.age })
    career.offers = (career.offers ?? []).filter((o) => o.playerId !== p.id)
  }
  return p
}

// The user buys (or signs a free agent) after an accepted evaluation.
export function completePurchase(world, career, playerId, fee) {
  const ev = evaluateOffer(world, career, { playerId, fee })
  if (ev.status !== 'accepted') return ev
  const found = findPlayer(world, playerId)
  const p = transferPlayer(world, career, { playerId, fromId: found.team?.id ?? null, toId: career.userTeamId, fee: found.team ? fee : 0, wage: ev.wage })
  const user = teamOf(world, career.userTeamId)
  career.news.push({ round: career.matchdayNo, text: found.team ? `✍️ Fichaje: ${p.name} llega de ${found.team.name} por ${formatMoney(fee)}.` : `✍️ ${p.name} firma con ${user.name} como agente libre.` })
  delete career.negotiations[playerId]
  return ev
}

export function registerAttempt(career, playerId) {
  career.negotiations[playerId] = (career.negotiations[playerId] ?? 0) + 1
}

// Releasing costs half of what is left on his contract.
export function releaseCost(p) {
  return r2((p.wage ?? wageFor(p)) * Math.max(0, p.contract ?? 0) * 0.5)
}

export function releasePlayer(world, career, playerId) {
  const team = teamOf(world, career.userTeamId)
  const p = team.players.find((x) => x.id === playerId)
  if (!p || team.players.length <= MIN_SQUAD) return false
  const cost = releaseCost(p)
  team.finances.budget = r2(team.finances.budget - cost)
  transferPlayer(world, career, { playerId, fromId: team.id, toId: null })
  career.news.push({ round: career.matchdayNo, text: `${p.name} queda libre (indemnización ${formatMoney(cost)}).` })
  return true
}

// Contract renewal: ask for a raise; veterans only sign one year at a time.
export function renewalTerms(p) {
  const wage = r2(Math.max(p.wage ?? 0, wageFor(p) * 1.1))
  const maxYears = p.age >= 33 ? 1 : p.age >= 30 ? 2 : 4
  return { wage, maxYears }
}

export function renewContract(world, career, playerId, years) {
  const team = teamOf(world, career.userTeamId)
  const p = team.players.find((x) => x.id === playerId)
  if (!p) return false
  const { wage, maxYears } = renewalTerms(p)
  p.wage = wage
  p.contract = Math.max(p.contract ?? 0, Math.min(years, maxYears))
  career.news.push({ round: career.matchdayNo, text: `${p.name} renueva hasta ${p.contract} temporada(s) más (${formatMoney(wage)}/año).` })
  return true
}

// ---------- incoming bids for the user's players ----------

function bidders(world, career, p, fee) {
  return world.teams.filter((t) => t.id !== career.userTeamId && t.finances && t.finances.budget >= fee && t.players.length < MAX_SQUAD && teamStrength(t) >= overall(p) - 10)
}

// Called after each matchday while the window is open (and once between seasons).
export function generateOffers(world, career, rng) {
  const user = teamOf(world, career.userTeamId)
  career.offers = (career.offers ?? []).filter((o) => o.expires >= career.matchdayNo && user.players.some((p) => p.id === o.playerId))
  if (!windowOpen(career) || career.offers.length >= 4) return []
  const made = []
  for (const p of user.players) {
    if (career.offers.some((o) => o.playerId === p.id)) continue
    const chance = p.listed ? 0.45 : overall(p) >= 72 ? 0.05 : 0.015
    if (!rng.chance(chance)) continue
    const fee = r2(playerValue(p) * (p.listed ? rng.range(0.7, 1.0) : rng.range(1.05, 1.5)))
    const clubs = bidders(world, career, p, fee)
    if (!clubs.length) continue
    const club = rng.pick(clubs)
    const offer = { id: newId('offer'), playerId: p.id, teamId: club.id, fee, expires: career.matchdayNo + 2 }
    career.offers.push(offer)
    made.push(offer)
    career.news.push({ round: career.matchdayNo, text: `📨 ${club.name} ofrece ${formatMoney(fee)} por ${p.name}.` })
    if (career.offers.length >= 4) break
  }
  return made
}

export function acceptOffer(world, career, offerId) {
  const o = (career.offers ?? []).find((x) => x.id === offerId)
  if (!o) return false
  const user = teamOf(world, career.userTeamId)
  const club = teamOf(world, o.teamId)
  const p = user.players.find((x) => x.id === o.playerId)
  if (!p || !club || user.players.length <= MIN_SQUAD || club.finances.budget < o.fee) {
    career.offers = career.offers.filter((x) => x.id !== offerId)
    return false
  }
  transferPlayer(world, career, { playerId: p.id, fromId: user.id, toId: club.id, fee: o.fee })
  career.news.push({ round: career.matchdayNo, text: `💰 Venta: ${p.name} se va a ${club.name} por ${formatMoney(o.fee)}.` })
  return true
}

export function rejectOffer(career, offerId) {
  career.offers = (career.offers ?? []).filter((x) => x.id !== offerId)
}

// ---------- AI business between seasons ----------

const NEED_ORDER = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST']

// The starter that most needs replacing: lowest rating among the XI.
function weakestStarter(team) {
  const xi = resolveLineup(team)
    .map((id) => team.players.find((p) => p.id === id))
    .filter(Boolean)
  return xi.sort((a, b) => overall(a) - overall(b))[0] ?? null
}

export function aiTransfers(world, career, rng, maxMoves = 20) {
  const moves = []
  const clubs = world.teams.filter((t) => t.id !== career.userTeamId && t.finances)

  // Clubs in debt sell their most valuable player to whoever can pay for him.
  for (const seller of clubs) {
    if (seller.finances.budget >= 0 || seller.players.length <= MIN_SQUAD + 1) continue
    const sellable = seller.players.filter((p) => !(p.roles[0] === 'GK' && goalkeepers(seller) <= 2)).sort((a, b) => playerValue(b) - playerValue(a))
    for (const p of sellable.slice(0, 3)) {
      const fee = r2(playerValue(p))
      const buyers = clubs.filter((b) => b.id !== seller.id && b.finances.budget >= fee * 1.2 && b.players.length < MAX_SQUAD - 1 && teamStrength(b) >= overall(p) - 6)
      if (!buyers.length) continue
      const buyer = buyers.sort((a, b) => b.finances.budget - a.finances.budget)[0]
      transferPlayer(world, career, { playerId: p.id, fromId: seller.id, toId: buyer.id, fee })
      moves.push({ p, seller, fee })
      break
    }
  }

  // Everybody tries to upgrade their weakest starter; rich clubs get a second go.
  for (let pass = 0; pass < 2; pass++) {
    const order = clubs.slice().sort(() => rng.next() - 0.5)
    for (const buyer of order) {
      if (moves.length >= maxMoves) break
      const rich = buyer.finances.budget > Math.max(10, (buyer.finances.baseIncome ?? 4) * 2.5)
      if (pass === 1 && !rich) continue
      if (buyer.players.length >= MAX_SQUAD - 1 || !rng.chance(pass === 0 ? 0.65 : 0.8)) continue
      const weak = weakestStarter(buyer)
      if (!weak) continue
      const role = weak.roles[0]
      const target = overall(weak) + 2
      const candidates = []
      for (const seller of world.teams) {
        if (seller.id === buyer.id || seller.id === career.userTeamId || seller.players.length <= MIN_SQUAD + 1) continue
        for (const p of seller.players) {
          if (p.roles[0] !== role || overall(p) < target || p.age > 31) continue
          if (role === 'GK' && goalkeepers(seller) <= 2) continue
          const fee = askingPrice(seller, p)
          if (fee <= buyer.finances.budget * 0.7) candidates.push({ p, seller, fee })
        }
      }
      for (const p of world.freeAgents ?? []) {
        if (p.roles[0] === role && overall(p) >= target && p.age <= 33) candidates.push({ p, seller: null, fee: 0 })
      }
      if (!candidates.length) continue
      // Prefer the best player the club can afford, with some variety.
      candidates.sort((a, b) => overall(b.p) - overall(a.p) + rng.range(-2, 2))
      const c = candidates[0]
      if (!interested(c.p, buyer, `${career.season}-ai`)) continue
      transferPlayer(world, career, { playerId: c.p.id, fromId: c.seller?.id ?? null, toId: buyer.id, fee: c.fee })
      moves.push(c)
      // Make room: the replaced starter is sometimes sold off to the pool.
      if (buyer.players.length > 25 && rng.chance(0.5)) transferPlayer(world, career, { playerId: weak.id, fromId: buyer.id, toId: null })
    }
  }
  return moves
}

// Every club needs a playable squad: at least MIN_SQUAD players and two goalkeepers.
export function ensureSquad(world, team, seed) {
  const pool = (world.freeAgents ??= [])
  const take = (pred) => {
    const i = pool.map((p, k) => ({ p, k })).filter(({ p }) => pred(p)).sort((a, b) => overall(b.p) - overall(a.p))[0]?.k
    if (i == null) return false
    const [p] = pool.splice(i, 1)
    p.number = freeNumber(team, p.number)
    p.wage = wageFor(p)
    p.contract = 1 + (p.age < 30 ? 1 : 0)
    team.players.push(p)
    return true
  }
  let guard = 0
  while (goalkeepers(team) < 2 && guard++ < 4) {
    if (!take((p) => p.roles[0] === 'GK')) pool.push(...generateFreeAgents(`${seed}-gk-${guard}`, 1))
  }
  guard = 0
  while (team.players.length < MIN_SQUAD && guard++ < 20) {
    if (!take(() => true)) pool.push(...generateFreeAgents(`${seed}-fill-${guard}`, 4))
  }
}

export function marketSearch(world, career, { leagueId = '', role = '', minOvr = 0, maxAge = 99, maxValue = Infinity, text = '', free = false } = {}) {
  const league = leagueId && world.leagues.find((l) => l.id === leagueId)
  const allowed = league ? new Set(league.teamIds) : null
  const out = []
  const q = text.trim().toLowerCase()
  const keep = (p) => (!role || p.roles.includes(role)) && overall(p) >= minOvr && p.age <= maxAge && playerValue(p) <= maxValue && (!q || p.name.toLowerCase().includes(q))
  if (!free) {
    for (const t of world.teams) {
      if (t.id === career.userTeamId || (allowed && !allowed.has(t.id))) continue
      for (const p of t.players) if (keep(p)) out.push({ player: p, team: t })
    }
  }
  if (free || !leagueId) for (const p of world.freeAgents ?? []) if (keep(p)) out.push({ player: p, team: null })
  return out.sort((a, b) => overall(b.player) - overall(a.player))
}

export { NEED_ORDER }
