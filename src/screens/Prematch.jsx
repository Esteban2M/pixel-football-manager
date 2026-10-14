import { useWorld } from '../state/WorldContext.jsx'
import TacticsBoard from '../components/TacticsBoard.jsx'
import { Crest, Ovr } from '../components/Pixel.jsx'
import { resolveLineup, teamStrength } from '../game/team.js'
import { FORMATIONS, MENTALITY_LABELS, PRESSING_LABELS } from '../game/formations.js'

export default function Prematch({ nav, params }) {
  const { world, update } = useWorld()
  const home = world.teams.find((t) => t.id === params.homeId)
  const away = world.teams.find((t) => t.id === params.awayId)
  if (!home || !away) return null
  const mine = params.userSide === 1 ? away : home
  const rival = params.userSide === 1 ? home : away
  const rivalXI = resolveLineup(rival).map((id) => rival.players.find((p) => p.id === id))

  const onChange = ({ tactics, lineup }) =>
    update((w) => {
      const t = w.teams.find((x) => x.id === mine.id)
      if (tactics) t.tactics = tactics
      if (lineup) t.lineup = lineup
    })

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => nav(params.mode === 'career' ? 'hub' : 'friendly')}>
          ← Volver
        </button>
        <span className="title">Previa del partido</span>
        <button className="btn primary" onClick={() => nav('match', params)}>
          ¡Al campo! ▶
        </button>
      </div>
      <div className="panel scoreboard" style={{ marginBottom: 16 }}>
        <div className="side">
          <Crest team={home} size={40} />
          <div className="tname">{home.name}</div>
        </div>
        <div className="score" style={{ fontSize: 14 }}>
          VS
        </div>
        <div className="side away">
          <div className="tname">{away.name}</div>
          <Crest team={away} size={40} />
        </div>
      </div>
      <div className="grid cols-main">
        <div className="panel">
          <h2>Tu alineación · {mine.name}</h2>
          <TacticsBoard team={mine} onChange={onChange} />
        </div>
        <div className="panel">
          <h2>Informe del rival</h2>
          <div className="row" style={{ marginBottom: 10 }}>
            <Crest team={rival} size={32} />
            <b>{rival.name}</b>
            <span className="spacer" />
            <Ovr value={teamStrength(rival)} />
          </div>
          <p className="small muted" style={{ marginTop: 0 }}>
            {rival.tactics.formation} · Mentalidad {MENTALITY_LABELS[rival.tactics.mentality].toLowerCase()} · Presión{' '}
            {PRESSING_LABELS[rival.tactics.pressing].toLowerCase()} · DT {rival.coach}
          </p>
          <table className="data">
            <tbody>
              {rivalXI.map((p, i) =>
                p ? (
                  <tr key={p.id}>
                    <td className="small muted">{FORMATIONS[rival.tactics.formation][i].label}</td>
                    <td className="num">{p.number}</td>
                    <td>{p.name}</td>
                  </tr>
                ) : null,
              )}
            </tbody>
          </table>
          {rival.players.some((p) => p.injury > 0) && (
            <p className="small">
              🚑 Bajas: {rival.players.filter((p) => p.injury > 0).map((p) => `${p.short} (${p.injuryNote})`).join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
