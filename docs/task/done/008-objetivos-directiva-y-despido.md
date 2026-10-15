# T-008 · Objetivos de la directiva y despido

- **Estado:** hecho
- **Prioridad:** alta
- **Creada:** 2026-10-15 · **Terminada:** 2026-10-15

## Objetivo
Dar tensión de DT real: la directiva pone metas por temporada y, si fallas, te despiden.

## Qué se hizo
- `src/game/manager.js`: `makeObjective` fija la meta según la fuerza de tu plantilla frente a los rivales:
  - top 2 / campeón;
  - top 4;
  - clasificar a la Liguilla;
  - "terminar en el puesto X o mejor" (tu ranking + 3);
  - no terminar último.

  Las metas son exigentes pero alcanzables.
- **Confianza de la directiva** (0–100, empieza en 65):
  - victoria +2, derrota −2,5, empate +0,3;
  - −1,5 por jornada si vas 4 o más puestos por debajo del objetivo;
  - al final de la temporada: objetivo cumplido +18 (campeón +30); no cumplido entre −15 y −30 según la distancia.
- **Despido:**
  - a mitad de temporada, desde la jornada 7, si la confianza llega a ≤ 8;
  - al final de la temporada, si queda por debajo de 25 (salvo que seas campeón).
- **UI:**
  - panel "Directiva" en Inicio (objetivo, posición actual, barra de confianza y estado de ánimo);
  - veredicto del objetivo en el resumen de fin de temporada;
  - panel "Despedido".

## Criterios de aceptación
- [x] La meta se muestra en Inicio y en el resumen.
- [x] El despido ocurre por mal rendimiento continuado (probado en tests y en el navegador).

## Notas
En simulaciones de 6 temporadas: un club fuerte con mala racha baja a "Molesta" sin ser despedido de inmediato; un DT pasivo (que no renueva ni ficha) acaba despedido.
