# Registro de tareas

Cada tarea es un archivo Markdown que se **mueve de carpeta** según su estado:

| Carpeta | Significado |
| --- | --- |
| `backlog/` | Ideas y tareas pendientes, aún sin empezar. |
| `in-progress/` | Lo que se está haciendo ahora. Idealmente 1 o 2 tareas a la vez. |
| `done/` | Terminado. Se anota la fecha y el commit. |

## Nombre del archivo

`NNN-titulo-corto.md`, por ejemplo `012-ascensos-y-descensos.md`. El número no cambia al mover el archivo, así sirve de ID (`T-012`).

## Plantilla

```markdown
# T-NNN · Título

- **Estado:** backlog | en progreso | hecho
- **Prioridad:** alta | media | baja
- **Creada:** AAAA-MM-DD · **Terminada:** AAAA-MM-DD
- **Commit(s):** abc1234

## Objetivo
Qué problema resuelve y por qué importa para el jugador.

## Alcance
- Qué incluye
- Qué NO incluye

## Criterios de aceptación
- [ ] Algo verificable

## Notas
Decisiones, dudas, enlaces.
```

## Reglas simples

1. Antes de empezar algo, muévelo a `in-progress/`.
2. Al terminar, márcalo en `done/` con la fecha y el commit.
3. Si una tarea crece demasiado, pártela en varias del backlog.
4. Ideas sueltas: créalas en el backlog aunque estén incompletas. Es mejor anotarlas que olvidarlas.
