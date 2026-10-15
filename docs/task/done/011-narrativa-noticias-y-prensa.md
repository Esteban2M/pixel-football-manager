# T-011 · Narrativa: noticias, prensa y momentos

- **Estado:** hecho
- **Prioridad:** media
- **Creada:** 2026-10-15 · **Terminada:** 2026-10-15

## Objetivo
Crear historias que se recuerden: clásicos, rachas, récords, el juvenil que debuta y marca.

## Qué se hizo
- `src/game/narrative.js`.
- **Rivalidades:** 9 clásicos de la Liga MX incluidos (Nacional, Joven, Capitalino, Regio, Tapatío…). Los equipos pueden declarar los suyos en JSON con `rivals`. El próximo partido muestra la etiqueta "🔥 Clásico …".
- **Titulares (📰)** tras cada partido tuyo:
  - resultado de un clásico;
  - goleadas a favor y en contra;
  - hat-trick, póker y manita;
  - un juvenil (≤ 20 años) que marca;
  - rachas de 3 o más victorias o derrotas;
  - nuevo líder.
- **Ruedas de prensa (🎙)** antes de tu próximo partido:
  - Se convocan antes de cada clásico, tras 2 o más derrotas y tras 3 o más victorias.
  - Al azar también salen preguntas sobre tu jugador en mejor forma o sobre un joven de la cantera.
  - Cada respuesta cambia la moral del equipo o de un jugador, o la confianza de la directiva.
  - Algunas son **promesas** ("vamos a ganarlo"): si cumples, la directiva te da +3; si no, −5.
- El panel de la directiva muestra también el ánimo del vestuario.

## Criterios de aceptación
- [x] Titulares y prensa visibles en Inicio (probado en el navegador).
- [x] Tests: clásicos (incluidos los de JSON), efectos de la prensa, promesas, titulares, importación de `rivals`.
