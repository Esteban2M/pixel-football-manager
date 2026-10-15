import { useState } from 'react'
import { useWorld } from '../state/WorldContext.jsx'
import { createCareer } from '../game/season.js'
import { normalizeFormat } from '../game/formats.js'
import { teamStrength } from '../game/team.js'
import { Crest, Ovr } from '../components/Pixel.jsx'

export function LeagueCard({ world, league, selected, onClick, children }) {
  const teams = league.teamIds.map((id) => world.teams.find((t) => t.id === id)).filter(Boolean)
  const { format } = normalizeFormat(league.format)
  return (
    <div className={`panel team-card ${selected ? 'selected' : ''}`} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick?.()}>
      <div className="px" style={{ fontSize: 12 }}>
        {league.name}
      </div>
      <div className="small muted">{format?.name}</div>
      <div className="row" style={{ justifyContent: 'center', gap: 2 }}>
        {teams.slice(0, 18).map((t) => (
          <Crest key={t.id} team={t} size={16} />
        ))}
        {teams.length > 18 && <span className="small muted">+{teams.length - 18}</span>}
      </div>
      <span className="chip">{teams.length} equipos</span>
      {children}
    </div>
  )
}

export default function TeamSelect({ nav }) {
  const { world, update } = useWorld()
  const [leagueId, setLeagueId] = useState(world.leagues[0]?.id)
  const [teamId, setTeamId] = useState(null)
  const league = world.leagues.find((l) => l.id === leagueId)
  const teams = league ? league.teamIds.map((id) => world.teams.find((t) => t.id === id)).filter(Boolean) : []
  const start = () => {
    update((w) => {
      w.career = createCareer(w, leagueId, teamId)
    })
    nav('hub')
  }
  return (
    <div className="app">
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => nav('menu')}>
          ← Menú
        </button>
        <span className="title">Modo carrera</span>
        <button className="btn ghost sm" onClick={() => nav('leagues')}>
          Gestionar ligas
        </button>
      </div>
      <h2>1 · Elige la competición</h2>
      <div className="grid cols-3">
        {world.leagues.map((l) => (
          <LeagueCard
            key={l.id}
            world={world}
            league={l}
            selected={l.id === leagueId}
            onClick={() => {
              setLeagueId(l.id)
              setTeamId(null)
            }}
          />
        ))}
      </div>
      {league && (
        <>
          <h2 style={{ marginTop: 20 }}>2 · Elige tu equipo</h2>
          <p className="small muted" style={{ marginTop: 0 }}>{normalizeFormat(league.format).format?.description}</p>
          <div className="team-grid">
            {teams
              .slice()
              .sort((a, b) => teamStrength(b) - teamStrength(a))
              .map((t) => (
                <button key={t.id} className={`team-pick ${teamId === t.id ? 'on' : ''}`} onClick={() => setTeamId(t.id)}>
                  <Crest team={t} size={32} />
                  <span>{t.name}</span>
                  <Ovr value={teamStrength(t)} />
                  {t.generated && <span className="small muted">plantilla generada</span>}
                  {t.confidence === 'parcial' && <span className="small muted">plantilla parcial</span>}
                </button>
              ))}
          </div>
        </>
      )}
      <div className="row" style={{ marginTop: 16 }}>
        <span className="spacer" />
        {world.career && <span className="small muted">Esto reemplaza la carrera en curso.</span>}
        <button className="btn primary" disabled={!teamId || teams.length < 2} onClick={start}>
          Empezar carrera
        </button>
      </div>
    </div>
  )
}
