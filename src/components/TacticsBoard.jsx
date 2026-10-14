import { useState } from 'react'
import { FORMATIONS, FORMATION_KEYS, MENTALITY_LABELS, PRESSING_LABELS, TEMPO_LABELS, WIDTH_LABELS } from '../game/formations.js'
import { autoLineup, autoRoles, isAvailable, reassignLineup, resolveLineup, resolveRoles, teamStrength } from '../game/team.js'
import { ROLES, overall, ratingInSlot } from '../game/player.js'
import { getRole } from '../game/roles.js'
import { Portrait, Ovr, Bar } from './Pixel.jsx'
import RolePicker, { RoleGuide } from './RolePicker.jsx'

// Maps a formation slot (x: own goal -> opponent goal) onto a vertical board.
export function slotStyle(slot) {
  return { left: `${slot.y * 100}%`, top: `${92 - (slot.x / 0.64) * 80}%` }
}

export function TacticSliders({ tactics, onChange }) {
  const rows = [
    { key: 'mentality', label: 'Mentalidad', min: -2, max: 2, labels: MENTALITY_LABELS },
    { key: 'pressing', label: 'Presión', min: 0, max: 2, labels: PRESSING_LABELS },
    { key: 'tempo', label: 'Ritmo', min: 0, max: 2, labels: TEMPO_LABELS },
    { key: 'width', label: 'Amplitud', min: 0, max: 2, labels: WIDTH_LABELS },
  ]
  return (
    <div>
      {rows.map((r) => (
        <div className="slider-row" key={r.key}>
          <span>{r.label}</span>
          <input
            type="range"
            min={r.min}
            max={r.max}
            step={1}
            value={tactics[r.key]}
            onChange={(e) => onChange({ ...tactics, [r.key]: Number(e.target.value) })}
            aria-label={r.label}
          />
          <span className="val">{r.labels[tactics[r.key]]}</span>
        </div>
      ))}
    </div>
  )
}

export function FormationPicker({ value, onChange }) {
  return (
    <div className="row" style={{ gap: 6 }}>
      {FORMATION_KEYS.map((f) => (
        <button key={f} className={`btn sm ${f === value ? 'active' : 'ghost'}`} onClick={() => onChange(f)}>
          {f}
        </button>
      ))}
    </div>
  )
}

export default function TacticsBoard({ team, onChange }) {
  const [sel, setSel] = useState(null)
  const [guide, setGuide] = useState(false)
  const lineup = resolveLineup(team)
  const roles = resolveRoles(team)
  const setRole = (i, key) => {
    const next = roles.slice()
    next[i] = key
    onChange({ tactics: { ...team.tactics, roles: next } })
  }
  const slots = FORMATIONS[team.tactics.formation]
  const byId = (id) => team.players.find((p) => p.id === id)

  const setLineup = (next) => onChange({ lineup: next })

  const clickSlot = (i) => {
    if (sel?.kind === 'slot' && sel.i !== i) {
      const next = lineup.slice()
      ;[next[i], next[sel.i]] = [next[sel.i], next[i]]
      setLineup(next)
      setSel(null)
    } else if (sel?.kind === 'player') {
      placePlayer(sel.id, i)
    } else setSel(sel?.kind === 'slot' && sel.i === i ? null : { kind: 'slot', i })
  }

  const placePlayer = (id, i) => {
    const p = byId(id)
    if (!p || !isAvailable(p)) return
    const next = lineup.slice()
    const was = next.indexOf(id)
    if (was >= 0) next[was] = next[i]
    next[i] = id
    setLineup(next)
    setSel(null)
  }

  const clickPlayer = (id) => {
    if (sel?.kind === 'slot') placePlayer(id, sel.i)
    else setSel(sel?.kind === 'player' && sel.id === id ? null : { kind: 'player', id })
  }

  const setFormation = (f) => {
    onChange({ tactics: { ...team.tactics, formation: f, roles: null }, lineup: reassignLineup(team, lineup, f) })
    setSel(null)
  }

  const sorted = team.players.slice().sort((a, b) => {
    const order = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST']
    return order.indexOf(a.roles[0]) - order.indexOf(b.roles[0]) || overall(b) - overall(a)
  })

  return (
    <div className="grid cols-2">
      <div className="grid" style={{ gap: 12, alignContent: 'start' }}>
        <div className="row">
          <h3 style={{ margin: 0 }}>Formación</h3>
          <span className="spacer" />
          <span className="chip">
            Media XI <Ovr value={teamStrength(team)} />
          </span>
        </div>
        <FormationPicker value={team.tactics.formation} onChange={setFormation} />
        <div className="board">
          {slots.map((slot, i) => {
            const p = byId(lineup[i])
            const r = p ? ratingInSlot(p, slot.role) : 0
            return (
              <div
                key={i}
                className={`slot ${sel?.kind === 'slot' && sel.i === i ? 'sel' : ''} ${p ? '' : 'empty'}`}
                style={slotStyle(slot)}
                onClick={() => clickSlot(i)}
                title={p ? `${p.name} · ${slot.label} · ${r}` : slot.label}
              >
                {p ? <Portrait player={p} team={team} size={32} /> : <div style={{ width: 32, height: 32, background: '#0008' }} />}
                <span className="tag">
                  <b>{slot.label}</b> {p ? p.short : '—'}
                </span>
                <span className="tag role-tag">{getRole(roles[i]).name}</span>
                {p && <Bar value={p.condition} />}
              </div>
            )
          })}
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          Toca una posición para elegir su <b>rol</b>; después toca otra posición o un jugador de la lista para intercambiarlos.
        </p>
        {sel?.kind === 'slot' ? (
          <div className="panel" style={{ background: 'var(--bg2)' }}>
            <RolePicker slot={slots[sel.i]} value={roles[sel.i]} player={byId(lineup[sel.i])} onChange={(k) => setRole(sel.i, k)} />
          </div>
        ) : (
          <div className="row">
            <button className="btn ghost sm" onClick={() => onChange({ tactics: { ...team.tactics, roles: autoRoles(team, lineup) } })}>
              ★ Roles según preferencias
            </button>
            <button className="btn ghost sm" onClick={() => setGuide(true)}>
              📖 Guía de roles
            </button>
          </div>
        )}
        {guide && <RoleGuide onClose={() => setGuide(false)} />}
        <div>
          <h3>Instrucciones de equipo</h3>
          <TacticSliders tactics={team.tactics} onChange={(t) => onChange({ tactics: t })} />
        </div>
        <div className="row">
          <button className="btn ghost sm" onClick={() => setLineup(autoLineup(team))}>
            Alineación automática
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>#</th>
              <th>Jugador</th>
              <th>Pos</th>
              <th className="num">Med</th>
              <th>Físico</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const inXI = lineup.includes(p.id)
              const selected = sel?.kind === 'player' && sel.id === p.id
              return (
                <tr key={p.id} className={`clickable ${inXI ? 'me' : ''}`} onClick={() => clickPlayer(p.id)} style={selected ? { outline: '2px solid var(--accent)' } : undefined}>
                  <td className="num">{p.number}</td>
                  <td>
                    <div className="crest-name">
                      <Portrait player={p} team={team} size={16} />
                      <span>{p.short}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`pos ${ROLES[p.roles[0]].line}`}>{ROLES[p.roles[0]].label}</span>
                  </td>
                  <td className="num">
                    <Ovr value={overall(p)} />
                  </td>
                  <td>
                    <Bar value={p.condition} />
                  </td>
                  <td>
                    {p.injury > 0 && <span className="badge">LES {p.injury}</span>}
                    {p.suspension > 0 && <span className="badge warn">SUSP</span>}
                    {inXI && !p.injury && !p.suspension && <span className="muted small">XI</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
