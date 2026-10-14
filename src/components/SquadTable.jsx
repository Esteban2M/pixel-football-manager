import { ROLES, overall } from '../game/player.js'
import { getRole } from '../game/roles.js'
import { Portrait, Ovr, Bar, MoraleIcon } from './Pixel.jsx'

const ORDER = ['GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST']

export default function SquadTable({ team, onSelect }) {
  const players = team.players
    .slice()
    .sort((a, b) => ORDER.indexOf(a.roles[0]) - ORDER.indexOf(b.roles[0]) || overall(b) - overall(a))
  return (
    <div className="table-wrap">
      <table className="data">
        <thead>
          <tr>
            <th className="num">#</th>
            <th>Jugador</th>
            <th>Pos</th>
            <th>Nac</th>
            <th className="num">Edad</th>
            <th className="num">Alt.</th>
            <th>Rol pref.</th>
            <th className="num">Med</th>
            <th>Condición</th>
            <th>Moral</th>
            <th className="num">PJ</th>
            <th className="num">G</th>
            <th className="num">A</th>
            <th className="num">Prom</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id} className="clickable" onClick={() => onSelect?.(p)}>
              <td className="num">{p.number}</td>
              <td>
                <div className="crest-name">
                  <Portrait player={p} team={team} size={24} />
                  <span>{p.name}</span>
                </div>
              </td>
              <td>
                {p.roles.map((r) => (
                  <span key={r} className={`pos ${ROLES[r].line}`} style={{ marginRight: 3 }}>
                    {ROLES[r].label}
                  </span>
                ))}
              </td>
              <td className="small">{p.nationality}</td>
              <td className="num">{p.age}</td>
              <td className="num small">{p.height ? (p.height / 100).toFixed(2) : '—'}</td>
              <td className="small">{p.prefRole ? getRole(p.prefRole).name : '—'}</td>
              <td className="num">
                <Ovr value={overall(p)} />
              </td>
              <td>
                <Bar value={p.condition} />
              </td>
              <td>
                <MoraleIcon value={p.morale} />
              </td>
              <td className="num">{p.stats.apps}</td>
              <td className="num">{p.stats.goals}</td>
              <td className="num">{p.stats.assists}</td>
              <td className="num">{p.stats.apps ? (p.stats.ratingSum / p.stats.apps).toFixed(1) : '—'}</td>
              <td>
                {p.injury > 0 && (
                  <span className="badge" title={p.injuryNote}>
                    LES {p.injury}
                  </span>
                )}
                {p.suspension > 0 && <span className="badge warn">SUSP</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
