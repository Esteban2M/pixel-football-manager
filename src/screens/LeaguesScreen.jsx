import { useMemo, useState } from 'react'
import { useWorld } from '../state/WorldContext.jsx'
import { FORMAT_PRESETS, TIEBREAKER_LABELS, normalizeFormat } from '../game/formats.js'
import { dryRun } from '../game/competition.js'
import { exportLeague, exportFormat, downloadJson, slugify } from '../game/io.js'
import { newId } from '../game/player.js'
import { Crest } from '../components/Pixel.jsx'
import { LeagueCard } from './TeamSelect.jsx'

export default function LeaguesScreen({ nav }) {
  const { world, update } = useWorld()
  const [confirm, setConfirm] = useState(null)
  return (
    <div className="app">
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => nav('menu')}>
          ← Menú
        </button>
        <span className="title">Ligas y torneos</span>
        <button className="btn ghost sm" onClick={() => nav('data')}>
          Importar / exportar JSON
        </button>
        <button className="btn primary sm" onClick={() => nav('leagueEdit', { leagueId: null })}>
          + Nueva liga
        </button>
      </div>
      <div className="grid cols-3">
        {world.leagues.map((l) => (
          <LeagueCard key={l.id} world={world} league={l}>
            <div className="row" style={{ justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
              <button className="btn sm" onClick={() => nav('leagueEdit', { leagueId: l.id })}>
                Editar
              </button>
              <button className="btn ghost sm" onClick={() => downloadJson(exportLeague(world, l), `${slugify(l.name)}.league.json`)}>
                Exportar
              </button>
              <button
                className="btn ghost sm"
                onClick={() =>
                  update((w) => {
                    const copy = structuredClone(l)
                    copy.id = newId('league')
                    copy.name = `${l.name} (copia)`
                    copy.builtIn = false
                    w.leagues.push(copy)
                  })
                }
              >
                Duplicar
              </button>
              {confirm === l.id ? (
                <>
                  <button
                    className="btn danger sm"
                    onClick={() => {
                      update((w) => {
                        w.leagues = w.leagues.filter((x) => x.id !== l.id)
                        if (w.career?.leagueId === l.id) w.career = null
                      })
                      setConfirm(null)
                    }}
                  >
                    ¿Seguro?
                  </button>
                  <button className="btn ghost sm" onClick={() => setConfirm(null)}>
                    No
                  </button>
                </>
              ) : (
                <button className="btn danger sm" onClick={() => setConfirm(l.id)}>
                  Borrar
                </button>
              )}
            </div>
          </LeagueCard>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 16 }}>
        <h2>Formatos incluidos</h2>
        <div className="grid cols-2">
          {Object.entries(FORMAT_PRESETS).map(([k, f]) => (
            <div key={k} className="small">
              <b>{f.name}</b> <span className="muted">({k})</span>
              <div className="muted">{f.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const QUALIFY_MODES = [
  ['all', 'Todos los equipos'],
  ['top', 'Los N mejores'],
  ['perGroup', 'N mejores por grupo'],
  ['range', 'Del puesto X al Y'],
]

function StageEditor({ stage, index, onChange, onRemove, onMove }) {
  const set = (patch) => onChange({ ...stage, ...patch })
  const q = stage.qualify ?? null
  const qMode = !q ? 'all' : q.top ? 'top' : q.perGroup ? 'perGroup' : 'range'
  const num = (label, key, min, max, value = stage[key]) => (
    <label className="field">
      {label}
      <input type="number" min={min} max={max} value={value ?? ''} onChange={(e) => set({ [key]: Number(e.target.value) })} />
    </label>
  )
  const select = (label, key, options, value = stage[key]) => (
    <label className="field">
      {label}
      <select value={value ?? ''} onChange={(e) => set({ [key]: e.target.value || undefined })}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
  const tieOpts = [
    ['single', 'Partido único'],
    ['double', 'Ida y vuelta'],
    ['bo3', 'Mejor de 3'],
  ]
  const breakOpts = [
    ['seed', 'Avanza el mejor sembrado'],
    ['penalties', 'Penales'],
    ['awayGoals', 'Gol de visitante, luego penales'],
  ]
  return (
    <div className="panel" style={{ background: 'var(--bg2)' }}>
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="chip px" style={{ fontSize: 8 }}>
          FASE {index + 1}
        </span>
        <input type="text" value={stage.name} onChange={(e) => set({ name: e.target.value })} aria-label="Nombre de la fase" />
        <select value={stage.type} onChange={(e) => set({ type: e.target.value })} aria-label="Tipo de fase">
          <option value="league">Liga (todos contra todos)</option>
          <option value="swiss">Sistema suizo</option>
          <option value="knockout">Eliminatoria</option>
        </select>
        <span className="spacer" />
        <button className="btn ghost sm" onClick={() => onMove(-1)} disabled={index === 0}>
          ↑
        </button>
        <button className="btn ghost sm" onClick={() => onMove(1)}>
          ↓
        </button>
        <button className="btn danger sm" onClick={onRemove}>
          ✕
        </button>
      </div>
      <div className="grid cols-3" style={{ gap: 8 }}>
        {index > 0 && (
          <label className="field">
            Clasifican
            <select
              value={qMode}
              onChange={(e) => {
                const m = e.target.value
                set({ qualify: m === 'all' ? undefined : m === 'top' ? { top: 8 } : m === 'perGroup' ? { perGroup: 2 } : { from: 1, to: 8 } })
              }}
            >
              {QUALIFY_MODES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        )}
        {qMode === 'top' && (
          <label className="field">
            N
            <input type="number" min={2} max={256} value={q.top} onChange={(e) => set({ qualify: { top: Number(e.target.value) } })} />
          </label>
        )}
        {qMode === 'perGroup' && (
          <label className="field">
            N por grupo
            <input type="number" min={1} max={64} value={q.perGroup} onChange={(e) => set({ qualify: { perGroup: Number(e.target.value) } })} />
          </label>
        )}
        {qMode === 'range' && (
          <label className="field">
            Del / al
            <div className="row" style={{ flexWrap: 'nowrap', gap: 4 }}>
              <input type="number" min={1} value={q.from} onChange={(e) => set({ qualify: { ...q, from: Number(e.target.value) } })} />
              <input type="number" min={1} value={q.to} onChange={(e) => set({ qualify: { ...q, to: Number(e.target.value) } })} />
            </div>
          </label>
        )}
        {stage.type === 'league' && (
          <>
            {num('Vueltas (1-4)', 'rounds', 1, 4)}
            {!stage.split && num('Grupos', 'groups', 1, 32, stage.groups ?? 1)}
            <label className="field">
              <span>
                <input type="checkbox" checked={!!stage.carryPoints} onChange={(e) => set({ carryPoints: e.target.checked })} /> Arrastrar puntos
              </span>
              <span>
                <input type="checkbox" checked={!!stage.halvePoints} onChange={(e) => set({ halvePoints: e.target.checked })} /> …a la mitad
              </span>
            </label>
            {stage.split && <div className="small muted">Split: {stage.split.map((g) => g.name).join(' / ')} (edítalo en JSON)</div>}
          </>
        )}
        {stage.type === 'swiss' && num('Partidos por equipo', 'matches', 1, 30)}
        {stage.type === 'knockout' && (
          <>
            {select('Cruces', 'ties', tieOpts)}
            {select('Primera ronda', 'firstRoundTies', [['', 'Igual que el resto'], ...tieOpts], stage.firstRoundTies ?? '')}
            {select('Final', 'finalTies', tieOpts, stage.finalTies ?? stage.ties)}
            {select('Empate global', 'tieBreak', breakOpts)}
            {select('Empate en la final', 'finalTieBreak', breakOpts.filter(([v]) => v !== 'seed'), stage.finalTieBreak ?? 'penalties')}
            <label className="field">
              <span>
                <input type="checkbox" checked={stage.reseed !== false} onChange={(e) => set({ reseed: e.target.checked })} /> Reordenar cruces cada ronda (mejor vs peor)
              </span>
            </label>
          </>
        )}
      </div>
    </div>
  )
}

export function LeagueEditor({ nav, params }) {
  const { world, update } = useWorld()
  const existing = world.leagues.find((l) => l.id === params.leagueId)
  const [league, setLeague] = useState(() =>
    existing ? structuredClone(existing) : { id: null, name: 'Mi liga', format: structuredClone(FORMAT_PRESETS['liga-mx']), teamIds: world.teams.slice(0, 8).map((t) => t.id), sim: 'quick' },
  )
  const [jsonText, setJsonText] = useState(null)
  const [jsonErrors, setJsonErrors] = useState([])
  const formatKey = JSON.stringify(league.format)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const { format, errors } = useMemo(() => normalizeFormat(league.format), [formatKey])
  const preview = useMemo(() => {
    if (!format || league.teamIds.length < 2) return null
    try {
      return dryRun(format, league.teamIds.length)
    } catch (e) {
      return { error: e.message }
    }
  }, [format, league.teamIds.length])
  const setFormat = (patch) => setLeague((l) => ({ ...l, format: { ...l.format, ...patch } }))
  const stages = league.format.stages ?? []
  const setStage = (i, st) => setFormat({ stages: stages.map((s, k) => (k === i ? st : s)) })
  const presets = [...Object.entries(FORMAT_PRESETS).map(([k, f]) => [k, f]), ...(world.formats ?? []).map((f) => [f.id, f])]
  const toggleTeam = (id) =>
    setLeague((l) => ({ ...l, teamIds: l.teamIds.includes(id) ? l.teamIds.filter((x) => x !== id) : [...l.teamIds, id] }))

  const save = () => {
    update((w) => {
      const l = { ...league, format, id: league.id ?? newId('league') }
      const i = w.leagues.findIndex((x) => x.id === l.id)
      if (i >= 0) w.leagues[i] = l
      else w.leagues.push(l)
    })
    nav('leagues')
  }

  return (
    <div className="app">
      <div className="topbar">
        <button className="btn ghost sm" onClick={() => nav('leagues')}>
          ← Ligas
        </button>
        <span className="title">{existing ? 'Editar liga' : 'Nueva liga'}</span>
        <button className="btn primary" disabled={!format || errors.length > 0 || league.teamIds.length < 2 || !league.name.trim()} onClick={save}>
          Guardar
        </button>
      </div>
      <div className="grid cols-main">
        <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
          <div className="panel">
            <div className="grid cols-2" style={{ gap: 10 }}>
              <label className="field">
                Nombre
                <input type="text" value={league.name} onChange={(e) => setLeague({ ...league, name: e.target.value })} />
              </label>
              <label className="field">
                Partidos que no juegas
                <select value={league.sim} onChange={(e) => setLeague({ ...league, sim: e.target.value })}>
                  <option value="quick">Simulación rápida (estadística)</option>
                  <option value="engine">Motor completo (más lento, más realista)</option>
                </select>
              </label>
            </div>
          </div>
          <div className="panel">
            <div className="row" style={{ marginBottom: 10 }}>
              <h2 style={{ margin: 0 }}>Formato</h2>
              <span className="spacer" />
              <select
                value=""
                onChange={(e) => {
                  const f = presets.find(([k]) => k === e.target.value)?.[1]
                  if (f) setLeague({ ...league, format: structuredClone(f) })
                }}
                aria-label="Cargar formato"
              >
                <option value="">Cargar formato…</option>
                {presets.map(([k, f]) => (
                  <option key={k} value={k}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid cols-3" style={{ gap: 8, marginBottom: 10 }}>
              <label className="field">
                Nombre del formato
                <input type="text" value={league.format.name ?? ''} onChange={(e) => setFormat({ name: e.target.value })} />
              </label>
              {['win', 'draw', 'loss'].map((k) => (
                <label key={k} className="field">
                  Puntos por {k === 'win' ? 'victoria' : k === 'draw' ? 'empate' : 'derrota'}
                  <input type="number" value={league.format.points?.[k] ?? 0} onChange={(e) => setFormat({ points: { ...league.format.points, [k]: Number(e.target.value) } })} />
                </label>
              ))}
            </div>
            <h3>Criterios de desempate (en orden)</h3>
            <div className="row" style={{ marginBottom: 12 }}>
              {Object.entries(TIEBREAKER_LABELS).map(([k, label]) => {
                const tbs = league.format.tiebreakers ?? []
                const i = tbs.indexOf(k)
                return (
                  <button
                    key={k}
                    className={`btn sm ${i >= 0 ? 'active' : 'ghost'}`}
                    onClick={() => setFormat({ tiebreakers: i >= 0 ? tbs.filter((x) => x !== k) : [...tbs, k] })}
                    title="Clic para activar/desactivar; el orden es el de activación"
                  >
                    {i >= 0 ? `${i + 1}. ` : ''}
                    {label}
                  </button>
                )
              })}
            </div>
            <div className="grid" style={{ gap: 10 }}>
              {stages.map((st, i) => (
                <StageEditor
                  key={i}
                  stage={st}
                  index={i}
                  onChange={(s) => setStage(i, s)}
                  onRemove={() => setFormat({ stages: stages.filter((_, k) => k !== i) })}
                  onMove={(d) => {
                    const j = i + d
                    if (j < 0 || j >= stages.length) return
                    const next = stages.slice()
                    ;[next[i], next[j]] = [next[j], next[i]]
                    setFormat({ stages: next })
                  }}
                />
              ))}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn ghost sm" onClick={() => setFormat({ stages: [...stages, { type: 'league', name: `Fase ${stages.length + 1}`, rounds: 1 }] })}>
                + Fase de liga
              </button>
              <button className="btn ghost sm" onClick={() => setFormat({ stages: [...stages, { type: 'knockout', name: 'Eliminatoria', qualify: stages.length ? { top: 8 } : undefined, ties: 'single', tieBreak: 'penalties', reseed: true }] })}>
                + Eliminatoria
              </button>
              <button className="btn ghost sm" onClick={() => setFormat({ stages: [...stages, { type: 'swiss', name: 'Fase suiza', matches: 8 }] })}>
                + Sistema suizo
              </button>
              <span className="spacer" />
              <button className="btn ghost sm" onClick={() => setJsonText(JSON.stringify(league.format, null, 2))}>
                {'{ }'} Editar JSON
              </button>
              <button
                className="btn ghost sm"
                onClick={() => {
                  update((w) => {
                    w.formats ??= []
                    const id = slugify(format.name)
                    w.formats = w.formats.filter((f) => f.id !== id).concat([{ id, ...format }])
                  })
                }}
                disabled={!format}
              >
                Guardar formato
              </button>
              <button className="btn ghost sm" disabled={!format} onClick={() => downloadJson(exportFormat(format, slugify(format.name)), `${slugify(format.name)}.format.json`)}>
                Exportar formato
              </button>
            </div>
            {jsonText !== null && (
              <div style={{ marginTop: 10 }}>
                <textarea className="json" value={jsonText} onChange={(e) => setJsonText(e.target.value)} rows={18} spellCheck={false} aria-label="Formato en JSON" />
                {jsonErrors.map((e) => (
                  <div key={e} className="small" style={{ color: 'var(--bad)' }}>
                    {e}
                  </div>
                ))}
                <div className="row">
                  <button
                    className="btn sm"
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(jsonText)
                        const r = normalizeFormat(parsed)
                        setJsonErrors(r.errors)
                        if (r.format && !r.errors.length) {
                          setLeague({ ...league, format: parsed })
                          setJsonText(null)
                        }
                      } catch (e) {
                        setJsonErrors([`JSON inválido: ${e.message}`])
                      }
                    }}
                  >
                    Aplicar JSON
                  </button>
                  <button className="btn ghost sm" onClick={() => setJsonText(null)}>
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="grid" style={{ gap: 16, alignContent: 'start' }}>
          <div className="panel">
            <h2>Vista previa</h2>
            {errors.map((e) => (
              <div key={e} className="small" style={{ color: 'var(--bad)' }}>
                ⚠ {e}
              </div>
            ))}
            {league.teamIds.length < 2 && <p className="small" style={{ color: 'var(--bad)' }}>Elige al menos 2 equipos.</p>}
            {preview && !preview.error && (
              <>
                <p className="small">
                  Con <b>{league.teamIds.length}</b> equipos: <b>{preview.matchdays}</b> fechas y <b>{preview.matches}</b> partidos.
                </p>
                <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
                  {preview.stages.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ol>
              </>
            )}
            {preview?.error && <p className="small" style={{ color: 'var(--bad)' }}>{preview.error}</p>}
          </div>
          <div className="panel">
            <div className="row" style={{ marginBottom: 8 }}>
              <h2 style={{ margin: 0 }}>Equipos ({league.teamIds.length})</h2>
              <span className="spacer" />
              <button className="btn ghost sm" onClick={() => setLeague({ ...league, teamIds: world.teams.map((t) => t.id) })}>
                Todos
              </button>
              <button className="btn ghost sm" onClick={() => setLeague({ ...league, teamIds: [] })}>
                Ninguno
              </button>
            </div>
            <p className="small muted" style={{ marginTop: 0 }}>
              El orden de selección define la siembra inicial (grupos y copas).
            </p>
            <div className="team-grid small-grid">
              {world.teams.map((t) => {
                const i = league.teamIds.indexOf(t.id)
                return (
                  <button key={t.id} className={`team-pick ${i >= 0 ? 'on' : ''}`} onClick={() => toggleTeam(t.id)}>
                    <Crest team={t} size={24} />
                    <span>{t.name}</span>
                    {i >= 0 && <span className="small">#{i + 1}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
