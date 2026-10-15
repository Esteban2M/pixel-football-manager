import { useMemo, useState } from 'react'
import { useWorld } from '../state/WorldContext.jsx'
import { Crest, PixelCanvas } from '../components/Pixel.jsx'
import { pitchSprite, bodyOf } from '../pixel/sprites.js'

export default function MainMenu({ nav }) {
  const { world, reset } = useWorld()
  const [confirm, setConfirm] = useState(false)
  const [caz, ame] = world.teams
  const sprites = useMemo(
    () =>
      world.teams.slice(0, 2).flatMap((t) =>
        t.players.slice(3, 6).map((p, i) => ({ id: p.id, grid: pitchSprite(p.appearance, t.kits.home, { frame: i % 2, body: bodyOf(p) }) })),
      ),
    [world.teams],
  )
  const career = world.career
  const userTeam = career && world.teams.find((t) => t.id === career.userTeamId)

  return (
    <div className="app menu">
      <div>
        <div className="logo">
          <div className="row" style={{ justifyContent: 'center', gap: 18 }}>
            {caz && <Crest team={caz} size={64} />}
            <span className="px" style={{ fontSize: 14, color: 'var(--muted)' }}>
              VS
            </span>
            {ame && <Crest team={ame} size={64} />}
          </div>
          <h1>
            PIXEL FOOTBALL
            <br />
            <span style={{ color: 'var(--accent)' }}>MANAGER</span>
          </h1>
          <div className="sub">LIGA MX · APERTURA 2026 · v0.3</div>
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
