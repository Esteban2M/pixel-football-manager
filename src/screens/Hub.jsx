import { useState } from 'react'
import { useWorld } from '../state/WorldContext.jsx'
import { nextUserFixture, topScorers, applyResult, completeRound, currentFixtures, userResults } from '../game/season.js'
import { groupTable, currentStage, findFixture, teamStatus } from '../game/competition.js'
import { simulateMatch } from '../game/engine/match.js'
import { Crest, Ovr } from '../components/Pixel.jsx'
import SquadTable from '../components/SquadTable.jsx'
import TacticsBoard from '../components/TacticsBoard.jsx'
import PlayerModal from '../components/PlayerModal.jsx'
import { teamStrength } from '../game/team.js'

// Zone colour for a table position; negative positions count from the bottom.
function zoneFor(zones, pos, size) {
  return zones?.find((z) => {
    const from = z.from < 0 ? size + 1 + z.from : z.from
    const to = z.to < 0 ? size + 1 + z.to : z.to
    return pos >= from && pos <= to
  })
}

export function GroupTable({ world, comp, stage, g, userTeamId, zones, compact = false }) {
  const rows = groupTable(comp, stage, g)
  const team = (id) => world.teams.find((t) => t.id === id)
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
          {rows.map((r) => {
            const zone = zoneFor(zones, r.pos, rows.length)
            const t = team(r.id)
            return (
              <tr key={r.id} className={r.id === userTeamId ? 'me' : ''}>
                <td className="num" style={zone ? { boxShadow: `inset 4px 0 0 ${zone.color}` } : undefined} title={zone?.label}>
                  {r.pos}
                </td>
                <td>
                  <div className="crest-name">
                    <Crest team={t} size={16} />
                    {compact ? t?.short : t?.name}
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

function ZoneLegend({ zones }) {
  if (!zones?.length) return null
  return (
    <div className="row small" style={{ marginTop: 8 }}>
      {zones.map((z) => (
        <span key={z.label} className="row" style={{ gap: 4 }}>
          <i style={{ width: 10, height: 10, background: z.color, display: 'inline-block', border: '1px solid #000' }} />
          {z.label}
        </span>
      ))}
    </div>
  )
}

function FixtureLine({ world, f, userTeamId }) {
  const h = world.teams.find((t) => t.id === f.home)
  const a = world.teams.find((t) => t.id === f.away)
  const mine = f.home === userTeamId || f.away === userTeamId
  return (
    <div className="row small" style={{ marginBottom: 4, gap: 6, fontWeight: mine ? 700 : 400 }}>
      <Crest team={h} size={16} />
      <span style={{ minWidth: 34 }}>{h?.short}</span>
      <b style={{ minWidth: 44, textAlign: 'center' }}>{f.result ? `${f.result.score[0]} - ${f.result.score[1]}` : 'vs'}</b>
      <span style={{ minWidth: 34 }}>{a?.short}</span>
      <Crest team={a} size={16} />
      {f.result?.pens && <span className="muted">(pen. {f.result.pens.join('-')})</span>}
      {f.leg && <span className="muted">· {f.leg === 1 ? 'ida' : f.leg === 2 ? 'vuelta' : `juego ${f.leg}`}</span>}
    </div>
  )
}

export function Bracket({ world, stage, userTeamId }) {
  const team = (id) => world.teams.find((t) => t.id === id)
  return (
    <div className="bracket">
      {stage.ko.rounds.map((r, i) => (
        <div key={i} className="bracket-round">
          <h3>{r.name}</h3>
          {r.ties.map((t) => (
            <div key={t.id} className="tie">
              {[t.a, t.b].map((id, k) => {
                const tm = team(id)
                const seed = stage.ko.seeds.indexOf(id) + 1
                return (
                  <div key={id} className={`tie-team ${t.winner === id ? 'win' : t.winner ? 'lose' : ''} ${id === userTeamId ? 'mine' : ''}`}>
                    <span className="muted small">{seed}</span>
                    <Crest team={tm} size={16} />
                    <span style={{ flex: 1 }}>{tm?.short}</span>
                    {t.mode === 'bo3' ? <b>{t.wins[k]}</b> : t.agg ? <b>{t.agg[k]}</b> : null}
                  </div>
                )
              })}
              {t.mode === 'double' && <div className="small muted">Ida y vuelta</div>}
              {t.mode === 'bo3' && <div className="small muted">Mejor de 3</div>}
            </div>
          ))}
          {r.byes.length > 0 && <div className="small muted">Descansan: {r.byes.map((id) => team(id)?.short).join(', ')}</div>}
        </div>
      ))}
    </div>
  )
}

const TABS = [
  ['home', 'Inicio'],
  ['squad', 'Plantilla'],
  ['tactics', 'Tácticas'],
  ['fixtures', 'Calendario'],
  ['table', 'Clasificación'],
]

export default function Hub({ nav }) {
  const { world, update } = useWorld()
  const [tab, setTab] = useState('home')
  const [player, setPlayer] = useState(null)
  const career = world.career
  if (!career?.competition) {
    return (
      <div className="app">
        <p>No hay temporada en curso.</p>
        <button className="btn" onClick={() => nav('menu')}>
          Menú
        </button>
      </div>
    )
  }
  const comp = career.competition
  const team = world.teams.find((t) => t.id === career.userTeamId)
  const stage = currentStage(comp)
  const fixture = nextUserFixture(career)
  const home = fixture && world.teams.find((t) => t.id === fixture.home)
  const away = fixture && world.teams.find((t) => t.id === fixture.away)
  const userSide = fixture ? (fixture.home === team.id ? 0 : 1) : 0
  const scorers = topScorers(world, career)
  const played = userResults(career)
  const status = teamStatus(comp, team.id)
  const koStage = comp.stages.find((s) => s?.type === 'knockout' && s.ko.rounds.length)
  const tableStages = comp.stages.map((s, i) => ({ s, i })).filter(({ s }) => s && s.type !== 'knockout')
  const zones = comp.format.zones

  const simulateRound = (includeMine) => {
    const seed = `${comp.seed}-quick-${Date.now()}`
    update((w) => {
      const c = w.career
      const fx = nextUserFixture(c)
      if (fx && includeMine) {
        const h = w.teams.find((t) => t.id === fx.home)
        const a = w.teams.find((t) => t.id === fx.away)
        applyResult(w, c, fx, simulateMatch(h, a, seed).result)
        c.lastResult = { fixtureId: fx.id }
      }
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

  const last = career.lastResult && findFixture(comp, career.lastResult.fixtureId)
  const champion = comp.finished && world.teams.find((t) => t.id === comp.champion)
  const myGroup = stage && stage.type !== 'knockout' ? Math.max(0, stage.groups.findIndex((g) => g.teams.includes(team.id))) : 0
  const lastTable = tableStages[tableStages.length - 1]

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
          {comp.finished ? 'Finalizado' : `${stage.name} · Fecha ${career.matchdayNo}`}
        </span>
      </div>
      <div className="tabs">
        {TABS.map(([id, label]) => (
          <button key={id} className={`btn sm ${tab === id ? 'active' : 'ghost'}`} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
        {koStage && (
          <button className={`btn sm ${tab === 'bracket' ? 'active' : 'ghost'}`} onClick={() => setTab('bracket')}>
            {koStage.name}
          </button>
        )}
      </div>

      {tab === 'home' && (
        <div className="grid cols-main">
          <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
            {champion ? (
              <div className="panel champion">
                <h2>🏆 ¡{champion.name} campeón!</h2>
                <div className="row">
                  <Crest team={champion} size={64} />
                  <p>{champion.id === team.id ? '¡Lo lograste! Tu equipo levanta el título.' : `${career.name} terminó. ${team.name} no consiguió el título esta vez.`}</p>
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  <button className="btn primary" onClick={() => nav('select')}>
                    Nueva temporada
                  </button>
                </div>
              </div>
            ) : fixture ? (
              <div className="panel">
                <h2>
                  Próximo partido · {stage.name}
                  {fixture.leg ? ` · ${fixture.leg === 1 ? 'Ida' : fixture.leg === 2 ? 'Vuelta' : `Juego ${fixture.leg}`}` : ''}
                </h2>
                <div className="scoreboard" style={{ padding: 0, background: 'none' }}>
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
                  <button className="btn ghost" onClick={() => simulateRound(true)}>
                    ⏭ Simular resultado
                  </button>
                </div>
              </div>
            ) : (
              <div className="panel">
                <h2>{status === 'out' ? 'Tu equipo ya no compite en esta fase' : 'Tu equipo descansa esta fecha'}</h2>
                <p className="small muted">
                  {stage.name}: se juegan {currentFixtures(career).length} partido(s).
                </p>
                <button className="btn primary" onClick={() => simulateRound(false)}>
                  ⏭ Simular fecha
                </button>
              </div>
            )}
            {last?.result && (
              <div className="panel">
                <h3>Último resultado</h3>
                <FixtureLine world={world} f={last} userTeamId={team.id} />
                <div className="small muted">{last.result.goals.map((g) => `${g.name} ${g.minute}'`).join(', ') || 'Sin goles'}</div>
                {last.result.motm && <div className="small" style={{ marginTop: 6 }}>⭐ {last.result.motm.name} ({last.result.motm.rating.toFixed(1)})</div>}
              </div>
            )}
            {!comp.finished && currentFixtures(career).length > 0 && (
              <div className="panel">
                <h3>Esta fecha</h3>
                {currentFixtures(career).map((f) => (
                  <FixtureLine key={f.id} world={world} f={f} userTeamId={team.id} />
                ))}
              </div>
            )}
            <div className="panel">
              <h3>Noticias</h3>
              <div className="feed" style={{ maxHeight: 240 }}>
                {career.news
                  .slice()
                  .reverse()
                  .slice(0, 30)
                  .map((n, i) => (
                    <div key={i} className="ev">
                      <span className="min">F{n.round}</span>
                      <span>{n.text}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
          <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
            {lastTable && (
              <div className="panel">
                <h3>
                  {lastTable.s.name}
                  {lastTable.s.groups.length > 1 ? ` · ${lastTable.s.groups[myGroup]?.name ?? ''}` : ''}
                </h3>
                <GroupTable world={world} comp={comp} stage={lastTable.s} g={lastTable.s.groups.length > 1 ? myGroup : 0} userTeamId={team.id} zones={lastTable.i === 0 ? zones : null} compact />
              </div>
            )}
            {stage?.type === 'knockout' && (
              <div className="panel">
                <h3>{stage.name}</h3>
                <Bracket world={world} stage={stage} userTeamId={team.id} />
              </div>
            )}
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
              {played.length ? played.map((m) => <FixtureLine key={m.id} world={world} f={m} userTeamId={team.id} />) : <p className="small muted">Todavía no has jugado.</p>}
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
        <div className="grid" style={{ gap: 16 }}>
          {comp.stages.map((st, si) =>
            st ? (
              <div key={si}>
                <h2>{st.name}</h2>
                <div className="grid cols-3">
                  {st.matchdays.map((md, i) => (
                    <div key={i} className="panel" style={si === comp.stage && i === comp.md && !comp.finished ? { outline: '3px solid var(--accent)' } : undefined}>
                      <h3>
                        {st.type === 'knockout' ? `${st.name} · partido ${i + 1}` : `Jornada ${i + 1}`}
                      </h3>
                      {md.map((f) => (
                        <FixtureLine key={f.id} world={world} f={f} userTeamId={team.id} />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ) : null,
          )}
        </div>
      )}

      {tab === 'table' && (
        <div className="grid" style={{ gap: 16 }}>
          {tableStages
            .slice()
            .reverse()
            .map(({ s, i }) =>
              s.groups.map((g, gi) => (
                <div key={`${i}-${gi}`} className="panel">
                  <h2>
                    {s.name}
                    {s.groups.length > 1 ? ` · ${g.name}` : ''}
                    {s.carry ? <span className="small muted"> (con puntos arrastrados{s.def.halvePoints ? ' a la mitad' : ''})</span> : null}
                  </h2>
                  <GroupTable world={world} comp={comp} stage={s} g={gi} userTeamId={team.id} zones={i === 0 ? zones : null} />
                  {i === 0 && gi === 0 && <ZoneLegend zones={zones} />}
                </div>
              )),
            )}
        </div>
      )}

      {tab === 'bracket' && koStage && (
        <div className="panel">
          <h2>{koStage.name}</h2>
          <Bracket world={world} stage={koStage} userTeamId={team.id} />
        </div>
      )}

      {player && <PlayerModal player={player} team={team} onClose={() => setPlayer(null)} onSave={savePlayer} />}
    </div>
  )
}
