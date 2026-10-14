import { useState } from 'react'
import { useWorld } from '../state/WorldContext.jsx'
import { createCareer } from '../game/season.js'
import TeamCard from '../components/TeamCard.jsx'

export default function TeamSelect({ nav }) {
  const { world, update } = useWorld()
  const [sel, setSel] = useState(world.teams[0]?.id)
  const start = () => {
    update((w) => {
      w.career = createCareer(w, sel)
    })
    nav('hub')
  }
  return (
    <div className="app">
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => nav('menu')}>
          ← Menú
        </button>
        <span className="title">Elige tu equipo</span>
      </div>
      <p className="muted">
        La liga incluye todos los equipos del editor ({world.teams.length}). Crea más en el <b>Editor de equipos</b> para una liga más larga.
      </p>
      <div className="grid cols-3">
        {world.teams.map((t) => (
          <TeamCard key={t.id} team={t} selected={sel === t.id} onClick={() => setSel(t.id)} />
        ))}
      </div>
      <div className="row" style={{ marginTop: 16 }}>
        <span className="spacer" />
        {world.career && !world.career.finished && <span className="small muted">Esto reemplaza la temporada en curso.</span>}
        <button className="btn primary" disabled={!sel || world.teams.length < 2} onClick={start}>
          Empezar temporada
        </button>
      </div>
    </div>
  )
}
