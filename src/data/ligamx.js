// The other 16 clubs of the Liga MX Apertura 2026 (Atlante replaced Mazatlán FC).
// Identity (name, colours, nickname, coach at the start of the tournament) is real; squads are
// generated at a level that roughly matches each club and can be replaced with real ones via JSON import.
import { generateSquad } from '../game/generate.js'
import { DEFAULT_TACTICS, FORMATION_ROLES } from '../game/formations.js'
import { clubCrest } from './crests.js'
import { teamStrength } from '../game/team.js'

// [id, name, short, nickname, coach, shirt, trim, pattern(0 plain,1 stripes,2 hoops,3 sash,4 halves), shorts, socks, crestStyle, letter, target XI rating, formation, mentality, pressing]
const CLUBS = [
  ['toluca', 'Toluca', 'TOL', 'Diablos Rojos', 'Antonio Mohamed', '#d50032', '#ffffff', 0, '#d50032', '#d50032', 'solid', 'T', 73, '4-2-3-1', 1, 1],
  ['tigres', 'Tigres UANL', 'TIG', 'Los Felinos', 'Guido Pizarro', '#fdb913', '#003da5', 0, '#003da5', '#fdb913', 'halves', 'T', 73, '4-3-3', 1, 1],
  ['monterrey', 'Monterrey', 'MTY', 'Rayados', 'Matías Almeyda', '#002b5c', '#ffffff', 1, '#002b5c', '#002b5c', 'stripes', 'M', 72, '4-2-3-1', 1, 2],
  ['guadalajara', 'Guadalajara', 'GDL', 'Chivas', 'Gabriel Milito', '#e4002b', '#ffffff', 1, '#002f6c', '#ffffff', 'stripes', 'G', 71, '4-3-3', 1, 2],
  ['pachuca', 'Pachuca', 'PAC', 'Tuzos', 'Benjamín Mora', '#004b93', '#ffffff', 1, '#ffffff', '#004b93', 'stripes', 'P', 71, '4-2-3-1', 0, 1],
  ['pumas', 'Pumas UNAM', 'PUM', 'Universidad', 'Esteban Solari', '#ffffff', '#c99700', 0, '#002d72', '#002d72', 'solid', 'U', 68, '4-4-2', 0, 2],
  ['leon', 'León', 'LEO', 'La Fiera', 'Javier Gandolfi', '#006847', '#ffffff', 0, '#ffffff', '#006847', 'solid', 'L', 68, '4-3-3', 0, 1],
  ['atlas', 'Atlas', 'ATS', 'Los Zorros', 'Hernán Crespo', '#c8102e', '#111111', 4, '#111111', '#111111', 'halves', 'A', 67, '4-3-3', 0, 1],
  ['necaxa', 'Necaxa', 'NEC', 'Rayos', 'Martín Varini', '#d50032', '#ffffff', 1, '#ffffff', '#d50032', 'stripes', 'N', 67, '5-3-2', -1, 1],
  ['tijuana', 'Tijuana', 'TIJ', 'Xolos', 'Sebastián Abreu', '#c8102e', '#111111', 1, '#111111', '#111111', 'stripes', 'X', 67, '4-4-2', 0, 1],
  ['san-luis', 'Atlético de San Luis', 'ASL', 'Tuneros', 'Diego Mejía', '#d50032', '#ffffff', 1, '#1d2b53', '#d50032', 'stripes', 'S', 66, '4-4-2', 0, 1],
  ['juarez', 'FC Juárez', 'JUA', 'Bravos', 'Pedro Caixinha', '#d50032', '#111111', 0, '#111111', '#d50032', 'solid', 'J', 66, '4-2-3-1', 0, 1],
  ['santos', 'Santos Laguna', 'SAN', 'Guerreros', 'Renato Paiva', '#00843d', '#ffffff', 4, '#00843d', '#00843d', 'halves', 'S', 66, '4-3-3', 0, 1],
  ['queretaro', 'Querétaro', 'QRO', 'Gallos Blancos', 'Esteban González', '#0057b8', '#111111', 1, '#111111', '#0057b8', 'stripes', 'Q', 64, '5-3-2', -1, 1],
  ['puebla', 'Puebla', 'PUE', 'La Franja', 'Gerardo Espinoza', '#ffffff', '#1d4ed8', 3, '#ffffff', '#1d4ed8', 'sash', 'P', 64, '4-4-2', -1, 1],
  ['atlante', 'Atlante', 'ATL', 'Potros de Hierro', 'Miguel Herrera', '#1d3c8c', '#c8102e', 1, '#1d3c8c', '#1d3c8c', 'stripes', 'A', 65, '4-3-3', 1, 1],
]

export function createLigaMxTeams() {
  return CLUBS.map(([id, name, short, nickname, coach, shirt, trim, pattern, shorts, socks, crestStyle, letter, target, formation, mentality, pressing]) => {
    const light = shirt.toLowerCase() === '#ffffff'
    const team = {
      id,
      name,
      short,
      nickname,
      coach,
      custom: false,
      generated: true,
      kits: {
        home: { shirt, trim, pattern, shorts, socks },
        away: light ? { shirt: trim, trim: '#ffffff', pattern: 0, shorts: trim, socks: trim } : { shirt: '#ffffff', trim: shirt, pattern: 0, shorts: '#ffffff', socks: '#ffffff' },
        gk: '#3d3d3d',
      },
      crest: clubCrest({ primary: shirt, secondary: trim, accent: light ? trim : '#ffffff', letter, style: crestStyle }),
      tactics: { ...DEFAULT_TACTICS, formation, mentality, pressing, roles: FORMATION_ROLES[formation].slice() },
      lineup: null,
      players: [],
    }
    // Search the squad quality that gives the target XI rating (Cruz Azul and América are ~70).
    let quality = 11
    for (let k = 0; k < 6; k++) {
      team.players = generateSquad(quality, `ligamx-${id}-${k}`).map((p, i) => ({ ...p, id: `${id}-${i + 1}` }))
      const diff = target - teamStrength(team)
      if (Math.abs(diff) <= 1) break
      quality += diff / 6
    }
    return team
  })
}

export const LIGA_MX_IDS = ['america', 'atlante', 'atlas', 'san-luis', 'cruz-azul', 'guadalajara', 'juarez', 'leon', 'monterrey', 'necaxa', 'pachuca', 'puebla', 'pumas', 'queretaro', 'santos', 'tigres', 'tijuana', 'toluca']
