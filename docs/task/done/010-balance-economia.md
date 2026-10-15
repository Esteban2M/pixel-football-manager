# T-010 · Balance de la economía a largo plazo

- **Estado:** hecho
- **Prioridad:** media
- **Creada:** 2026-10-15 · **Terminada:** 2026-10-15

## Objetivo
Evitar que los clubes grandes acumulen dinero sin límite tras muchas temporadas.

## Qué se hizo
- Nuevo script: `npm run economy -- 20 [club]` simula N temporadas sin interfaz e imprime presupuestos, fuerza y campeones.
- **Reinversión de la IA:** un club de la IA con más del doble de sus ingresos base (mínimo $8M) gasta el 35% del excedente cada temporada (estadio, cantera, staff). No aplica a tu club.
- **Ingresos que siguen al club:** cada año, los ingresos base se acercan un 20% a la masa salarial actual. Así un club que crece gana más y uno que se reduce, menos.
- **Ventas por deuda:** los clubes de la IA en números rojos venden a su jugador más valioso a un club que pueda pagarlo.
- **Segundo intento de fichaje** para los clubes ricos de la IA en cada ventana.

## Resultados (20 temporadas, Liga MX)

| Métrica | Antes | Después |
| --- | --- | --- |
| Presupuesto máximo | $121M (Toluca, 7× el inicial) | ~$32M (máx. 3,7×, León) |
| Presupuesto mínimo | −$8M (varios clubes en deuda permanente) | ≥ $0,2M |
| Campeones distintos | 9 (Toluca 7 títulos) | 9 (máximo 4 títulos) |
| Fuerza media de los equipos | 65–69 | 65–68 (estable) |

## Criterios de aceptación
- [x] Ningún club se dispara sin motivo. León llega a 3,7× porque empezó con poco presupuesto y vendió bien. Es aceptable.
- [x] La liga sigue competitiva: 9 campeones distintos en 20 temporadas.
