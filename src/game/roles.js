// Tactical roles: what a player does from his position.
// Each role changes positioning (adv/inside), runs, decisions and pressing in the match engine.
//
//   adv     push forward (+) or sit deeper (-) when the team has the ball (team-relative x)
//   advDef  same, without the ball
//   inside  move towards the centre (+) or hug the touchline (-) in possession
//   runs    how often he attacks the space behind the defence (0 = never)
//   shoot / dribble / pass / long / cross   decision biases (1 = neutral)
//   press   how eager he is to press the ball carrier
//   work    stamina cost multiplier
//   aerial  bonus in headers
//   line    'offside' keeps him on the last defender, 'drop' makes him drop into midfield
//   weights attributes that matter for the role (for the suitability rating)

const R = (o) => ({ adv: 0, advDef: 0, inside: 0, runs: 0, shoot: 1, dribble: 1, pass: 1, long: 1, cross: 1, press: 1, work: 1, aerial: 0, ...o })

export const TACTICAL_ROLES = {
  // Goalkeepers
  GK_STD: R({ pos: 'GK', name: 'Portero', short: 'POR', desc: 'Se queda bajo palos y prioriza atajar y despejar.', weights: { goalkeeping: 6, positioning: 2 } }),
  GK_SWEEP: R({
    pos: 'GK', name: 'Portero líbero', short: 'PLI', sweeper: true, pass: 1.15,
    desc: 'Adelanta la línea, sale a cortar balones largos y participa en la salida con los pies.',
    weights: { goalkeeping: 4, positioning: 2, passing: 2, pace: 1 },
  }),
  // Centre-backs
  CB_STD: R({ pos: 'CB', name: 'Central', short: 'CEN', aerial: 0.05, long: 0.9, desc: 'Defensor clásico: marca, gana por arriba y despeja sin complicarse.', weights: { tackling: 4, positioning: 3, strength: 3 } }),
  CB_BPD: R({
    pos: 'CB', name: 'Central con salida', short: 'CSA', pass: 1.12, long: 1.3, adv: 0.02,
    desc: 'Inicia el juego desde atrás con pases progresivos y cambios de orientación.',
    weights: { tackling: 3, positioning: 2, passing: 3, strength: 1 },
  }),
  CB_COVER: R({ pos: 'CB', name: 'Central de cobertura', short: 'CCO', adv: -0.03, advDef: -0.03, desc: 'Se queda un paso detrás de la línea para barrer los balones a la espalda.', weights: { positioning: 4, pace: 3, tackling: 3 } }),
  // Full-backs
  FB_STD: R({ pos: 'FB', name: 'Lateral', short: 'LAT', runs: 0.3, desc: 'Equilibrado: defiende su banda y sube cuando hay espacio.', weights: { tackling: 2, pace: 2, stamina: 2, passing: 1 } }),
  FB_WB: R({
    pos: 'FB', name: 'Carrilero', short: 'CAR', adv: 0.13, inside: -0.04, runs: 0.9, cross: 1.4, work: 1.25,
    desc: 'Recorre toda la banda: da amplitud arriba, centra y vuelve a defender.',
    weights: { stamina: 3, pace: 3, passing: 2, dribbling: 1, tackling: 1 },
  }),
  FB_INV: R({
    pos: 'FB', name: 'Lateral invertido', short: 'LIN', adv: 0.06, inside: 0.24, pass: 1.12, cross: 0.6,
    desc: 'Con balón se mete por dentro como un mediocampista más para dar superioridad.',
    weights: { passing: 3, positioning: 2, tackling: 2, stamina: 1 },
  }),
  FB_DEF: R({ pos: 'FB', name: 'Lateral defensivo', short: 'LDE', adv: -0.06, runs: 0, cross: 0.7, desc: 'No se proyecta: forma una línea de cuatro sólida.', weights: { tackling: 3, positioning: 3, strength: 1 } }),
  // Defensive midfield
  DM_ANCHOR: R({ pos: 'DM', name: 'Ancla', short: 'ANC', adv: -0.05, advDef: -0.03, dribble: 0.7, shoot: 0.6, desc: 'Se planta delante de los centrales, tapa líneas de pase y casi no se suma al ataque.', weights: { positioning: 4, tackling: 3, strength: 1 } }),
  DM_REGISTA: R({
    pos: 'DM', name: 'Regista', short: 'REG', adv: -0.02, pass: 1.25, long: 1.4, dribble: 0.8,
    desc: 'Organizador desde la base: recibe de los centrales y distribuye con pases largos (estilo Pirlo).',
    weights: { passing: 5, positioning: 2, dribbling: 1 },
  }),
  DM_WINNER: R({ pos: 'DM', name: 'Recuperador', short: 'REC', press: 1.7, work: 1.2, advDef: 0.03, desc: 'Persigue y presiona al rival para robar el balón lo antes posible.', weights: { tackling: 4, stamina: 3, strength: 2, pace: 1 } }),
  // Central midfield
  CM_B2B: R({ pos: 'CM', name: 'Box to box', short: 'B2B', adv: 0.04, runs: 0.6, press: 1.2, work: 1.25, desc: 'Llega de área a área: recupera atrás y aparece en el área rival.', weights: { stamina: 4, tackling: 2, passing: 2, finishing: 1 } }),
  CM_MEZZALA: R({
    pos: 'CM', name: 'Mezzala', short: 'MEZ', adv: 0.07, inside: -0.1, runs: 0.7, dribble: 1.2, shoot: 1.1,
    desc: 'Interior que se abre al carril intermedio y ataca el espacio entre lateral y central.',
    weights: { dribbling: 3, passing: 2, finishing: 2, pace: 1 },
  }),
  CM_PLAYMAKER: R({ pos: 'CM', name: 'Organizador', short: 'ORG', pass: 1.25, long: 1.2, dribble: 0.9, desc: 'Pide el balón, marca el ritmo y busca el pase que rompe líneas.', weights: { passing: 5, positioning: 2, dribbling: 1 } }),
  // Attacking midfield
  AM_ENGANCHE: R({ pos: 'AM', name: 'Enganche', short: 'ENG', pass: 1.3, dribble: 1.1, press: 0.6, work: 0.85, desc: 'El "10" clásico: se queda entre líneas y lanza a los delanteros.', weights: { passing: 4, dribbling: 3, finishing: 1 } }),
  AM_SHADOW: R({ pos: 'AM', name: 'Mediapunta llegador', short: 'LLE', adv: 0.06, runs: 1.0, shoot: 1.3, desc: 'Segundo delantero: ataca el área desde atrás para rematar.', weights: { finishing: 3, dribbling: 2, pace: 2, positioning: 1 } }),
  // Wide players
  W_WINGER: R({ pos: 'W', name: 'Extremo', short: 'EXT', inside: -0.06, dribble: 1.25, cross: 1.5, shoot: 0.85, wide: true, desc: 'Pegado a la cal: encara, llega a línea de fondo y centra.', weights: { pace: 3, dribbling: 3, passing: 2 } }),
  W_INSIDE: R({
    pos: 'W', name: 'Extremo invertido', short: 'EIN', inside: 0.12, runs: 0.6, dribble: 1.2, shoot: 1.35, cross: 0.6, cutInside: true,
    desc: 'Arranca por fuera y se mete hacia el centro para disparar con su pierna buena.',
    weights: { dribbling: 3, finishing: 3, pace: 2 },
  }),
  W_DEFENSIVE: R({ pos: 'W', name: 'Extremo defensivo', short: 'EDE', adv: -0.04, advDef: -0.07, press: 1.3, work: 1.2, cross: 1.1, desc: 'Trabaja para el equipo: ayuda a su lateral y cierra la banda.', weights: { stamina: 3, tackling: 2, pace: 2, passing: 1 } }),
  // Strikers
  ST_ADV: R({ pos: 'ST', name: 'Delantero centro', short: 'DCE', runs: 0.7, shoot: 1.1, desc: 'Delantero completo: fija centrales, ataca espacios y define.', weights: { finishing: 4, pace: 2, positioning: 2, strength: 1 } }),
  ST_TARGET: R({
    pos: 'ST', name: 'Ariete', short: 'ARI', adv: -0.02, runs: 0.2, aerial: 0.18, pass: 1.1, shoot: 1.05,
    desc: 'Referencia en el área: gana por arriba, aguanta de espaldas y descarga para los que llegan.',
    weights: { strength: 4, finishing: 3, positioning: 1 },
  }),
  ST_POACHER: R({ pos: 'ST', name: 'Cazagoles', short: 'CAZ', line: 'offside', runs: 1.2, shoot: 1.4, pass: 0.85, press: 0.6, work: 0.85, desc: 'Vive en el área y en la línea del fuera de juego, esperando la última jugada.', weights: { finishing: 5, positioning: 3, pace: 1 } }),
  ST_FALSE9: R({ pos: 'ST', name: 'Falso 9', short: 'F9', line: 'drop', adv: -0.12, runs: 0.2, pass: 1.25, dribble: 1.15, desc: 'Baja a medio campo para arrastrar a los centrales y generar juego.', weights: { passing: 3, dribbling: 3, finishing: 2 } }),
  ST_PRESS: R({ pos: 'ST', name: 'Delantero presionante', short: 'DPR', advDef: 0.05, press: 1.8, work: 1.25, runs: 0.6, desc: 'Primer defensor: presiona a centrales y portero sin descanso.', weights: { stamina: 3, finishing: 2, pace: 2, tackling: 1 } }),
}

export const ROLE_KEYS_BY_POS = {}
for (const [k, r] of Object.entries(TACTICAL_ROLES)) (ROLE_KEYS_BY_POS[r.pos] ??= []).push(k)

// Formation slot role (CB, LB, ...) → role family.
export function posFamily(slotRole) {
  if (slotRole === 'LB' || slotRole === 'RB') return 'FB'
  if (slotRole === 'LW' || slotRole === 'RW') return 'W'
  return slotRole
}

export function rolesForSlot(slotRole) {
  return ROLE_KEYS_BY_POS[posFamily(slotRole)]
}

export const DEFAULT_ROLE = { GK: 'GK_STD', CB: 'CB_STD', FB: 'FB_STD', DM: 'DM_ANCHOR', CM: 'CM_B2B', AM: 'AM_ENGANCHE', W: 'W_WINGER', ST: 'ST_ADV' }

export function getRole(key) {
  return TACTICAL_ROLES[key] ?? TACTICAL_ROLES.CM_B2B
}

// Suitability 0-100 of a player for a role (attributes + body for aerial roles).
export function roleSuitability(player, key) {
  const r = getRole(key)
  let sum = 0
  let tot = 0
  for (const [a, w] of Object.entries(r.weights)) {
    sum += (player.attrs[a] ?? 10) * w
    tot += w
  }
  let v = (sum / tot) * 5
  if (r.aerial || key === 'CB_STD' || r.pos === 'GK') v += ((player.height ?? 180) - 180) * 0.35
  if (player.prefRole === key) v += 4
  return Math.round(Math.max(1, Math.min(99, v)))
}

export function bestRoleFor(player, slotRole) {
  const keys = rolesForSlot(slotRole)
  if (player.prefRole && keys.includes(player.prefRole)) return player.prefRole
  return keys.reduce((b, k) => (roleSuitability(player, k) > roleSuitability(player, b) ? k : b), keys[0])
}

// A role that fits the slot; falls back to the family default.
export function validRole(key, slotRole) {
  const keys = rolesForSlot(slotRole)
  return keys.includes(key) ? key : DEFAULT_ROLE[posFamily(slotRole)]
}
