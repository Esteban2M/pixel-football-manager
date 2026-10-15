# T-003 · Ligas configurables, formatos y JSON

- **Estado:** hecho
- **Prioridad:** alta
- **Creada:** 2026-10-14 · **Terminada:** 2026-10-14
- **Commit(s):** ab8e9be

## Objetivo
Que cualquiera pueda armar su propia competición, compartirla y cargarla. Es la base de la personalización y de la comunidad.

## Alcance
- Motor de competiciones por fases: liga (con grupos y split), suizo y eliminatoria (ida y vuelta, mejor de 3, byes, penales).
- Presets de formato: Liga MX, Premier, LaLiga, Serie A, Bundesliga, Escocia, Bélgica, MLS, Argentina, Champions, Mundial, Copa.
- Editor de ligas con vista previa (`dryRun`).
- Importación y exportación JSON (`pfm-team`, `pfm-teams`, `pfm-league`, `pfm-format`, `pfm-world`) con validación tolerante y reporte de errores.
- Liga MX Apertura 2026 con los 18 clubes.

## Criterios de aceptación
- [x] Crear una liga nueva desde la UI y jugarla.
- [x] Exportar e importar sin perder datos.
