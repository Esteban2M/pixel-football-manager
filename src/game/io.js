// JSON import / export for teams, leagues, formats and the whole world.
// Import is forgiving: missing data is generated, Spanish or English position names work,
// and every problem is reported with the path where it happened.
import { createRng } from './rng.js'
import { makePlayer, generateAttrs, ATTRS, ROLES, clampAttr, randomAppearance, roleRating } from './player.js'
import { generateSquad } from './generate.js'
import { DEFAULT_TACTICS, FORMATIONS, FORMATION_ROLES } from './formations.js'
import { TACTICAL_ROLES, bestRoleFor } from './roles.js'
import { normalizeFormat, FORMAT_PRESETS } from './formats.js'
import { clubCrest } from '../data/crests.js'
import { createGrid } from '../pixel/grid.js'

export const SCHEMA_VERSION = 1

const POSITION_ALIASES = {
  GK: 'GK', POR: 'GK', PT: 'GK', ARQ: 'GK', PORTERO: 'GK', GOALKEEPER: 'GK',
  CB: 'CB', DFC: 'CB', DEF: 'CB', CENTRAL: 'CB',
  LB: 'LB', LI: 'LB', LWB: 'LB', CRI: 'LB',
  RB: 'RB', LD: 'RB', RWB: 'RB', CRD: 'RB',
  DM: 'DM', MCD: 'DM', CDM: 'DM', VOL: 'DM',
  CM: 'CM', MC: 'CM', MED: 'CM',
  AM: 'AM', MCO: 'AM', CAM: 'AM', MP: 'AM', ENG: 'AM',
  LW: 'LW', EI: 'LW', LM: 'LW', MI: 'LW',
  RW: 'RW', ED: 'RW', RM: 'RW', MD: 'RW',
  ST: 'ST', DC: 'ST', CF: 'ST', DEL: 'ST', FW: 'ST', SS: 'ST',
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function slugify(s) {
  return (
    String(s)
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'equipo'
  )
}

function position(v) {
  if (!v) return null
  return POSITION_ALIASES[String(v).trim().toUpperCase()] ?? null
}

function color(v, d) {
  return typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : d
}

// Crest/portrait: { w, h, px } or a compact { rows: ['..AA..'], palette: { A: '#ff0000' } }.
export function normalizeGrid(raw, path, report) {
  if (!raw) return null
  if (Array.isArray(raw.rows) && raw.palette) {
    const h = raw.rows.length
    const w = Math.max(...raw.rows.map((r) => r.length))
    if (w > 64 || h > 64) {
      report.warn(`${path}: la imagen es demasiado grande (máx. 64×64); se ignoró.`)
      return null
    }
    const g = createGrid(w, h)
    raw.rows.forEach((row, y) => [...row].forEach((ch, x) => (g.px[y * w + x] = color(raw.palette[ch], null))))
    return g
  }
  if (Number.isInteger(raw.w) && Number.isInteger(raw.h) && Array.isArray(raw.px) && raw.px.length === raw.w * raw.h && raw.w <= 64 && raw.h <= 64) {
    return { w: raw.w, h: raw.h, px: raw.px.map((c) => color(c, null)) }
  }
  report.warn(`${path}: formato de imagen no válido (usa { w, h, px } o { rows, palette }); se ignoró.`)
  return null
}

// "rating" means the overall in his main position: nudge the free attributes until it matches.
export function calibrateAttrs(attrs, role, rating, locked = new Set()) {
  for (let k = 0; k < 5; k++) {
    const diff = Math.round((rating - roleRating(attrs, role)) / 5)
    if (!diff) break
    for (const { key } of ATTRS) {
      if (locked.has(key) || (key === 'goalkeeping' && role !== 'GK')) continue
      attrs[key] = clampAttr(attrs[key] + diff)
    }
  }
  return attrs
}

export function normalizePlayer(raw, path, report, ctx) {
  if (!raw || typeof raw !== 'object') {
    report.error(`${path}: el jugador debe ser un objeto.`)
    return null
  }
  const name = String(raw.name ?? raw.nombre ?? '').trim()
  if (!name) {
    report.error(`${path}: falta "name".`)
    return null
  }
  const rawPositions = [].concat(raw.positions ?? raw.roles ?? raw.position ?? raw.posicion ?? [])
  const roles = [...new Set(rawPositions.map(position).filter(Boolean))]
  if (!roles.length) {
    if (rawPositions.length) report.warn(`${path} (${name}): posición "${rawPositions.join(', ')}" desconocida; se usó MC.`)
    roles.push('CM')
  }
  const rng = createRng(`import-${ctx.teamId}-${name}`)
  const rating = raw.rating != null ? Math.max(1, Math.min(99, Number(raw.rating))) : null
  const generated = generateAttrs(roles[0], rating ? rating / 5 : ctx.quality, rng)
  const given = raw.attributes ?? raw.attrs ?? {}
  const attrs = {}
  for (const { key } of ATTRS) attrs[key] = given[key] != null ? clampAttr(Math.round(Number(given[key]))) : generated[key]
  if (rating) calibrateAttrs(attrs, roles[0], rating, new Set(Object.keys(given)))
  let number = Number.parseInt(raw.number ?? raw.dorsal, 10)
  if (!Number.isInteger(number) || number < 1 || number > 99 || ctx.numbers.has(number)) {
    if (Number.isInteger(number) && ctx.numbers.has(number)) report.warn(`${path} (${name}): dorsal ${number} repetido; se asignó otro.`)
    // Free number that no later player asked for explicitly.
    number = 1
    while (ctx.numbers.has(number) || ctx.reserved.has(number)) number++
  }
  ctx.numbers.add(number)
  const look = raw.appearance ?? {}
  const appearance = { ...randomAppearance(`${ctx.teamId}-${name}`) }
  for (const k of ['skin', 'hair', 'hairColor', 'beard']) if (Number.isInteger(look[k])) appearance[k] = look[k]
  const p = makePlayer({
    id: raw.id ? String(raw.id) : `${ctx.teamId}-${slugify(name)}`,
    name,
    short: raw.short ? String(raw.short) : undefined,
    number,
    nationality: raw.nationality ? String(raw.nationality).toUpperCase().slice(0, 3) : 'MEX',
    age: Number.isFinite(Number(raw.age)) ? Math.round(Number(raw.age)) : 25,
    roles,
    height: Number.isFinite(Number(raw.height)) ? Math.round(Number(raw.height)) : undefined,
    weight: Number.isFinite(Number(raw.weight)) ? Math.round(Number(raw.weight)) : undefined,
    attrs,
    appearance,
    portrait: raw.portrait ? normalizeGrid(raw.portrait, `${path}.portrait`, report) : null,
    injury: Number.isInteger(raw.injury) ? raw.injury : 0,
    injuryNote: raw.injuryNote ? String(raw.injuryNote) : '',
  })
  const pref = raw.role ?? raw.prefRole
  if (pref && TACTICAL_ROLES[pref]) p.prefRole = pref
  else {
    if (pref) report.warn(`${path} (${name}): rol "${pref}" desconocido; se eligió uno automáticamente.`)
    p.prefRole = bestRoleFor(p, roles[0])
  }
  return p
}

// `base`: the team already in the world with the same id. Anything the document leaves out
// (crest, kits, coach, tactics…) is kept from it, so a JSON can update only the squad.
export function normalizeTeam(raw, path, report, existingIds = new Set(), base = null) {
  if (!raw || typeof raw !== 'object') {
    report.error(`${path}: el equipo debe ser un objeto.`)
    return null
  }
  const name = String(raw.name ?? raw.nombre ?? '').trim()
  if (!name) {
    report.error(`${path}: falta "name".`)
    return null
  }
  const id = raw.id ? slugify(raw.id) : slugify(name)
  const short = String(raw.short ?? base?.short ?? name.slice(0, 3)).toUpperCase().slice(0, 3)
  const primary = color(raw.colors?.primary ?? raw.kits?.home?.shirt, '#29adff')
  const secondary = color(raw.colors?.secondary ?? raw.kits?.home?.trim, '#ffffff')
  const kit = (k, d) => ({
    shirt: color(k?.shirt, d.shirt),
    trim: color(k?.trim, d.trim),
    pattern: Number.isInteger(k?.pattern) ? Math.max(0, Math.min(4, k.pattern)) : d.pattern,
    shorts: color(k?.shorts, d.shorts),
    socks: color(k?.socks, d.socks),
  })
  const kits =
    base && !raw.kits && !raw.colors
      ? structuredClone(base.kits)
      : {
          home: kit(raw.kits?.home, { shirt: primary, trim: secondary, pattern: 0, shorts: secondary, socks: primary }),
          away: kit(raw.kits?.away, { shirt: secondary, trim: primary, pattern: 0, shorts: primary, socks: secondary }),
          gk: color(raw.kits?.gk, '#3d3d3d'),
        }
  const quality = Number.isFinite(Number(raw.quality)) ? Math.max(5, Math.min(18, Number(raw.quality))) : 12
  const reserved = new Set((Array.isArray(raw.players) ? raw.players : []).map((pl) => Number.parseInt(pl?.number ?? pl?.dorsal, 10)).filter(Number.isInteger))
  const ctx = { teamId: id, quality, numbers: new Set(), reserved }
  const minSquad = Number.isInteger(raw.minSquad) ? Math.max(11, Math.min(40, raw.minSquad)) : 16
  let players = []
  if (Array.isArray(raw.players) && raw.players.length) {
    raw.players.forEach((p, i) => {
      const n = normalizePlayer(p, `${path}.players[${i}]`, report, ctx)
      if (n) players.push(n)
    })
    const ids = new Set()
    for (const p of players) {
      while (ids.has(p.id)) p.id += '-2'
      ids.add(p.id)
    }
    if (!players.some((p) => p.roles.includes('GK'))) report.warn(`${path} (${name}): no hay porteros; el equipo jugará con un portero improvisado.`)
    if (players.length < minSquad) {
      const extra = generateSquad(quality, `fill-${id}`)
        .filter((p) => !ctx.numbers.has(p.number))
        .slice(0, minSquad - players.length)
        .map((p, i) => {
          // Squad fillers sit around the requested level so they do not outshine the real players.
          const target = Math.round(quality * 5 + ((i * 7) % 5) - 2)
          return { ...p, id: `${id}-gen-${i + 1}`, attrs: calibrateAttrs({ ...p.attrs }, p.roles[0], target) }
        })
      report.warn(`${path} (${name}): solo ${players.length} jugadores; se completó con ${extra.length} generados.`)
      players = players.concat(extra)
    }
  } else {
    players = generateSquad(quality, `json-${id}`).map((p, i) => ({ ...p, id: `${id}-${i + 1}` }))
    report.note(`${name}: sin "players", se generó una plantilla de nivel ${quality}.`)
  }
  let formation = raw.tactics?.formation ?? raw.formation ?? base?.tactics?.formation ?? DEFAULT_TACTICS.formation
  if (!FORMATIONS[formation]) {
    report.warn(`${path} (${name}): formación "${formation}" desconocida; se usó 4-3-3. Disponibles: ${Object.keys(FORMATIONS).join(', ')}`)
    formation = '4-3-3'
  }
  const t = raw.tactics ?? (base && !raw.formation ? base.tactics : {})
  const tactics = {
    ...DEFAULT_TACTICS,
    formation,
    mentality: Number.isInteger(t.mentality) ? Math.max(-2, Math.min(2, t.mentality)) : 0,
    pressing: Number.isInteger(t.pressing) ? Math.max(0, Math.min(2, t.pressing)) : 1,
    tempo: Number.isInteger(t.tempo) ? Math.max(0, Math.min(2, t.tempo)) : 1,
    width: Number.isInteger(t.width) ? Math.max(0, Math.min(2, t.width)) : 1,
    roles: Array.isArray(t.roles) && t.roles.length === 11 ? t.roles.map((r, i) => (TACTICAL_ROLES[r] ? r : FORMATION_ROLES[formation][i])) : FORMATION_ROLES[formation].slice(),
  }
  const crest =
    (raw.crest && normalizeGrid(raw.crest, `${path}.crest`, report)) || (base?.crest ? structuredClone(base.crest) : clubCrest({ primary, secondary, letter: name[0], style: 'halves' }))
  if (existingIds.has(id)) report.note(`${name}: ya existía con id "${id}", se actualizará.`)
  return {
    id,
    name,
    short,
    nickname: String(raw.nickname ?? base?.nickname ?? ''),
    coach: String(raw.coach ?? base?.coach ?? 'Sin DT'),
    custom: base ? !!base.custom : true,
    ...(raw.source || base?.source ? { source: String(raw.source ?? base.source) } : {}),
    ...(raw.confidence ? { confidence: String(raw.confidence) } : {}),
    kits,
    crest,
    tactics,
    lineup: null,
    players,
  }
}

export function normalizeLeague(raw, path, report, teamLookup) {
  const name = String(raw?.name ?? '').trim()
  if (!name) {
    report.error(`${path}: falta "name".`)
    return null
  }
  const { format, errors } = normalizeFormat(raw.format ?? 'liga-mx')
  errors.forEach((e) => report.error(`${path}.format: ${e}`))
  if (!format) return null
  const teamIds = []
  for (const ref of raw.teams ?? raw.teamIds ?? []) {
    const id = teamLookup(typeof ref === 'string' ? ref : ref?.id ?? ref?.name)
    if (id) teamIds.push(id)
    else report.warn(`${path}: no encontré el equipo "${typeof ref === 'string' ? ref : JSON.stringify(ref)}".`)
  }
  if (teamIds.length < 2) report.error(`${path} (${name}): una liga necesita al menos 2 equipos (encontré ${teamIds.length}).`)
  return { id: raw.id ? slugify(raw.id) : slugify(name), name, format, teamIds: [...new Set(teamIds)], sim: raw.sim === 'engine' ? 'engine' : 'quick' }
}

function makeReport() {
  const r = { errors: [], warnings: [], info: [], added: [] }
  r.error = (m) => r.errors.push(m)
  r.warn = (m) => r.warnings.push(m)
  r.note = (m) => r.info.push(m)
  return r
}

// Reads any supported JSON document and applies it to `world` (mutates it). Use on a copy to preview.
export function importData(world, input) {
  const report = makeReport()
  let data = input
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input)
    } catch (e) {
      report.error(`JSON inválido: ${e.message}`)
      return report
    }
  }
  if (!data || typeof data !== 'object') {
    report.error('El archivo no contiene un objeto JSON.')
    return report
  }
  const type = data.type ?? (Array.isArray(data) ? 'pfm-teams' : data.players ? 'pfm-team' : data.stages ? 'pfm-format' : data.league ? 'pfm-league' : null)

  const upsertTeam = (team) => {
    const i = world.teams.findIndex((t) => t.id === team.id)
    if (i >= 0) world.teams[i] = team
    else world.teams.push(team)
    report.added.push(`Equipo: ${team.name} (${team.players.length} jugadores)`)
  }
  const findBase = (t) => {
    const id = t?.id ? slugify(t.id) : t?.name ? slugify(t.name) : null
    return id ? world.teams.find((x) => x.id === id) ?? null : null
  }
  const lookup = (ref) => {
    if (!ref) return null
    const s = slugify(ref)
    return world.teams.find((t) => t.id === ref || t.id === s || slugify(t.name) === s || t.short === String(ref).toUpperCase())?.id ?? null
  }

  if (type === 'pfm-world') {
    const w = data.world
    if (!w || !Array.isArray(w.teams)) {
      report.error('pfm-world: falta "world.teams".')
      return report
    }
    world.teams = []
    world.leagues = []
    world.gallery = Array.isArray(w.gallery) ? w.gallery : []
    world.formats = Array.isArray(w.formats) ? w.formats : []
    world.career = null
    w.teams.forEach((t, i) => {
      const n = isFullTeam(t) ? hydrate(t) : normalizeTeam(t, `world.teams[${i}]`, report)
      if (n) upsertTeam(n)
    })
    for (const [i, l] of (w.leagues ?? []).entries()) {
      const n = normalizeLeague({ ...l, teams: l.teamIds ?? l.teams }, `world.leagues[${i}]`, report, lookup)
      if (n) {
        world.leagues.push({ ...n, builtIn: !!l.builtIn })
        report.added.push(`Liga: ${n.name}`)
      }
    }
    return report
  }
  if (type === 'pfm-team' || type === 'pfm-teams') {
    const list = type === 'pfm-teams' ? (Array.isArray(data) ? data : data.teams ?? []) : [data.team ?? data]
    const existing = new Set(world.teams.map((t) => t.id))
    list.forEach((t, i) => {
      const n = isFullTeam(t) ? hydrate(t) : normalizeTeam(t, type === 'pfm-teams' ? `teams[${i}]` : 'team', report, existing, findBase(t))
      if (n) upsertTeam(n)
    })
    return report
  }
  if (type === 'pfm-league') {
    const existing = new Set(world.teams.map((t) => t.id))
    ;(data.teams ?? []).forEach((t, i) => {
      if (typeof t === 'string') return
      const n = isFullTeam(t) ? hydrate(t) : normalizeTeam(t, `teams[${i}]`, report, existing, findBase(t))
      if (n) upsertTeam(n)
    })
    const n = normalizeLeague(data.league ?? data, 'league', report, lookup)
    if (n && n.teamIds.length >= 2) {
      const i = world.leagues.findIndex((l) => l.id === n.id)
      if (i >= 0) world.leagues[i] = n
      else world.leagues.push(n)
      report.added.push(`Liga: ${n.name} · ${n.format.name} · ${n.teamIds.length} equipos`)
    }
    return report
  }
  if (type === 'pfm-format') {
    const { format, errors } = normalizeFormat(data.format ?? data)
    errors.forEach((e) => report.error(e))
    if (format) {
      world.formats ??= []
      const id = slugify(data.id ?? format.name)
      world.formats = world.formats.filter((f) => f.id !== id).concat([{ id, ...format }])
      report.added.push(`Formato: ${format.name}`)
    }
    return report
  }
  report.error('No reconozco el documento. Usa "type": "pfm-team", "pfm-teams", "pfm-league", "pfm-format" o "pfm-world".')
  return report
}

// A team exported by this app (already normalized) can be loaded as-is.
function isFullTeam(t) {
  return t && t.id && t.kits?.home && t.tactics && Array.isArray(t.players) && t.players.every((p) => p.id && p.attrs && p.appearance) && t.crest?.px
}

function hydrate(t) {
  return { ...t, lineup: t.lineup ?? null, players: t.players.map((p) => makePlayer(p)) }
}

// ---------- export ----------

export function exportTeam(team) {
  return { type: 'pfm-team', version: SCHEMA_VERSION, team: stripTeam(team) }
}

export function exportLeague(world, league) {
  return {
    type: 'pfm-league',
    version: SCHEMA_VERSION,
    league: { id: league.id, name: league.name, format: league.format, teams: league.teamIds, sim: league.sim },
    teams: league.teamIds.map((id) => world.teams.find((t) => t.id === id)).filter(Boolean).map(stripTeam),
  }
}

export function exportFormat(format, id) {
  return { type: 'pfm-format', version: SCHEMA_VERSION, id, format }
}

export function exportWorld(world) {
  return {
    type: 'pfm-world',
    version: SCHEMA_VERSION,
    world: { teams: world.teams.map(stripTeam), leagues: world.leagues, formats: world.formats ?? [], gallery: world.gallery },
  }
}

// Season-only data (stats, fitness, morale) stays out of exported teams.
function stripTeam(t) {
  return {
    ...t,
    players: t.players.map((p) => {
      const { stats: _s, condition: _c, morale: _m, suspension: _x, ...rest } = p
      return rest
    }),
  }
}

export function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// ---------- examples shown in the import screen ----------

export const EXAMPLE_TEAM = {
  type: 'pfm-team',
  version: 1,
  team: {
    name: 'Pixel FC',
    short: 'PFC',
    nickname: 'Los Pixeles',
    coach: 'Tu nombre',
    colors: { primary: '#7e2553', secondary: '#ffec27' },
    formation: '4-3-3',
    tactics: { mentality: 1, pressing: 2, tempo: 1, width: 1 },
    quality: 12,
    crest: {
      rows: ['..YYYY..', '.YPPPPY.', 'YPPYYPPY', 'YPYPPYPY', 'YPPPPPPY', '.YPPPPY.', '..YPPY..', '...YY...'],
      palette: { Y: '#ffec27', P: '#7e2553' },
    },
    players: [
      { name: 'Portero Pixel', number: 1, position: 'POR', rating: 72, height: 190 },
      { name: 'Central Uno', number: 4, position: 'DFC', rating: 70, role: 'CB_BPD' },
      { name: 'Lateral Rápido', number: 3, positions: ['LI', 'EI'], attributes: { pace: 17, stamina: 16 } },
      { name: 'El Diez', number: 10, position: 'MCO', role: 'AM_ENGANCHE', attributes: { passing: 18, dribbling: 16 }, appearance: { skin: 2, hair: 3, hairColor: 0, beard: 1 } },
      { name: 'Goleador', number: 9, position: 'DC', rating: 78, role: 'ST_POACHER', height: 186 },
    ],
  },
}

export const EXAMPLE_LEAGUE = {
  type: 'pfm-league',
  version: 1,
  league: {
    name: 'Mi Superliga',
    format: {
      name: 'Doble vuelta + final four',
      points: { win: 3, draw: 1, loss: 0 },
      tiebreakers: ['goalDiff', 'goalsFor', 'headToHead'],
      zones: [{ from: 1, to: 4, label: 'Final four', color: '#00e436' }],
      stages: [
        { type: 'league', name: 'Temporada regular', rounds: 2 },
        { type: 'knockout', name: 'Final four', qualify: { top: 4 }, ties: 'single', tieBreak: 'penalties', reseed: true },
      ],
    },
    teams: ['america', 'cruz-azul', 'Toluca', 'TIG', 'Pixel FC'],
    sim: 'quick',
  },
  // Optional: full teams (same shape as pfm-team "team") created together with the league.
  teams: [],
}

export const PRESET_IDS = Object.keys(FORMAT_PRESETS)
export const ROLE_IDS = Object.keys(TACTICAL_ROLES)
export const POSITION_IDS = Object.keys(ROLES)
