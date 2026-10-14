import { useState } from 'react'
import { useWorld } from '../state/WorldContext.jsx'
import PixelEditor from '../components/PixelEditor.jsx'
import { PixelCanvas, playerPortraitGrid } from '../components/Pixel.jsx'
import { createGrid, cloneGrid } from '../pixel/grid.js'
import { portraitGrid } from '../pixel/sprites.js'
import { randomAppearance, newId } from '../game/player.js'

export default function PixelStudio({ nav }) {
  const { world, update } = useWorld()
  const [art, setArt] = useState(() => ({ key: 0, grid: createGrid(16, 16) }))
  const [name, setName] = useState('Mi pixel art')
  const [teamId, setTeamId] = useState(world.teams[0]?.id)
  const [playerId, setPlayerId] = useState(world.teams[0]?.players[0]?.id)
  const [toast, setToast] = useState('')
  const [current, setCurrent] = useState(art.grid)
  const team = world.teams.find((t) => t.id === teamId)

  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 1800)
  }

  // Loading new art remounts the editor (key) so its history starts fresh.
  const load = (grid) => {
    const g = cloneGrid(grid)
    setArt((a) => ({ key: a.key + 1, grid: g }))
    setCurrent(g)
  }

  const saveToGallery = () => {
    update((w) => {
      w.gallery.unshift({ id: newId('art'), name: name.trim() || 'Sin nombre', grid: current })
    })
    flash('Guardado en la galería')
  }

  const assignCrest = () => {
    update((w) => {
      w.teams.find((t) => t.id === teamId).crest = cloneGrid(current)
    })
    flash(`Escudo de ${team.name} actualizado`)
  }

  const assignPortrait = () => {
    update((w) => {
      const p = w.teams.find((t) => t.id === teamId).players.find((x) => x.id === playerId)
      if (p) p.portrait = cloneGrid(current)
    })
    flash('Retrato asignado')
  }

  const player = team?.players.find((p) => p.id === playerId)

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => nav('menu')}>
          ← Menú
        </button>
        <span className="title">🎨 Estudio Pixel Art</span>
      </div>
      <div className="grid cols-main">
        <div className="panel">
          <PixelEditor key={art.key} initial={art.grid} title="Lienzo" onChange={setCurrent} />
        </div>
        <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
          <div className="panel">
            <h3>Guardar</h3>
            <div className="row">
              <PixelCanvas grid={current} scale={Math.max(2, Math.floor(96 / current.w))} />
              <div className="grid" style={{ gap: 6, flex: 1 }}>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre del dibujo" />
                <button className="btn sm" onClick={saveToGallery}>
                  Guardar en galería
                </button>
              </div>
            </div>
          </div>
          <div className="panel">
            <h3>Usar en el juego</h3>
            <div className="grid" style={{ gap: 8 }}>
              <select value={teamId} onChange={(e) => {
                setTeamId(e.target.value)
                setPlayerId(world.teams.find((t) => t.id === e.target.value)?.players[0]?.id)
              }} aria-label="Equipo">
                {world.teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <div className="row">
                <button className="btn sm" onClick={assignCrest}>
                  Usar como escudo
                </button>
                <button className="btn ghost sm" onClick={() => team && load(team.crest)}>
                  Cargar escudo
                </button>
              </div>
              <select value={playerId} onChange={(e) => setPlayerId(e.target.value)} aria-label="Jugador">
                {team?.players.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.number} {p.name}
                  </option>
                ))}
              </select>
              <div className="row">
                <button className="btn sm" onClick={assignPortrait} disabled={!player}>
                  Usar como retrato
                </button>
                <button className="btn ghost sm" onClick={() => player && load(playerPortraitGrid(player, team))}>
                  Cargar retrato
                </button>
              </div>
            </div>
          </div>
          <div className="panel">
            <h3>Empezar desde…</h3>
            <div className="row">
              <button className="btn ghost sm" onClick={() => load(createGrid(16, 16))}>
                Lienzo 16×16
              </button>
              <button className="btn ghost sm" onClick={() => load(createGrid(32, 32))}>
                Lienzo 32×32
              </button>
              <button
                className="btn ghost sm"
                onClick={() => load(portraitGrid(randomAppearance(Math.random()), team?.kits.home ?? { shirt: '#29adff', trim: '#ffffff', pattern: 0 }))}
              >
                🎲 Personaje aleatorio
              </button>
            </div>
          </div>
          <div className="panel">
            <h3>Galería ({world.gallery.length})</h3>
            {world.gallery.length ? (
              <div className="gallery">
                {world.gallery.map((g) => (
                  <div key={g.id} className="item" onClick={() => load(g.grid)} title="Cargar en el lienzo">
                    <PixelCanvas grid={g.grid} scale={Math.max(1, Math.floor(48 / g.grid.w))} />
                    <span>{g.name}</span>
                    <button
                      className="btn danger sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        update((w) => {
                          w.gallery = w.gallery.filter((x) => x.id !== g.id)
                        })
                      }}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="small muted">Tus dibujos guardados aparecerán aquí.</p>
            )}
          </div>
        </div>
      </div>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
