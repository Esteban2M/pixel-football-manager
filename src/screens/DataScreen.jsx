import { useState } from 'react'
import { useWorld } from '../state/WorldContext.jsx'
import { importData, exportTeam, exportLeague, exportWorld, downloadJson, slugify, EXAMPLE_TEAM, EXAMPLE_LEAGUE, exportFormat } from '../game/io.js'
import { FORMAT_PRESETS } from '../game/formats.js'
import { TACTICAL_ROLES } from '../game/roles.js'
import { FORMATIONS } from '../game/formations.js'
import { ATTRS } from '../game/player.js'
import { LIGA_MX_ROSTERS } from '../data/ligamx-rosters.js'

function Report({ r }) {
  if (!r) return null
  const block = (items, color, icon) =>
    items.map((m, i) => (
      <div key={`${icon}${i}`} className="small" style={{ color }}>
        {icon} {m}
      </div>
    ))
  return (
    <div className="panel" style={{ background: 'var(--bg2)', marginTop: 10 }}>
      {block(r.added, 'var(--good)', '✔')}
      {block(r.info, 'var(--ink)', 'ℹ')}
      {block(r.warnings, 'var(--warn)', '⚠')}
      {block(r.errors, 'var(--bad)', '✖')}
      {!r.added.length && !r.errors.length && <div className="small muted">Nada que importar.</div>}
    </div>
  )
}

export default function DataScreen({ nav }) {
  const { world, update } = useWorld()
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null)
  const [done, setDone] = useState(null)
  const [teamId, setTeamId] = useState(world.teams[0]?.id)
  const [leagueId, setLeagueId] = useState(world.leagues[0]?.id)

  const validate = (src = text) => {
    setDone(null)
    setPreview(importData(structuredClone(world), src))
  }

  const doImport = () => {
    // The updater runs later, so the report shown is computed on a copy with the same input.
    const report = importData(structuredClone(world), text)
    update((w) => {
      importData(w, text)
    })
    setPreview(null)
    setDone(report)
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    setText(content)
    validate(content)
    e.target.value = ''
  }

  const team = world.teams.find((t) => t.id === teamId)
  const league = world.leagues.find((l) => l.id === leagueId)
  const isWorld = (() => {
    try {
      return JSON.parse(text)?.type === 'pfm-world'
    } catch {
      return false
    }
  })()

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => nav('menu')}>
          ← Menú
        </button>
        <span className="title">Importar / exportar (JSON)</span>
      </div>
      <div className="grid cols-main">
        <div className="panel">
          <h2>Importar</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            Carga un archivo <code>.json</code> o pega su contenido. Acepta equipos (<code>pfm-team</code>, <code>pfm-teams</code>), ligas con sus equipos (
            <code>pfm-league</code>), formatos (<code>pfm-format</code>) o un mundo completo (<code>pfm-world</code>). Valida primero para ver qué cambiará.
          </p>
          <div className="row" style={{ marginBottom: 8 }}>
            <label className="btn sm">
              📂 Abrir archivo
              <input type="file" accept=".json,application/json" onChange={onFile} style={{ display: 'none' }} />
            </label>
            <button className="btn ghost sm" onClick={() => setText(JSON.stringify(EXAMPLE_TEAM, null, 2))}>
              Ejemplo: equipo
            </button>
            <button className="btn ghost sm" onClick={() => setText(JSON.stringify(EXAMPLE_LEAGUE, null, 2))}>
              Ejemplo: liga
            </button>
          </div>
          <textarea
            className="json"
            rows={20}
            value={text}
            onChange={(e) => {
              setText(e.target.value)
              setPreview(null)
              setDone(null)
            }}
            placeholder='{ "type": "pfm-team", "team": { "name": "Mi equipo", ... } }'
            spellCheck={false}
            aria-label="JSON a importar"
          />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => validate()} disabled={!text.trim()}>
              Validar
            </button>
            <button className="btn primary" onClick={doImport} disabled={!preview || preview.errors.length > 0 || !preview.added.length}>
              Importar
            </button>
            {isWorld && <span className="small" style={{ color: 'var(--warn)' }}>⚠ Un mundo completo reemplaza todos tus equipos, ligas y la temporada.</span>}
          </div>
          <Report r={preview} />
          {done && (
            <>
              <p className="small" style={{ color: 'var(--good)' }}>
                ¡Importado!
              </p>
              <Report r={done} />
            </>
          )}
        </div>

        <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
          <div className="panel">
            <h2>Exportar</h2>
            <div className="grid" style={{ gap: 10 }}>
              <div className="row">
                <select value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Equipo">
                  {world.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button className="btn sm" disabled={!team} onClick={() => downloadJson(exportTeam(team), `${slugify(team.name)}.team.json`)}>
                  Equipo
                </button>
              </div>
              <div className="row">
                <select value={leagueId} onChange={(e) => setLeagueId(e.target.value)} aria-label="Liga">
                  {world.leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <button className="btn sm" disabled={!league} onClick={() => downloadJson(exportLeague(world, league), `${slugify(league.name)}.league.json`)}>
                  Liga + equipos
                </button>
              </div>
              <button className="btn ghost sm" onClick={() => downloadJson(exportWorld(world), 'pixel-football-world.json')}>
                Mundo completo (copia de seguridad)
              </button>
              <button className="btn ghost sm" onClick={() => downloadJson(LIGA_MX_ROSTERS, 'liga-mx-apertura-2026.teams.json')} title="Plantillas reales de los 16 clubes, en formato pfm-teams">
                Plantillas Liga MX Apertura 2026 (fuente)
              </button>
              <button className="btn ghost sm" onClick={() => setText(JSON.stringify(LIGA_MX_ROSTERS, null, 2))}>
                Ver/editar plantillas Liga MX aquí
              </button>
              <div className="row">
                {Object.entries(FORMAT_PRESETS).map(([k, f]) => (
                  <button key={k} className="btn ghost sm" onClick={() => downloadJson(exportFormat(f, k), `${k}.format.json`)} title={f.description}>
                    {f.name.split(' (')[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="panel small">
            <h2>Referencia rápida</h2>
            <p>
              <b>Posiciones</b> (español o inglés): POR/GK, DFC/CB, LI/LB, LD/RB, MCD/DM, MC/CM, MCO/AM, EI/LW, ED/RW, DC/ST.
            </p>
            <p>
              <b>Atributos</b> (1-20, opcionales; si faltan se generan a partir de <code>rating</code> 1-99 o de la <code>quality</code> del equipo):{' '}
              {ATTRS.map((a) => a.key).join(', ')}.
            </p>
            <p>
              <b>Formaciones</b>: {Object.keys(FORMATIONS).join(', ')}.
            </p>
            <p>
              <b>Roles</b> (<code>role</code> del jugador o <code>tactics.roles</code>): {Object.keys(TACTICAL_ROLES).join(', ')}.
            </p>
            <p>
              <b>Formatos</b> (<code>league.format</code> como texto o como objeto): {Object.keys(FORMAT_PRESETS).join(', ')}.
            </p>
            <p>
              <b>Imágenes</b> (escudo / retrato): <code>{'{ "rows": ["..AA.."], "palette": { "A": "#ff0000" } }'}</code> o <code>{'{ "w", "h", "px": [...] }'}</code>.
            </p>
            <p className="muted">La guía completa del formato está en el README del proyecto.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
