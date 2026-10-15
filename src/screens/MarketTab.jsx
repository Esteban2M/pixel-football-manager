import { useMemo, useState } from 'react'
import { ROLES, ROLE_KEYS, overall } from '../game/player.js'
import { playerValue, potentialStars, formatMoney, wageBill } from '../game/economy.js'
import {
  marketSearch,
  evaluateOffer,
  completePurchase,
  registerAttempt,
  acceptOffer,
  rejectOffer,
  releasePlayer,
  releaseCost,
  renewContract,
  renewalTerms,
  windowOpen,
  wageDemand,
  findPlayer,
  MAX_SQUAD,
  MIN_SQUAD,
  WINDOW_MATCHDAYS,
} from '../game/market.js'
import { Crest, Ovr, Portrait, Stars, Modal } from '../components/Pixel.jsx'
import PlayerModal from '../components/PlayerModal.jsx'

const VALUE_CAPS = [
  ['', 'Cualquiera'],
  ['budget', 'Mi presupuesto'],
  ['1', '≤ $1M'],
  ['3', '≤ $3M'],
  ['6', '≤ $6M'],
  ['12', '≤ $12M'],
]

export function Money({ value }) {
  return <span className={`money ${value < 0 ? 'neg' : ''}`}>{formatMoney(value)}</span>
}

function PlayerLine({ player, team, world }) {
  return (
    <div className="crest-name">
      <Portrait player={player} team={team ?? world.teams[0]} size={24} />
      <span>
        {player.name}
        <span className="small muted">
          {' '}
          · {player.roles.map((r) => ROLES[r].label).join('/')} · {player.age} años
        </span>
      </span>
    </div>
  )
}

function OfferModal({ world, career, playerId, onClose, onDone }) {
  const found = findPlayer(world, playerId)
  const user = world.teams.find((t) => t.id === career.userTeamId)
  const p = found?.player
  const [fee, setFee] = useState(() => (found?.team ? Math.round(playerValue(p) * 100) / 100 : 0))
  const [reply, setReply] = useState(null)
  if (!p) return null
  const free = !found.team
  const send = (amount) => {
    const ev = evaluateOffer(world, career, { playerId, fee: amount })
    setReply(ev)
    onDone(ev, amount)
  }
  return (
    <Modal onClose={onClose}>
      <div className="row" style={{ marginBottom: 10 }}>
        <h2 style={{ margin: 0 }}>{free ? 'Fichar agente libre' : 'Hacer oferta'}</h2>
        <span className="spacer" />
        <button className="btn ghost sm" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <div className="row" style={{ gap: 12 }}>
        <PlayerLine player={p} team={found.team ?? user} world={world} />
        <Ovr value={overall(p)} />
        <Stars value={potentialStars(p)} />
      </div>
      <div className="kpis" style={{ marginTop: 12 }}>
        <div className="kpi">
          <div className="label">Club</div>
          <div className="value">{found.team ? found.team.short : 'Libre'}</div>
        </div>
        <div className="kpi">
          <div className="label">Valor de mercado</div>
          <div className="value">{formatMoney(playerValue(p))}</div>
        </div>
        <div className="kpi">
          <div className="label">Salario pedido</div>
          <div className="value">{formatMoney(wageDemand(p, user))}/año</div>
        </div>
        <div className="kpi">
          <div className="label">Tu presupuesto</div>
          <div className="value">
            <Money value={user.finances.budget} />
          </div>
        </div>
      </div>
      {!free && (
        <label className="field" style={{ marginTop: 12 }}>
          Traspaso ofrecido (millones)
          <div className="row">
            <input type="number" min={0} step={0.05} value={fee} onChange={(e) => setFee(Math.max(0, Number(e.target.value) || 0))} style={{ width: 120 }} />
            <span className="money">{formatMoney(fee)}</span>
            {[0.9, 1, 1.2, 1.5].map((k) => (
              <button key={k} className="btn ghost sm" onClick={() => setFee(Math.round(playerValue(p) * k * 100) / 100)}>
                ×{k}
              </button>
            ))}
          </div>
        </label>
      )}
      {reply && <div className={`offer-msg ${reply.status}`}>{reply.message}</div>}
      <div className="row" style={{ marginTop: 14 }}>
        <span className="spacer" />
        {reply?.status === 'counter' && (
          <button className="btn" onClick={() => send(reply.ask)}>
            Aceptar contraoferta ({formatMoney(reply.ask)})
          </button>
        )}
        {reply?.status === 'accepted' ? (
          <button className="btn primary" onClick={onClose}>
            ¡Hecho!
          </button>
        ) : (
          <button className="btn primary" onClick={() => send(free ? 0 : fee)}>
            {free ? 'Ofrecer contrato' : 'Enviar oferta'}
          </button>
        )}
      </div>
    </Modal>
  )
}

function ResultsTable({ world, rows, onOffer, onView, budget }) {
  if (!rows.length) return <p className="small muted">Ningún jugador coincide con los filtros.</p>
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th>Jugador</th>
            <th>Club</th>
            <th className="num">Med</th>
            <th>Pot.</th>
            <th className="num">Valor</th>
            <th className="num">Contr.</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ player: p, team }) => {
            const value = playerValue(p)
            return (
              <tr key={p.id} className="clickable" onClick={() => onView(p, team)}>
                <td>
                  <PlayerLine player={p} team={team} world={world} />
                </td>
                <td>
                  {team ? (
                    <div className="crest-name">
                      <Crest team={team} size={16} />
                      {team.short}
                    </div>
                  ) : (
                    <span className="chip">Libre</span>
                  )}
                </td>
                <td className="num">
                  <Ovr value={overall(p)} />
                </td>
                <td>
                  <Stars value={potentialStars(p)} />
                </td>
                <td className="num money small" style={team && value > budget ? { color: 'var(--muted)' } : undefined}>
                  {formatMoney(value)}
                </td>
                <td className="num small">{team ? p.contract : '—'}</td>
                <td>
                  <button
                    className="btn sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOffer(p.id)
                    }}
                  >
                    {team ? 'Ofertar' : 'Fichar'}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default function MarketTab({ world, career, update }) {
  const [sub, setSub] = useState('search')
  const [filters, setFilters] = useState({ leagueId: '', role: '', minOvr: 60, maxAge: 40, cap: '', text: '' })
  const [offerFor, setOfferFor] = useState(null)
  const [view, setView] = useState(null)
  const user = world.teams.find((t) => t.id === career.userTeamId)
  const open = windowOpen(career)
  const budget = user.finances.budget
  const setF = (patch) => setFilters((f) => ({ ...f, ...patch }))
  const maxValue = filters.cap === 'budget' ? budget : filters.cap ? Number(filters.cap) : Infinity
  const rows = useMemo(
    () => marketSearch(world, career, { leagueId: filters.leagueId, role: filters.role, minOvr: filters.minOvr, maxAge: filters.maxAge, maxValue, text: filters.text, free: sub === 'free' }).slice(0, 80),
    [world, career, filters, maxValue, sub],
  )
  const offers = (career.offers ?? []).filter((o) => user.players.some((p) => p.id === o.playerId))

  const onOfferResult = (ev, amount) => {
    const id = offerFor
    update((w) => {
      if (ev.status === 'accepted') completePurchase(w, w.career, id, amount)
      else if (ev.status === 'counter' || ev.status === 'rejected') registerAttempt(w.career, id)
    })
  }

  const SUBS = [
    ['search', 'Buscar jugadores'],
    ['free', `Agentes libres (${world.freeAgents?.length ?? 0})`],
    ['offers', `Ofertas recibidas (${offers.length})`],
    ['mine', 'Mi plantilla'],
    ['history', 'Movimientos'],
  ]

  return (
    <div className="grid" style={{ gap: 16 }}>
      <div className="panel">
        <div className="row">
          <h2 style={{ margin: 0 }}>Mercado de fichajes</h2>
          <span className={`chip`} style={{ borderColor: open ? 'var(--good)' : 'var(--bad)' }}>
            {open ? (career.finished ? 'Abierto · pretemporada' : `Abierto hasta la jornada ${WINDOW_MATCHDAYS}`) : 'Cerrado hasta fin de temporada'}
          </span>
          <span className="spacer" />
          <span className="small">
            Presupuesto <b><Money value={budget} /></b> · Salarios <Money value={wageBill(user)} />/año · Plantilla {user.players.length}/{MAX_SQUAD}
          </span>
        </div>
        <div className="tabs" style={{ marginTop: 10, marginBottom: 0 }}>
          {SUBS.map(([id, label]) => (
            <button key={id} className={`btn sm ${sub === id ? 'active' : 'ghost'}`} onClick={() => setSub(id)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {(sub === 'search' || sub === 'free') && (
        <div className="panel">
          <div className="filters">
            <label className="field">
              Nombre
              <input type="text" value={filters.text} placeholder="Buscar…" onChange={(e) => setF({ text: e.target.value })} />
            </label>
            {sub === 'search' && (
              <label className="field">
                Liga
                <select value={filters.leagueId} onChange={(e) => setF({ leagueId: e.target.value })}>
                  <option value="">Todas + libres</option>
                  {world.leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              Posición
              <select value={filters.role} onChange={(e) => setF({ role: e.target.value })}>
                <option value="">Todas</option>
                {ROLE_KEYS.map((r) => (
                  <option key={r} value={r}>
                    {ROLES[r].label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Media mín. {filters.minOvr}
              <input type="range" min={40} max={90} value={filters.minOvr} onChange={(e) => setF({ minOvr: Number(e.target.value) })} />
            </label>
            <label className="field">
              Edad máx. {filters.maxAge}
              <input type="range" min={16} max={40} value={filters.maxAge} onChange={(e) => setF({ maxAge: Number(e.target.value) })} />
            </label>
            <label className="field">
              Valor
              <select value={filters.cap} onChange={(e) => setF({ cap: e.target.value })}>
                {VALUE_CAPS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ResultsTable world={world} rows={rows} budget={budget} onOffer={setOfferFor} onView={(p, team) => setView({ p, team })} />
          {rows.length === 80 && <p className="small muted">Mostrando los 80 mejores. Ajusta los filtros para ver más.</p>}
        </div>
      )}

      {sub === 'offers' && (
        <div className="panel">
          <h3>Ofertas por tus jugadores</h3>
          {!offers.length && <p className="small muted">No hay ofertas. Pon jugadores en venta desde «Mi plantilla» para atraer compradores.</p>}
          {offers.map((o) => {
            const p = user.players.find((x) => x.id === o.playerId)
            const club = world.teams.find((t) => t.id === o.teamId)
            return (
              <div key={o.id} className="row" style={{ marginBottom: 8 }}>
                <Crest team={club} size={24} />
                <span>
                  <b>{club?.name}</b> ofrece <b className="money">{formatMoney(o.fee)}</b> por {p.name} (valor {formatMoney(playerValue(p))})
                </span>
                <span className="small muted">expira tras la jornada {o.expires}</span>
                <span className="spacer" />
                <button className="btn primary sm" disabled={user.players.length <= MIN_SQUAD} onClick={() => update((w) => acceptOffer(w, w.career, o.id))}>
                  Aceptar
                </button>
                <button className="btn ghost sm" onClick={() => update((w) => rejectOffer(w.career, o.id))}>
                  Rechazar
                </button>
              </div>
            )
          })}
        </div>
      )}

      {sub === 'mine' && (
        <div className="panel">
          <h3>Contratos y ventas</h3>
          <p className="small muted" style={{ marginTop: 0 }}>
            Los contratos bajan una temporada cada año. Quien llega a 0 se marcha libre: renueva a tiempo. Poner en venta baja su precio y atrae ofertas.
          </p>
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th className="num">Med</th>
                  <th>Pot.</th>
                  <th className="num">Valor</th>
                  <th className="num">Salario</th>
                  <th className="num">Contr.</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {user.players
                  .slice()
                  .sort((a, b) => (a.contract ?? 0) - (b.contract ?? 0) || overall(b) - overall(a))
                  .map((p) => {
                    const terms = renewalTerms(p)
                    return (
                      <tr key={p.id}>
                        <td>
                          <PlayerLine player={p} team={user} world={world} />
                        </td>
                        <td className="num">
                          <Ovr value={overall(p)} />
                        </td>
                        <td>
                          <Stars value={potentialStars(p)} />
                        </td>
                        <td className="num money small">{formatMoney(playerValue(p))}</td>
                        <td className="num money small">{formatMoney(p.wage)}</td>
                        <td className="num small" style={p.contract <= 1 ? { color: 'var(--warn)', fontWeight: 700 } : undefined}>
                          {p.contract}
                        </td>
                        <td>
                          <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
                            <button
                              className="btn sm ghost"
                              title={`Pide ${formatMoney(terms.wage)}/año, máximo ${terms.maxYears} temporada(s)`}
                              disabled={p.contract >= terms.maxYears}
                              onClick={() => update((w) => renewContract(w, w.career, p.id, terms.maxYears))}
                            >
                              Renovar
                            </button>
                            <button
                              className={`btn sm ${p.listed ? '' : 'ghost'}`}
                              onClick={() =>
                                update((w) => {
                                  const x = w.teams.find((t) => t.id === user.id).players.find((y) => y.id === p.id)
                                  x.listed = !x.listed
                                })
                              }
                            >
                              {p.listed ? 'En venta ✓' : 'Vender'}
                            </button>
                            <button
                              className="btn sm danger"
                              disabled={user.players.length <= MIN_SQUAD}
                              title={`Indemnización: ${formatMoney(releaseCost(p))}`}
                              onClick={() => {
                                if (window.confirm(`¿Liberar a ${p.name}? Cuesta ${formatMoney(releaseCost(p))}.`)) update((w) => releasePlayer(w, w.career, p.id))
                              }}
                            >
                              Liberar
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sub === 'history' && (
        <div className="panel">
          <h3>Movimientos del mundo</h3>
          {!(career.transfers ?? []).length && <p className="small muted">Todavía no hay traspasos.</p>}
          <div className="feed" style={{ maxHeight: 480 }}>
            {(career.transfers ?? [])
              .slice()
              .reverse()
              .slice(0, 120)
              .map((t, i) => {
                const from = world.teams.find((x) => x.id === t.from)
                const to = world.teams.find((x) => x.id === t.to)
                const mine = t.from === user.id || t.to === user.id
                return (
                  <div key={i} className="ev" style={mine ? { fontWeight: 700 } : undefined}>
                    <span className="min small">{t.season}</span>
                    <span>
                      {t.name} ({t.ovr}) · {from?.short ?? 'Libre'} → {to?.short ?? 'Libre'} {t.to && t.fee ? `· ${formatMoney(t.fee)}` : t.to ? '· gratis' : ''}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {offerFor && <OfferModal world={world} career={career} playerId={offerFor} onClose={() => setOfferFor(null)} onDone={onOfferResult} />}
      {view && (
        <PlayerModal
          key={view.p.id}
          player={view.p}
          team={view.team ?? user}
          editable={false}
          onClose={() => setView(null)}
          actions={
            <button
              className="btn primary sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                setOfferFor(view.p.id)
                setView(null)
              }}
            >
              {view.team ? 'Hacer oferta' : 'Fichar'}
            </button>
          }
        />
      )}
    </div>
  )
}
