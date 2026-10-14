import { TACTICAL_ROLES, rolesForSlot, roleSuitability, getRole } from '../game/roles.js'
import { ROLES } from '../game/player.js'
import { Modal } from './Pixel.jsx'

function suitColor(v) {
  return v >= 75 ? 'var(--good)' : v >= 65 ? '#a8e61d' : v >= 55 ? 'var(--accent)' : v >= 45 ? 'var(--warn)' : 'var(--bad)'
}

// Role selector for one formation slot, with the player's suitability for each option.
export default function RolePicker({ slot, value, player, onChange, compact = false }) {
  const keys = rolesForSlot(slot.role)
  const current = getRole(value)
  return (
    <div className="role-picker">
      <div className="row" style={{ gap: 6 }}>
        <span className={`pos ${ROLES[slot.role].line}`}>{slot.label}</span>
        {player && <b>{player.short}</b>}
        {player?.prefRole && <span className="small muted">· prefiere {getRole(player.prefRole).name}</span>}
      </div>
      <div className="role-options">
        {keys.map((k) => {
          const r = TACTICAL_ROLES[k]
          const suit = player ? roleSuitability(player, k) : null
          return (
            <button key={k} className={`role-opt ${k === value ? 'on' : ''}`} onClick={() => onChange(k)} title={r.desc}>
              <span>
                {r.name}
                {player?.prefRole === k && ' ★'}
              </span>
              {suit !== null && (
                <span className="suit" style={{ background: suitColor(suit) }}>
                  {suit}
                </span>
              )}
            </button>
          )
        })}
      </div>
      {!compact && <p className="small" style={{ margin: '6px 0 0' }}>{current.desc}</p>}
    </div>
  )
}

const GROUPS = [
  ['GK', 'Porteros'],
  ['CB', 'Centrales'],
  ['FB', 'Laterales'],
  ['DM', 'Mediocentros defensivos'],
  ['CM', 'Mediocentros'],
  ['AM', 'Mediapuntas'],
  ['W', 'Bandas'],
  ['ST', 'Delanteros'],
]

export function RoleGuide({ onClose }) {
  return (
    <Modal onClose={onClose}>
      <div className="row">
        <h2 style={{ margin: 0 }}>Guía de roles tácticos</h2>
        <span className="spacer" />
        <button className="btn ghost sm" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <p className="small muted">
        La <b>posición</b> dice dónde juega un futbolista; el <b>rol</b> dice qué hace desde ahí. En el partido cambia su colocación, sus
        desmarques, cuánto presiona y qué decisiones toma con el balón.
      </p>
      <div className="grid cols-2">
        {GROUPS.map(([pos, title]) => (
          <div key={pos}>
            <h3>{title}</h3>
            {Object.entries(TACTICAL_ROLES)
              .filter(([, r]) => r.pos === pos)
              .map(([k, r]) => (
                <div key={k} className="small" style={{ marginBottom: 8 }}>
                  <span className="chip px" style={{ fontSize: 8 }}>
                    {r.short}
                  </span>{' '}
                  <b>{r.name}</b>: {r.desc}
                </div>
              ))}
          </div>
        ))}
      </div>
    </Modal>
  )
}
