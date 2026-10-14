import { useState } from 'react'
import { ATTRS, ROLES, ROLE_KEYS, overall, roleRating, randomAppearance } from '../game/player.js'
import { SKIN_TONES, HAIR_COLORS, HAIR_STYLES, BEARD_STYLES } from '../pixel/palette.js'
import { NATIONALITIES } from '../data/names.js'
import { Modal, PixelCanvas, PitchSpritePreview, Ovr, Bar, playerPortraitGrid } from './Pixel.jsx'
import PixelEditor from './PixelEditor.jsx'
import { bodyOf } from '../pixel/sprites.js'
import { TACTICAL_ROLES, rolesForSlot, roleSuitability } from '../game/roles.js'

export default function PlayerModal({ player, team, onSave, onDelete, onClose, editable = true }) {
  const [draft, setDraft] = useState(() => structuredClone(player))
  const [drawing, setDrawing] = useState(false)
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  const setLook = (patch) => setDraft((d) => ({ ...d, appearance: { ...d.appearance, ...patch } }))
  const setAttr = (k, v) => setDraft((d) => ({ ...d, attrs: { ...d.attrs, [k]: v } }))
  const kit = team.kits.home
  const portrait = playerPortraitGrid(draft, team)

  if (drawing) {
    return (
      <Modal onClose={() => setDrawing(false)}>
        <PixelEditor
          title={`Retrato de ${draft.short}`}
          initial={portrait}
          saveLabel="Usar retrato"
          onCancel={() => setDrawing(false)}
          onSave={(g) => {
            set({ portrait: g })
            setDrawing(false)
          }}
        />
      </Modal>
    )
  }

  const avg = draft.stats.apps ? (draft.stats.ratingSum / draft.stats.apps).toFixed(2) : '—'
  const line = ROLES[draft.roles[0]].line

  return (
    <Modal onClose={onClose}>
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>
          #{draft.number} {draft.name}
        </h2>
        <span className="spacer" />
        <Ovr value={overall(draft)} />
        <button className="btn ghost sm" onClick={onClose}>
          Cerrar
        </button>
      </div>
      <div className="grid cols-main">
        <div className="grid" style={{ gap: 14, alignContent: 'start' }}>
          <div className="grid cols-2" style={{ gap: 12 }}>
            <label className="field">
              Nombre
              <input type="text" value={draft.name} disabled={!editable} onChange={(e) => set({ name: e.target.value })} />
            </label>
            <label className="field">
              Nombre corto
              <input type="text" value={draft.short} disabled={!editable} onChange={(e) => set({ short: e.target.value })} />
            </label>
            <label className="field">
              Dorsal
              <input type="number" min={1} max={99} value={draft.number} disabled={!editable} onChange={(e) => set({ number: Number(e.target.value) || 1 })} />
            </label>
            <label className="field">
              Edad
              <input type="number" min={15} max={45} value={draft.age} disabled={!editable} onChange={(e) => set({ age: Number(e.target.value) || 18 })} />
            </label>
            <label className="field">
              Estatura (cm)
              <input type="number" min={155} max={205} value={draft.height ?? 178} disabled={!editable} onChange={(e) => set({ height: Number(e.target.value) || 178 })} />
            </label>
            <label className="field">
              Rol preferido
              <select value={draft.prefRole ?? ''} disabled={!editable} onChange={(e) => set({ prefRole: e.target.value || null })}>
                <option value="">—</option>
                {[...new Set(draft.roles.flatMap((r) => rolesForSlot(r)))].map((k) => (
                  <option key={k} value={k}>
                    {TACTICAL_ROLES[k].name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Nacionalidad
              <select value={draft.nationality} disabled={!editable} onChange={(e) => set({ nationality: e.target.value })}>
                {[...new Set([draft.nationality, ...NATIONALITIES])].map((n) => (
                  <option key={n}>{n}</option>
                ))}
              </select>
            </label>
            <label className="field">
              Posición principal / secundaria
              <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
                <select
                  value={draft.roles[0]}
                  disabled={!editable}
                  onChange={(e) => set({ roles: [e.target.value, ...draft.roles.slice(1).filter((r) => r !== e.target.value)] })}
                >
                  {ROLE_KEYS.map((r) => (
                    <option key={r} value={r}>
                      {ROLES[r].label}
                    </option>
                  ))}
                </select>
                <select
                  value={draft.roles[1] ?? ''}
                  disabled={!editable}
                  onChange={(e) => set({ roles: e.target.value ? [draft.roles[0], e.target.value] : [draft.roles[0]] })}
                >
                  <option value="">—</option>
                  {ROLE_KEYS.filter((r) => r !== draft.roles[0]).map((r) => (
                    <option key={r} value={r}>
                      {ROLES[r].label}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div>
            <h3>Atributos (1-20)</h3>
            <div className="attr-grid">
              {ATTRS.map((a) => (
                <label key={a.key} className="attr">
                  <span>{a.label}</span>
                  <span className="n" style={{ color: draft.attrs[a.key] >= 15 ? 'var(--good)' : draft.attrs[a.key] <= 7 ? 'var(--bad)' : 'var(--ink)' }}>
                    {draft.attrs[a.key]}
                  </span>
                  {editable && (
                    <input type="range" min={1} max={20} value={draft.attrs[a.key]} onChange={(e) => setAttr(a.key, Number(e.target.value))} style={{ gridColumn: '1 / -1' }} aria-label={a.label} />
                  )}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3>Idoneidad por rol</h3>
            <div className="row" style={{ gap: 6 }}>
              {[...new Set(draft.roles.flatMap((r) => rolesForSlot(r)))].map((k) => (
                <span key={k} className="chip" title={TACTICAL_ROLES[k].desc}>
                  {TACTICAL_ROLES[k].name}
                  {draft.prefRole === k && ' ★'} <b>{roleSuitability(draft, k)}</b>
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3>Media por posición</h3>
            <div className="row" style={{ gap: 6 }}>
              {ROLE_KEYS.map((r) => (
                <span key={r} className="chip">
                  <span className={`pos ${ROLES[r].line}`}>{ROLES[r].label}</span> {roleRating(draft.attrs, r)}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="grid" style={{ gap: 14, alignContent: 'start' }}>
          <div className="panel" style={{ background: 'var(--bg2)', display: 'grid', justifyItems: 'center', gap: 10 }}>
            <PixelCanvas grid={portrait} scale={8} />
            <PitchSpritePreview appearance={draft.appearance} kit={kit} gk={line === 'GK'} body={bodyOf(draft)} />
            {editable && (
              <div className="row" style={{ justifyContent: 'center' }}>
                <button className="btn primary sm" onClick={() => setDrawing(true)}>
                  🎨 Dibujar retrato
                </button>
                {draft.portrait && (
                  <button className="btn ghost sm" onClick={() => set({ portrait: null })}>
                    Usar generado
                  </button>
                )}
              </div>
            )}
          </div>

          {editable && (
            <div>
              <h3>Apariencia</h3>
              <div className="grid" style={{ gap: 8 }}>
                <div className="row" style={{ gap: 4 }}>
                  <span className="small muted" style={{ width: 64 }}>
                    Piel
                  </span>
                  {SKIN_TONES.map((s, i) => (
                    <button key={i} className={`swatch ${draft.appearance.skin === i ? 'on' : ''}`} style={{ background: s.base }} onClick={() => setLook({ skin: i })} aria-label={`Piel ${i + 1}`} />
                  ))}
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <span className="small muted" style={{ width: 64 }}>
                    Pelo
                  </span>
                  {HAIR_COLORS.map((h, i) => (
                    <button key={i} className={`swatch ${draft.appearance.hairColor === i ? 'on' : ''}`} style={{ background: h.base }} onClick={() => setLook({ hairColor: i })} aria-label={h.name} title={h.name} />
                  ))}
                </div>
                <label className="field">
                  Peinado
                  <select value={draft.appearance.hair} onChange={(e) => setLook({ hair: Number(e.target.value) })}>
                    {HAIR_STYLES.map((h, i) => (
                      <option key={h} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  Barba
                  <select value={draft.appearance.beard} onChange={(e) => setLook({ beard: Number(e.target.value) })}>
                    {BEARD_STYLES.map((h, i) => (
                      <option key={h} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn ghost sm" onClick={() => setLook(randomAppearance(Math.random()))}>
                  🎲 Apariencia aleatoria
                </button>
              </div>
            </div>
          )}

          <div>
            <h3>Estado y temporada</h3>
            <div className="grid" style={{ gap: 6 }} >
              <div className="row small">
                Condición <span className="spacer" />
                <div style={{ width: 120 }}>
                  <Bar value={draft.condition} />
                </div>
              </div>
              {draft.injury > 0 && (
                <div className="small">
                  <span className="badge">LESIONADO</span> {draft.injuryNote} · {draft.injury} partido(s)
                </div>
              )}
              {draft.suspension > 0 && <span className="badge warn">SUSPENDIDO</span>}
              <div className="row small muted">
                PJ {draft.stats.apps} · Goles {draft.stats.goals} · Asist. {draft.stats.assists} · Prom. {avg}
              </div>
            </div>
          </div>
        </div>
      </div>
      {editable && (
        <div className="row" style={{ marginTop: 16 }}>
          {onDelete && (
            <button className="btn danger sm" onClick={() => onDelete(draft.id)}>
              Eliminar jugador
            </button>
          )}
          <span className="spacer" />
          <button className="btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn primary" onClick={() => onSave(draft)}>
            Guardar
          </button>
        </div>
      )}
    </Modal>
  )
}
