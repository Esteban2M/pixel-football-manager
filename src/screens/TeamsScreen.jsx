import { useState } from 'react'
import { useWorld } from '../state/WorldContext.jsx'
import { createCustomTeam } from '../game/generate.js'
import TeamCard from '../components/TeamCard.jsx'

export default function TeamsScreen({ nav }) {
  const { world, update } = useWorld()
  const [name, setName] = useState('')
  const [short, setShort] = useState('')
  const [primary, setPrimary] = useState('#c8102e')
  const [secondary, setSecondary] = useState('#ffffff')
  const [quality, setQuality] = useState(12)

  const create = () => {
    const team = createCustomTeam({ name: name.trim(), short: short.trim(), primary, secondary, quality })
    update((w) => {
      w.teams.push(team)
    })
    nav('teamEdit', { teamId: team.id })
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => nav('menu')}>
          ← Menú
        </button>
        <span className="title">Editor de equipos</span>
      </div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <h2>Crear equipo nuevo</h2>
        <div className="row" style={{ alignItems: 'end' }}>
          <label className="field" style={{ flex: '2 1 180px' }}>
            Nombre
            <input type="text" value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="Ej. Pixel FC" />
          </label>
          <label className="field" style={{ flex: '1 1 80px' }}>
            Siglas
            <input type="text" value={short} maxLength={3} onChange={(e) => setShort(e.target.value)} placeholder="PFC" />
          </label>
          <label className="field">
            Color 1
            <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} />
          </label>
          <label className="field">
            Color 2
            <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} />
          </label>
          <label className="field" style={{ flex: '1 1 160px' }}>
            Nivel de la plantilla: {quality}
            <input type="range" min={6} max={17} value={quality} onChange={(e) => setQuality(Number(e.target.value))} />
          </label>
          <button className="btn primary" disabled={!name.trim()} onClick={create}>
            Crear
          </button>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Se genera una plantilla de 23 jugadores con apariencia aleatoria. Después puedes editar a cada uno, su retrato pixel art, el escudo y los uniformes.
        </p>
      </div>
      <div className="grid cols-3">
        {world.teams.map((t) => (
          <TeamCard key={t.id} team={t} onClick={() => nav('teamEdit', { teamId: t.id })}>
            <span className="small muted">{t.custom ? 'Equipo creado' : 'Liga MX'} · clic para editar</span>
          </TeamCard>
        ))}
      </div>
    </div>
  )
}
