// Spanish commentary templates. {p} = player, {q} = second player, {t} = team.

const LINES = {
  kickoff: ['¡Rueda el balón! Arranca el partido.', '¡Comienza el encuentro!'],
  secondHalf: ['¡Arranca la segunda mitad!', 'Se reanuda el partido para el segundo tiempo.'],
  halftime: ['Final del primer tiempo.', 'Descanso: los equipos se van al vestidor.'],
  fulltime: ['¡Final del partido!', '¡Se acabó! Suena el silbatazo final.'],
  goal: ['¡GOOOOL de {p}!', '¡GOL! {p} la manda al fondo de la red.', '¡GOOOL! Definición de {p}.'],
  goalAssist: ['¡GOOOOL de {p}! Gran pase de {q}.', '¡GOL! {q} asiste y {p} define.'],
  header: ['¡GOL DE CABEZA de {p}!'],
  ownGoal: ['¡Autogol de {p}! Qué desgracia.'],
  penaltyGoal: ['¡GOL de penal! {p} no perdona.'],
  save: ['¡Atajadón de {q}! Le niega el gol a {p}.', '{q} ataja el disparo de {p}.', '¡Qué reflejos de {q}!'],
  miss: ['{p} dispara... ¡desviado!', 'Disparo de {p} que se va por encima.', '{p} lo intenta pero no encuentra la portería.'],
  blocked: ['¡Bloqueado! La defensa tapa el disparo de {p}.'],
  penaltySaved: ['¡PENAL ATAJADO! {q} adivina el lado.'],
  penaltyMiss: ['¡{p} falla el penal!'],
  penalty: ['¡PENAL! Falta de {p} dentro del área.'],
  yellow: ['Tarjeta amarilla para {p}.'],
  secondYellow: ['¡Segunda amarilla para {p}! Se va expulsado.'],
  red: ['¡ROJA DIRECTA para {p}!'],
  injury: ['{p} se queda tendido en el césped... parece lesionado.'],
  sub: ['Cambio en {t}: entra {p}, sale {q}.'],
  offside: ['Fuera de lugar de {p}.'],
  corner: ['Tiro de esquina para {t}.'],
  freekickShot: ['{p} cobra el tiro libre directo a puerta...'],
}

export function line(rng, type, vars = {}) {
  const opts = LINES[type] ?? [type]
  const tpl = opts[Math.floor(rng.next() * opts.length)]
  return tpl.replace('{p}', vars.p ?? '').replace('{q}', vars.q ?? '').replace('{t}', vars.t ?? '')
}
