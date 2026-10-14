import { useState } from 'react'
import { useWorld } from '../state/WorldContext.jsx'
import { nextUserFixture, standings, topScorers, applyResult, completeRound } from '../game/season.js'
import { simulateMatch } from '../game/engine/match.js'
import { Crest, Ovr } from '../components/Pixel.jsx'
import SquadTable from '../components/SquadTable.jsx'
import TacticsBoard from '../components/TacticsBoard.jsx'
import PlayerModal from '../components/PlayerModal.jsx'
import { teamStrength } from '../game/team.js'

const TABS = [
  ['home', 'Inicio'],
  ['squad', 'Plantilla'],
  ['tactics', 'Tácticas'],
  ['fixtures', 'Calendario'],
  ['table', 'Clasificación'],
]

export function StandingsTable({ world, career, compact = false }) {
  const rows = standings(world, career)
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Equipo</th>
            <th className="num">PJ</th>
            {!compact && <th className="num">G</th>}
            {!compact && <th className="num">E</th>}
            {!compact && <th className="num">P</th>}
            {!compact && <th className="num">GF</th>}
            {!compact && <th className="num">GC</th>}
            <th className="num">DG</th>
            <th className="num">PTS</th>
            {!compact && <th>Racha</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const team = world.teams.find((t) => t.id === r.id)
            return (
              <tr key={r.id} className={r.id === career.userTeamId ? 'me' : ''}>
                <td className="num">{i + 1}</td>
                <td>
                  <div className="crest-name">
                    <Crest team={team} size={16} />
                    {compact ? r.short : r.name}
                  </div>
                </td>
                <td className="num">{r.p}</td>
                {!compact && <td className="num">{r.w}</td>}
                {!compact && <td className="num">{r.d}</td>}
                {!compact && <td className="num">{r.l}</td>}
                {!compact && <td className="num">{r.gf}</td>}
                {!compact && <td className="num">{r.ga}</td>}
                <td className="num">{r.gf - r.ga}</td>
                <td className="num">
                  <b>{r.pts}</b>
                </td>
                {!compact && <td className="small">{r.form.slice(-5).join(' ')}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function Hub({ nav }) {
  const { world, update } = useWorld()
  const [tab, setTab] = useState('home')
  const [player, setPlayer] = useState(null)
  const career = world.career
  if (!career) {
    return (
      <div className="app">
        <p>No hay temporada en curso.</p>
        <button className="btn" onClick={() => nav('menu')}>
          Menú
        </button>
      </div>
    )
  }
  const team = world.teams.find((t) => t.id === career.userTeamId)
  const fixture = nextUserFixture(career)
  const home = fixture && world.teams.find((t) => t.id === fixture.home)
  const away = fixture && world.teams.find((t) => t.id === fixture.away)
  const userSide = fixture ? (fixture.home === team.id ? 0 : 1) : 0
  const scorers = topScorers(world)
  const played = career.rounds.flat().filter((m) => m.result && (m.home === team.id || m.away === team.id))

  const quickSim = () => {
    update((w) => {
      const c = w.career
      const fx = nextUserFixture(c)
      if (!fx) return
      const h = w.teams.find((t) => t.id === fx.home)
      const a = w.teams.find((t) => t.id === fx.away)
      const { result } = simulateMatch(h, a, `${fx.id}-quick-${Date.now()}`)
      applyResult(w, c, fx, result)
      c.lastResult = { fixtureId: fx.id }
      completeRound(w, c)
    })
  }

  const savePlayer = (draft) => {
    update((w) => {
      const t = w.teams.find((x) => x.id === team.id)
      const i = t.players.findIndex((p) => p.id === draft.id)
      if (i >= 0) t.players[i] = draft
    })
    setPlayer(null)
  }

  const last = career.lastResult && career.rounds.flat().find((m) => m.id === career.lastResult.fixtureId)

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => nav('menu')}>
          ← Menú
        </button>
        <Crest team={team} size={32} />
        <span className="title">
          {team.name} · {career.name}
        </span>
        <span className="chip">
          Jornada {Math.min(career.current + 1, career.rounds.length)}/{career.rounds.length}
        </span>
      </div>
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={`btn sm ${tab === id ? 'active' : 'ghost'}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'home' && (
        <div className="grid cols-main">
          <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
            {fixture ? (
              <div className="panel">
                <h2>Próximo partido · Jornada {career.current + 1}</h2>
                <div className="scoreboard" style={{ padding: 0 }}>
                  <div className="side">
                    <Crest team={home} size={48} />
                    <div>
                      <div className="tname">{home.name}</div>
                      <Ovr value={teamStrength(home)} />
                    </div>
                  </div>
                  <div className="score" style={{ fontSize: 14 }}>
                    VS
                  </div>
                  <div className="side away">
                    <div>
                      <div className="tname">{away.name}</div>
                      <Ovr value={teamStrength(away)} />
                    </div>
                    <Crest team={away} size={48} />
                  </div>
                </div>
                <div className="row" style={{ marginTop: 14 }}>
                  <button
                    className="btn primary"
                    onClick={() => nav('prematch', { mode: 'career', homeId: fixture.home, awayId: fixture.away, userSide, seed: `${fixture.id}-${Date.now()}` })}
                  >
                    ▶ Jugar partido
                  </button>
                  <button className="btn ghost" onClick={quickSim}>
                    ⏭ Simular resultado
                  </button>
                </div>
              </div>
            ) : (
              <div className="panel">
                <h2>🏆 Temporada terminada</h2>
                <StandingsTable world={world} career={career} />
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn primary" onClick={() => nav('select')}>
                    Nueva temporada
                  </button>
                </div>
              </div>
            )}
            {last?.result && (
              <div className="panel">
                <h3>Último resultado</h3>
                <div className="row">
                  <Crest team={world.teams.find((t) => t.id === last.home)} size={24} />
                  <b className="px" style={{ fontSize: 12 }}>
                    {last.result.score[0]} - {last.result.score[1]}
                  </b>
                  <Crest team={world.teams.find((t) => t.id === last.away)} size={24} />
                  <span className="small muted">
                    {last.result.goals.map((g) => `${g.name} ${g.minute}'`).join(', ') || 'Sin goles'}
                  </span>
                </div>
                {last.result.motm && <div className="small" style={{ marginTop: 6 }}>⭐ {last.result.motm.name} ({last.result.motm.rating.toFixed(1)})</div>}
              </div>
            )}
            <div className="panel">
              <h3>Noticias</h3>
              <div className="feed" style={{ maxHeight: 220 }}>
                {career.news
                  .slice()
                  .reverse()
                  .slice(0, 20)
                  .map((n, i) => (
                    <div key={i} className="ev">
                      <span className="min">J{n.round + 1}</span>
                      <span>{n.text}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
            <div className="panel">
              <h3>Clasificación</h3>
              <StandingsTable world={world} career={career} compact />
            </div>
            <div className="panel">
              <h3>Goleadores</h3>
              {scorers.length ? (
                <table className="data">
                  <tbody>
                    {scorers.map((s) => (
                      <tr key={s.name + s.team}>
                        <td>{s.name}</td>
                        <td className="small muted">{s.team}</td>
                        <td className="num">⚽ {s.goals}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="small muted">Aún no hay goles.</p>
              )}
            </div>
            <div className="panel">
              <h3>Tus resultados</h3>
              {played.length ? (
                played.map((m) => (
                  <div key={m.id} className="row small" style={{ marginBottom: 4 }}>
                    <span className="muted">J{Number(m.id.split('-')[0].slice(1)) + 1}</span>
                    {world.teams.find((t) => t.id === m.home)?.short} {m.result.score[0]} - {m.result.score[1]} {world.teams.find((t) => t.id === m.away)?.short}
                  </div>
                ))
              ) : (
                <p className="small muted">Todavía no has jugado.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'squad' && (
        <div className="panel">
          <h2>Plantilla · {team.players.length} jugadores</h2>
          <SquadTable team={team} onSelect={setPlayer} />
        </div>
      )}

      {tab === 'tactics' && (
        <div className="panel">
          <h2>Tácticas</h2>
          <TacticsBoard
            team={team}
            onChange={({ tactics, lineup }) =>
              update((w) => {
                const t = w.teams.find((x) => x.id === team.id)
                if (tactics) t.tactics = tactics
                if (lineup) t.lineup = lineup
              })
            }
          />
        </div>
      )}

      {tab === 'fixtures' && (
        <div className="grid cols-3">
          {career.rounds.map((round, i) => (
            <div key={i} className="panel" style={i === career.current ? { outline: '3px solid var(--accent)' } : undefined}>
              <h3>Jornada {i + 1}</h3>
              {round.map((m) => {
                const h = world.teams.find((t) => t.id === m.home)
                const a = world.teams.find((t) => t.id === m.away)
                return (
                  <div key={m.id} className="row small" style={{ marginBottom: 6 }}>
                    <Crest team={h} size={16} />
                    <span>{h?.short}</span>
                    <b>{m.result ? `${m.result.score[0]} - ${m.result.score[1]}` : 'vs'}</b>
                    <span>{a?.short}</span>
                    <Crest team={a} size={16} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}

      {tab === 'table' && (
        <div className="panel">
          <h2>Clasificación</h2>
          <StandingsTable world={world} career={career} />
        </div>
      )}

      {player && <PlayerModal player={player} team={team} onClose={() => setPlayer(null)} onSave={savePlayer} />}
    </div>
  )
}
