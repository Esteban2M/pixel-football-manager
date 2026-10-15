import { overall } from '../game/player.js'
import { formatMoney, squadValue, wageBill, playerValue, potentialStars } from '../game/economy.js'
import { Crest, Ovr, Stars } from '../components/Pixel.jsx'
import { Money } from './MarketTab.jsx'
import { ManagerCard } from './ManagerPanels.jsx'

function Kpi({ label, children }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{children}</div>
    </div>
  )
}

export default function ClubTab({ world, career, team }) {
  const f = team.finances ?? {}
  const youngest = team.players
    .filter((p) => p.age <= 21)
    .sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0))
    .slice(0, 6)
  const mostValuable = team.players
    .slice()
    .sort((a, b) => playerValue(b) - playerValue(a))
    .slice(0, 6)
  return (
    <div className="grid cols-main">
      <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
        <div className="panel">
          <div className="row">
            <Crest team={team} size={48} />
            <h2 style={{ margin: 0 }}>{team.name}</h2>
            <span className="spacer" />
            <span className="chip">Temporada {career.season ?? 1} · {career.seasonLabel}</span>
          </div>
          <div className="kpis" style={{ marginTop: 12 }}>
            <Kpi label="Presupuesto">
              <Money value={f.budget ?? 0} />
            </Kpi>
            <Kpi label="Masa salarial / año">{formatMoney(wageBill(team))}</Kpi>
            <Kpi label="Valor de la plantilla">{formatMoney(squadValue(team))}</Kpi>
            <Kpi label="Ingresos última temp.">{f.lastIncome ? formatMoney(f.lastIncome) : '—'}</Kpi>
            <Kpi label="Salarios última temp.">{f.lastWages ? formatMoney(f.lastWages) : '—'}</Kpi>
            <Kpi label="Plantilla">{team.players.length} jugadores</Kpi>
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            Al cerrar cada temporada cobras ingresos (según el tamaño del club y tu posición final, con premio al campeón) y pagas los salarios. Fichar caro sube la masa salarial: cuidado con los números rojos.
          </p>
        </div>
        <ManagerCard world={world} career={career} />
        <div className="panel">
          <h3>Palmarés e historial</h3>
          {!(career.history ?? []).length ? (
            <p className="small muted">Termina tu primera temporada para empezar el historial.</p>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Temporada</th>
                  <th>Tu club</th>
                  <th className="num">Pos.</th>
                  <th>Campeón</th>
                  <th>Goleador</th>
                </tr>
              </thead>
              <tbody>
                {career.history
                  .slice()
                  .reverse()
                  .map((h) => {
                    const champ = world.teams.find((t) => t.id === h.champion)
                    const mine = world.teams.find((t) => t.id === h.teamId)
                    return (
                      <tr key={h.season} className={h.won ? 'me' : ''}>
                        <td>{h.label}</td>
                        <td>
                          <div className="crest-name">
                            <Crest team={mine} size={16} />
                            {mine?.short ?? '—'}
                            {h.sacked ? ' ❌' : ''}
                          </div>
                        </td>
                        <td className="num">
                          {h.position ?? '—'}/{h.teams}
                        </td>
                        <td>
                          <div className="crest-name">
                            {h.won ? '🏆 ' : ''}
                            <Crest team={champ} size={16} />
                            {champ?.short ?? '?'}
                          </div>
                        </td>
                        <td className="small">{h.topScorer ? `${h.topScorer.name} (${h.topScorer.goals})` : '—'}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          )}
          {career.history?.some((h) => h.won) && <p>🏆 Títulos: {career.history.filter((h) => h.won).length}</p>}
        </div>
      </div>
      <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
        <div className="panel">
          <h3>Joyas de la cantera (≤ 21)</h3>
          {!youngest.length && <p className="small muted">No hay jóvenes en la plantilla.</p>}
          {youngest.map((p) => (
            <div key={p.id} className="row small" style={{ marginBottom: 4 }}>
              <span style={{ flex: 1 }}>
                {p.name} <span className="muted">({p.age})</span>
              </span>
              <Ovr value={overall(p)} />
              <Stars value={potentialStars(p)} />
            </div>
          ))}
        </div>
        <div className="panel">
          <h3>Más valiosos</h3>
          {mostValuable.map((p) => (
            <div key={p.id} className="row small" style={{ marginBottom: 4 }}>
              <span style={{ flex: 1 }}>{p.name}</span>
              <Ovr value={overall(p)} />
              <span className="money">{formatMoney(playerValue(p))}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
