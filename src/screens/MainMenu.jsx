import { useEffect, useMemo, useRef, useState } from 'react'
import { useWorld } from '../state/WorldContext.jsx'
import { PixelCanvas } from '../components/Pixel.jsx'
import { pitchSprite } from '../pixel/sprites.js'
import { createGrid, setPx } from '../pixel/grid.js'
import { renderPitch, CANVAS_W, CANVAS_H } from '../pixel/pitchRenderer.js'
import { randomAppearance } from '../game/player.js'

// Two fictional clubs for the title screen: no real crests, colours or players.
const MENU_KITS = [
  { shirt: '#e43b44', trim: '#ffffff', pattern: 0, shorts: '#ffffff', socks: '#e43b44', gk: '#7a3db8' },
  { shirt: '#ffffff', trim: '#124e89', pattern: 0, shorts: '#124e89', socks: '#ffffff', gk: '#3e8948' },
]

// A 16×16 pixel football used as the game's emblem: a central pentagon and five patches.
const BALL = [
  '......####......',
  '....##wwww##....',
  '...#wwwwwwww#...',
  '..#bbwwwwwwbb#..',
  '.#bbbwwwwwwbbb#.',
  '.#bbwwwbbwwwbb#.',
  '#wwwwwbbbbwwwww#',
  '#wwwwbbbbbbwwww#',
  '#wwwwbbbbbbwwww#',
  '#wwwwwbbbbwwwww#',
  '.#wwwwwwwwwwww#.',
  '.#wwbbwwwwbbww#.',
  '..#wbbbwwbbbw#..',
  '...#wbbwwbbw#...',
  '....##wwww##....',
  '......####......',
]

function ballGrid() {
  const g = createGrid(16, 16)
  BALL.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      // Shade the lower-right side so the ball looks round.
      const shade = x + y > 19
      const color = ch === '#' ? '#000000' : ch === 'b' ? '#1a1c2c' : ch === 'w' ? (shade ? '#c2c3c7' : '#ffffff') : null
      if (color) setPx(g, x, y, color)
    }),
  )
  return g
}

// The stadium in neutral colours, animated crowd, as a dimmed wallpaper behind the menu.
function StadiumWallpaper() {
  const ref = useRef(null)
  useEffect(() => {
    const frames = renderPitch(MENU_KITS)
    const ctx = ref.current.getContext('2d')
    let i = 0
    const draw = () => ctx.drawImage(frames[i++ % frames.length], 0, 0)
    draw()
    const id = setInterval(draw, 600)
    return () => clearInterval(id)
  }, [])
  return <canvas ref={ref} width={CANVAS_W} height={CANVAS_H} className="pixel menu-wallpaper" aria-hidden="true" />
}

export default function MainMenu({ nav }) {
  const { world, reset } = useWorld()
  const [confirm, setConfirm] = useState(false)
  const ball = useMemo(ballGrid, [])
  const sprites = useMemo(
    () =>
      MENU_KITS.flatMap((kit, t) =>
        [0, 1, 2].map((i) => ({ id: `${t}-${i}`, grid: pitchSprite(randomAppearance(`menu-${t}-${i}`), kit, { frame: i % 2, body: { tall: (i + t) % 3, build: 1 } }) })),
      ),
    [],
  )
  const career = world.career
  const userTeam = career && world.teams.find((t) => t.id === career.userTeamId)

  return (
    <div className="app menu">
      <StadiumWallpaper />
      <div className="menu-content">
        <div className="logo">
          <PixelCanvas grid={ball} scale={5} />
          <h1>
            PIXEL FOOTBALL
            <br />
            <span style={{ color: 'var(--accent)' }}>MANAGER</span>
          </h1>
          <div className="sub">MANAGER DE FÚTBOL · CREA TU HISTORIA · v0.4</div>
          <div className="row" style={{ justifyContent: 'center', gap: 4 }}>
            {sprites.map((s) => (
              <PixelCanvas key={s.id} grid={s.grid} scale={4} />
            ))}
          </div>
        </div>
        <div className="menu-buttons">
          {career && (
            <button className="btn primary" onClick={() => nav('hub')}>
              ▶ Continuar · {userTeam?.short} · {career.seasonLabel ?? ''} · {career.finished ? 'Fin de temporada' : `Fecha ${career.matchdayNo}`}
            </button>
          )}
          <button className={`btn ${career ? '' : 'primary'}`} onClick={() => nav('select')}>
            Nuevo modo carrera
          </button>
          <button className="btn" onClick={() => nav('friendly')}>
            Partido amistoso
          </button>
          <button className="btn ghost" onClick={() => nav('leagues')}>
            🏆 Ligas y torneos
          </button>
          <button className="btn ghost" onClick={() => nav('teams')}>
            Editor de equipos
          </button>
          <button className="btn ghost" onClick={() => nav('studio')}>
            🎨 Estudio Pixel Art
          </button>
          <button className="btn ghost" onClick={() => nav('data')}>
            {'{ }'} Importar / exportar JSON
          </button>
        </div>
        <p className="muted small" style={{ marginTop: 24 }}>
          Todo se guarda localmente en tu navegador.{' '}
          {confirm ? (
            <>
              ¿Seguro? Se borran equipos creados y la temporada.{' '}
              <button
                className="btn danger sm"
                onClick={() => {
                  reset()
                  setConfirm(false)
                }}
              >
                Sí, reiniciar
              </button>{' '}
              <button className="btn ghost sm" onClick={() => setConfirm(false)}>
                No
              </button>
            </>
          ) : (
            <button className="btn ghost sm" onClick={() => setConfirm(true)}>
              Reiniciar datos
            </button>
          )}
        </p>
      </div>
    </div>
  )
}
