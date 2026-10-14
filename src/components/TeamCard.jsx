import { teamStrength } from '../game/team.js'
import { Crest, Ovr, PitchSpritePreview } from './Pixel.jsx'
import { bodyOf } from '../pixel/sprites.js'

export default function TeamCard({ team, selected, onClick, children }) {
  return (
    <div className={`panel team-card ${selected ? 'selected' : ''}`} onClick={onClick} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onClick?.()}>
      <Crest team={team} size={64} />
      <div className="px" style={{ fontSize: 12 }}>
        {team.name}
      </div>
      {team.nickname && <div className="small muted">{team.nickname}</div>}
      <div className="row" style={{ justifyContent: 'center' }}>
        <span className="chip">
          Media <Ovr value={teamStrength(team)} />
        </span>
        <span className="chip">{team.players.length} jugadores</span>
      </div>
      <div className="small muted">DT: {team.coach}</div>
      <PitchSpritePreview appearance={(team.players[4] ?? team.players[0]).appearance} kit={team.kits.home} scale={4} body={bodyOf(team.players[4] ?? team.players[0])} />
      {children}
    </div>
  )
}
