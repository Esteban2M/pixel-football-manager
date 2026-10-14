import { useState } from 'react'
import { useWorld } from '../state/WorldContext.jsx'
import { KIT_PATTERNS } from '../pixel/palette.js'
import { Crest, Modal, PitchSpritePreview } from '../components/Pixel.jsx'
import PixelEditor from '../components/PixelEditor.jsx'
import PlayerModal from '../components/PlayerModal.jsx'
import SquadTable from '../components/SquadTable.jsx'
import { randomPlayer, generateSquad } from '../game/generate.js'
import { ROLES, ROLE_KEYS } from '../game/player.js'
import { createBaseTeams } from '../data/teams.js'
import { exportTeam, downloadJson, slugify } from '../game/io.js'

function KitEditor({ kit, onChange, label }) {
  const set = (patch) => onChange({ ...kit, ...patch })
  return (
    <div className="panel" style={{ background: 'var(--bg2)' }}>
      <h3>{label}</h3>
      <div className="row" style={{ alignItems: 'end' }}>
        {[
          ['shirt', 'Camiseta'],
          ['trim', 'Detalle'],
          ['shorts', 'Short'],
          ['socks', 'Medias'],
        ].map(([k, l]) => (
          <label key={k} className="field">
            {l}
            <input type="color" value={kit[k]} onChange={(e) => set({ [k]: e.target.value })} />
          </label>
        ))}
        <label className="field">
          Diseño
          <select value={kit.pattern} onChange={(e) => set({ pattern: Number(e.target.value) })}>
            {KIT_PATTERNS.map((p, i) => (
              <option key={p} value={i}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}

export default function TeamEditor({ nav, params }) {
  const { world, update } = useWorld()
  const team = world.teams.find((t) => t.id === params.teamId)
  const [player, setPlayer] = useState(null)
  const [crestEdit, setCrestEdit] = useState(false)
  const [newRole, setNewRole] = useState('CM')
  const [confirmDel, setConfirmDel] = useState(false)
  if (!team) return null

  const inCareer = world.career && !world.career.finished
  const patch = (fn) =>
    update((w) => {
      fn(w.teams.find((t) => t.id === team.id), w)
    })

  const savePlayer = (draft) => {
    patch((t) => {
      const i = t.players.findIndex((p) => p.id === draft.id)
      if (i >= 0) t.players[i] = draft
      else t.players.push(draft)
    })
    setPlayer(null)
  }

  const deletePlayer = (id) => {
    patch((t) => {
      t.players = t.players.filter((p) => p.id !== id)
      if (t.lineup) t.lineup = t.lineup.map((x) => (x === id ? null : x))
    })
    setPlayer(null)
  }

  const addPlayer = () => {
    const p = randomPlayer(newRole, 12, Math.random(), new Set(team.players.map((x) => x.number)))
    setPlayer(p)
  }

  const deleteTeam = () => {
    update((w) => {
      w.teams = w.teams.filter((t) => t.id !== team.id)
      for (const l of w.leagues ?? []) l.teamIds = l.teamIds.filter((id) => id !== team.id)
      w.leagues = (w.leagues ?? []).filter((l) => l.teamIds.length >= 2)
      if (w.career && w.career.competition?.teamIds.includes(team.id)) w.career = null
    })
    nav('teams')
  }

  const restoreBase = () => {
    const base = createBaseTeams().find((t) => t.id === team.id)
    if (base) patch((t) => Object.assign(t, base))
  }

  const sampleLook = team.players.find((p) => !p.roles.includes('GK'))?.appearance ?? team.players[0]?.appearance

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => nav('teams')}>
          ← Equipos
        </button>
        <Crest team={team} size={32} />
        <span className="title">{team.name}</span>
        <button className="btn ghost sm" onClick={() => downloadJson(exportTeam(team), `${slugify(team.name)}.team.json`)}>
          Exportar JSON
        </button>
      </div>

      <div className="grid cols-main">
        <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
          <div className="panel">
            <h2>Datos del club</h2>
            <div className="grid cols-2" style={{ gap: 10 }}>
              <label className="field">
                Nombre
                <input type="text" value={team.name} maxLength={24} onChange={(e) => patch((t) => (t.name = e.target.value))} />
              </label>
              <label className="field">
                Siglas
                <input type="text" value={team.short} maxLength={3} onChange={(e) => patch((t) => (t.short = e.target.value.toUpperCase()))} />
              </label>
              <label className="field">
                Apodo
                <input type="text" value={team.nickname} maxLength={32} onChange={(e) => patch((t) => (t.nickname = e.target.value))} />
              </label>
              <label className="field">
                Director técnico
                <input type="text" value={team.coach} maxLength={32} onChange={(e) => patch((t) => (t.coach = e.target.value))} />
              </label>
            </div>
          </div>
          <div className="panel">
            <div className="row" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Plantilla ({team.players.length})</h2>
              <span className="spacer" />
              <select value={newRole} onChange={(e) => setNewRole(e.target.value)} aria-label="Posición del nuevo jugador">
                {ROLE_KEYS.map((r) => (
                  <option key={r} value={r}>
                    {ROLES[r].label}
                  </option>
                ))}
              </select>
              <button className="btn sm" onClick={addPlayer}>
                + Crear jugador
              </button>
            </div>
            <SquadTable team={team} onSelect={setPlayer} />
            {team.custom && (
              <div className="row" style={{ marginTop: 10 }}>
                <button
                  className="btn ghost sm"
                  onClick={() =>
                    patch((t) => {
                      t.players = generateSquad(12, Math.random())
                      t.lineup = null
                    })
                  }
                >
                  🎲 Regenerar plantilla
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
          <div className="panel" style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
            <h2 style={{ justifySelf: 'start' }}>Escudo</h2>
            <Crest team={team} size={128} />
            <button className="btn primary sm" onClick={() => setCrestEdit(true)}>
              🎨 Editar escudo
            </button>
          </div>
          <div className="panel">
            <h2>Uniformes</h2>
            <div className="row" style={{ justifyContent: 'center', gap: 24, marginBottom: 10 }}>
              <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
                <PitchSpritePreview appearance={sampleLook} kit={team.kits.home} scale={5} />
                <span className="small muted">Local</span>
              </div>
              <div style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
                <PitchSpritePreview appearance={sampleLook} kit={team.kits.away} scale={5} />
                <span className="small muted">Visita</span>
              </div>
            </div>
            <div className="grid" style={{ gap: 10 }}>
              <KitEditor label="Uniforme local" kit={team.kits.home} onChange={(k) => patch((t) => (t.kits.home = k))} />
              <KitEditor label="Uniforme de visita" kit={team.kits.away} onChange={(k) => patch((t) => (t.kits.away = k))} />
              <label className="field row">
                Portero
                <input type="color" value={team.kits.gk} onChange={(e) => patch((t) => (t.kits.gk = e.target.value))} />
              </label>
            </div>
          </div>
          <div className="panel">
            <h3>Zona peligrosa</h3>
            {!team.custom && (
              <button className="btn ghost sm" onClick={restoreBase} style={{ marginBottom: 8 }}>
                Restaurar plantilla original
              </button>
            )}
            {inCareer && <p className="small muted">Hay una temporada en curso: los cambios se aplican desde el próximo partido.</p>}
            {team.custom &&
              (confirmDel ? (
                <div className="row">
                  <span className="small">¿Eliminar {team.name}?</span>
                  <button className="btn danger sm" onClick={deleteTeam}>
                    Sí
                  </button>
                  <button className="btn ghost sm" onClick={() => setConfirmDel(false)}>
                    No
                  </button>
                </div>
              ) : (
                <button className="btn danger sm" onClick={() => setConfirmDel(true)}>
                  Eliminar equipo
                </button>
              ))}
          </div>
        </div>
      </div>

      {crestEdit && (
        <Modal onClose={() => setCrestEdit(false)}>
          <PixelEditor
            title={`Escudo de ${team.name}`}
            initial={team.crest}
            saveLabel="Guardar escudo"
            onCancel={() => setCrestEdit(false)}
            onSave={(g) => {
              patch((t) => (t.crest = g))
              setCrestEdit(false)
            }}
          />
        </Modal>
      )}
      {player && (
        <PlayerModal
          player={player}
          team={team}
          onClose={() => setPlayer(null)}
          onSave={savePlayer}
          onDelete={team.players.some((p) => p.id === player.id) && team.players.length > 11 ? deletePlayer : undefined}
        />
      )}
    </div>
  )
}
