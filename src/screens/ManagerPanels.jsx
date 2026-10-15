import { boardMood, prestige, regularPositions } from '../game/manager.js'
import { teamStrength } from '../game/team.js'
import { squadMood } from '../game/narrative.js'
import { Crest, Ovr, Bar } from '../components/Pixel.jsx'

// Board objective and confidence, shown on the Hub home tab.
export function BoardPanel({ career, team }) {
  if (!career.board) return null
  const { objective, confidence } = career.board
  const mood = boardMood(confidence)
  const pos = regularPositions(career.competition)[career.userTeamId]
  return (
    <div className="panel">
      <h3>Directiva</h3>
      <div className="small">
        🎯 <b>{objective.text}</b>
      </div>
      {pos && objective.target && career.matchdayNo > 1 && (
        <div className="small muted" style={{ marginTop: 4 }}>
          Vas {pos}º · objetivo: {objective.target}º o mejor {pos <= objective.target ? '✅' : '⚠️'}
        </div>
      )}
      <div className="row small" style={{ marginTop: 8 }}>
        Confianza
        <div style={{ flex: 1 }}>
          <Bar value={confidence} color={mood.color} />
        </div>
        <b style={{ color: mood.color }}>{mood.label}</b>
      </div>
      {team && <div className="small muted" style={{ marginTop: 4 }}>Vestuario: {squadMood(team).label}</div>}
    </div>
  )
}

export function JobOffers({ world, career, onTake, title = 'Ofertas de trabajo' }) {
  const offers = career.jobOffers ?? []
  return (
    <div>
      <h3>{title}</h3>
      {!offers.length && <p className="small muted">Ningún club te ha llamado por ahora.</p>}
      {offers.map((o) => {
        const t = world.teams.find((x) => x.id === o.teamId)
        if (!t) return null
        return (
          <div key={o.teamId} className="row" style={{ marginBottom: 6 }}>
            <Crest team={t} size={24} />
            <span style={{ flex: 1 }}>
              <b>{t.name}</b> <span className="small muted">· prestigio {o.prestige}</span>
            </span>
            <Ovr value={teamStrength(t)} />
            <button className="btn sm" onClick={() => onTake(o.teamId)}>
              Aceptar
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function SackedPanel({ world, career, onTake, onSimulate, onNew }) {
  const old = world.teams.find((t) => t.id === career.sacked.teamId)
  return (
    <div className="panel" style={{ borderColor: 'var(--bad)' }}>
      <h2>❌ Despedido</h2>
      <div className="row">
        <Crest team={old} size={48} />
        <p>
          {old?.name} te destituyó ({career.sacked.when.toLowerCase()}). Tu reputación es {career.manager.reputation}. Acepta una oferta para volver al banquillo.
        </p>
      </div>
      <JobOffers world={world} career={career} onTake={onTake} />
      <div className="row" style={{ marginTop: 12 }}>
        {!career.competition.finished && (
          <button className="btn ghost" onClick={onSimulate}>
            ⏭ Simular fecha sin equipo
          </button>
        )}
        <button className="btn ghost" onClick={onNew}>
          Nueva carrera
        </button>
      </div>
    </div>
  )
}

// End-of-season verdict of the board.
export function ObjectiveVerdict({ career }) {
  const r = career.review
  if (!r || !r.objective) return null
  const color = r.met ? 'var(--good)' : r.met === false ? 'var(--bad)' : 'var(--muted)'
  return (
    <div className="offer-msg" style={{ borderColor: color }}>
      🎯 {r.objective.text}: <b style={{ color }}>{r.met ? 'cumplido' : r.met === false ? 'no cumplido' : 'sin objetivo'}</b>
      {r.position ? ` · terminaste ${r.position}º` : ''} · confianza {r.confDelta >= 0 ? '+' : ''}
      {Math.round(r.confDelta)} · reputación {r.repDelta >= 0 ? '+' : ''}
      {r.repDelta}
    </div>
  )
}

export function ManagerCard({ world, career }) {
  const m = career.manager
  if (!m) return null
  return (
    <div className="panel">
      <h3>Tu carrera como DT</h3>
      <div className="kpis">
        <div className="kpi">
          <div className="label">Reputación</div>
          <div className="value">{m.reputation}/100</div>
        </div>
        <div className="kpi">
          <div className="label">Títulos</div>
          <div className="value">{m.titles}</div>
        </div>
        <div className="kpi">
          <div className="label">Clubes</div>
          <div className="value">{new Set(m.stints.map((s) => s.teamId)).size}</div>
        </div>
        <div className="kpi">
          <div className="label">Despidos</div>
          <div className="value">{m.sackings}</div>
        </div>
      </div>
      <table className="data" style={{ marginTop: 10 }}>
        <thead>
          <tr>
            <th>Club</th>
            <th>Periodo</th>
            <th className="num">G-E-P</th>
            <th className="num">Títulos</th>
          </tr>
        </thead>
        <tbody>
          {m.stints
            .slice()
            .reverse()
            .map((s, i) => {
              const t = world.teams.find((x) => x.id === s.teamId)
              return (
                <tr key={i} className={!s.to ? 'me' : ''}>
                  <td>
                    <div className="crest-name">
                      <Crest team={t} size={16} />
                      {t?.short ?? s.teamId}
                      {s.sacked ? ' ❌' : ''}
                    </div>
                  </td>
                  <td className="small">
                    {s.from} → {s.to ?? 'hoy'}
                  </td>
                  <td className="num small">
                    {s.w}-{s.d}-{s.l}
                  </td>
                  <td className="num">{s.titles ? `🏆 ${s.titles}` : '—'}</td>
                </tr>
              )
            })}
        </tbody>
      </table>
      <p className="small muted" style={{ marginBottom: 0 }}>
        La reputación sube cuando cumples objetivos y ganas títulos. Con más reputación te llaman clubes más grandes (prestigio actual de tu club: {prestige(world, career.userTeamId)}).
      </p>
    </div>
  )
}

export function PressPanel({ press, onAnswer }) {
  if (!press) return null
  return (
    <div className="panel" style={{ borderColor: 'var(--accent2)' }}>
      <h3>🎙 Rueda de prensa</h3>
      <p style={{ marginTop: 0 }}>{press.question}</p>
      <div className="grid" style={{ gap: 6 }}>
        {press.options.map((o, i) => (
          <button key={i} className="press-option" onClick={() => onAnswer(i)}>
            <span>{o.text}</span>
            {o.hint && <span className="small muted">{o.hint}</span>}
          </button>
        ))}
      </div>
      <div className="small muted" style={{ marginTop: 6 }}>
        Puedes no responder: la pregunta caduca tras el partido.
      </div>
    </div>
  )
}
