import { useState } from 'react'
import { useWorld } from '../state/WorldContext.jsx'
import TeamCard from '../components/TeamCard.jsx'

export default function FriendlySetup({ nav }) {
  const { world } = useWorld()
  const [home, setHome] = useState(world.teams[0]?.id)
  const [away, setAway] = useState(world.teams[1]?.id)
  const [manage, setManage] = useState(0)
  const pick = (id) => {
    if (id === home) return
    setAway(home)
    setHome(id)
  }
  const ok = home && away && home !== away
  return (
    <div className="app">
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => nav('menu')}>
          ← Menú
        </button>
        <span className="title">Partido amistoso</span>
      </div>
      <p className="muted">Haz clic en un equipo para ponerlo como local; el anterior local pasa a visitante.</p>
      <div className="grid cols-3">
        {world.teams.map((t) => (
          <TeamCard key={t.id} team={t} selected={t.id === home || t.id === away} onClick={() => pick(t.id)}>
            {t.id === home && <span className="badge warn">LOCAL</span>}
            {t.id === away && <span className="badge">VISITA</span>}
          </TeamCard>
        ))}
      </div>
      <div className="panel row" style={{ marginTop: 16 }}>
        <span>Dirigir a:</span>
        {[
          [0, world.teams.find((t) => t.id === home)?.short ?? 'Local'],
          [1, world.teams.find((t) => t.id === away)?.short ?? 'Visita'],
          [null, 'Nadie (solo ver)'],
        ].map(([v, label]) => (
          <button key={String(v)} className={`btn sm ${manage === v ? 'active' : 'ghost'}`} onClick={() => setManage(v)}>
            {label}
          </button>
        ))}
        <span className="spacer" />
        <button
          className="btn primary"
          disabled={!ok}
          onClick={() => nav(manage === null ? 'match' : 'prematch', { mode: 'friendly', homeId: home, awayId: away, userSide: manage, seed: Date.now() })}
        >
          Continuar
        </button>
      </div>
    </div>
  )
}
