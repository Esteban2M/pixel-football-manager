# T-009 · Carrera del DT: reputación y ofertas de trabajo

- **Estado:** hecho
- **Prioridad:** alta
- **Creada:** 2026-10-15 · **Terminada:** 2026-10-15

## Objetivo
Que la historia sea **la tuya** como entrenador: empezar en un club chico y llegar a uno grande.

## Qué se hizo
- **Reputación del DT** (0–100):
  - empieza según el club elegido;
  - cumplir objetivo +4, título +10, fallar −5, despido −8.
- **Prestigio de cada club** (0–100), según su fuerza entre todos los clubes del mundo.
- **Ofertas de trabajo** (`jobOffers`): llegan de clubes con prestigio ≤ tu reputación + 15. Los clubes que van mal son más propensos a llamarte.
  - **Al final de la temporada:** de cualquier club que esté en alguna liga.
  - **Si te despiden a mitad de temporada:** de clubes de la misma competición, así la carrera sigue.
  - **Si te despiden:** siempre recibes al menos una oferta.
- **`takeJob`** cambia de club (y de liga si hace falta) y reinicia la confianza y el objetivo.
- **Historial del DT** con etapas por club, periodo, G-E-P, títulos y despidos (pestaña Club → "Tu carrera como DT").
- El palmarés por temporada muestra con qué club la jugaste.
- Migración del mundo a v6.

## Criterios de aceptación
- [x] Ofertas al final de cada temporada y tras un despido.
- [x] Cambiar de club conserva el historial.
- [x] Tests: objetivo según fuerza, despido y cambio de club, revisión de temporada.
