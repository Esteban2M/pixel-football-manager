# Plan del juego · Pixel Football Manager

_Última actualización: 2026-10-15_

## Visión

> Un juego tipo Football Manager **más simple y digerible**, pero con **la emoción de sentirte un DT real** y de **crear tu propia historia**.

Tú decides la alineación, la táctica y los fichajes, ves jugar a tu equipo en pixel art y vives temporada tras temporada. Todo se puede personalizar: equipos, jugadores, escudos, ligas y formatos.

## Objetivos

1. **Un FM digerible con emoción de DT real.** Pocas decisiones, pero que importan. Cada temporada deja una historia: el juvenil que explotó, el fichaje que salió mal, el título agónico.
2. **Personalización de plantillas e historias.** Crear y editar clubes, jugadores, kits, escudos y retratos (Pixel Art Studio), además de ligas con cualquier formato.
3. **Facilitar la integración de la comunidad.** Todo el contenido entra y sale en JSON documentado, para que cualquiera pueda crear y compartir ligas, plantillas y packs.
4. **Mantenerlo simple.** Podría crecer hasta ser un SaaS, pero **por ahora no**. La prioridad es evaluar las mecánicas y pulir lo que le importa a la gente: **el juego**.

## Principios de decisión

- **Diversión > realismo > complejidad.** Si una mecánica no hace el juego más divertido, no entra.
- **Datos, no código.** Formatos, ligas y equipos se definen en JSON; el motor solo interpreta.
- **Todo local.** Sin cuentas ni servidor: se abre y se juega.
- **Pequeños pasos verificables.** Cada tarea termina con pruebas y una versión jugable.

## Fases

| Fase | Meta | Estado |
| --- | --- | --- |
| **0 · Prototipo** | Partido jugable, tácticas, creador pixel art. | ✅ Hecho |
| **1 · Núcleo de juego** | Ligas configurables, JSON, plantillas reales, modo carrera. | ✅ Hecho |
| **2 · Validar diversión** | Jugar, anotar y pulir lo que más importa (T-007, T-018, T-008, T-009). | 🔄 **Ahora** |
| **3 · Preparar la comunidad** | Packs, JSON Schema, IDs con prefijo, guía de creación (T-014, T-015, T-016). | ⏳ |
| **4 · Primera versión pública** | Datos genéricos, móvil, publicar en la web gratis (T-017, T-020, T-021). | ⏳ Solo si la fase 2 confirma que es entretenido |
| **5 · ¿Crecer?** | Evaluar comunidad, ligas compartidas online, posible SaaS. | 💭 Futuro |

## Estado actual (lo que llevamos)

**Partido**
- Motor 2D en tiempo real con 22 agentes, física del balón con altura, IA por utilidad, presión, marcaje, fuera de juego, balón parado, tarjetas, lesiones y cansancio.
- Control en vivo: cambios, tácticas y roles durante el partido.
- 5 formaciones y 24 roles tácticos que cambian el comportamiento.
- Simulación rápida estadística (Poisson) para los partidos que no ves.

**Competiciones**
- Motor por fases: liga, grupos, split, suizo y eliminatoria (ida y vuelta, mejor de 3, penales, byes).
- 13 presets de formatos reales (Liga MX, Premier, LaLiga, Serie A, Bundesliga, Champions, Mundial…).
- Editor de ligas con vista previa.
- Liga MX Apertura 2026 con los 18 clubes y plantillas reales (con distinto nivel de confianza).

**Modo carrera**
- Temporadas encadenadas (Apertura ↔ Clausura).
- Potencial, progresión y declive por edad y minutos.
- Mercado de fichajes en todas las ligas: ofertas, contraofertas, agentes libres, ventas, renovaciones.
- Presupuestos, salarios, ingresos y premios.
- La IA ficha, se retiran veteranos, sube la cantera.
- Historial y palmarés.

**Personalización y comunidad**
- Pixel Art Studio: dibujo libre, galería, escudos y retratos.
- Editor de equipos y jugadores (atributos, físico, apariencia).
- Importación y exportación JSON: equipos, ligas, formatos y mundo completo, con validación y reporte de errores.

**Calidad**
- 37 pruebas automáticas (motor, formatos, temporadas, JSON, carrera).

## Próximos pasos (prioridad)

1. **T-007 · Playtest del modo carrera.** Jugar y anotar. Decide todo lo demás.
2. **T-008 · Objetivos de la directiva y despido.** Tensión de DT real.
3. **T-009 · Carrera del DT y ofertas de trabajo.** Tu historia, no la del club.
4. **T-018 · Pulido del motor de partido.** Emoción en cada partido.
5. **T-010 · Balance de la economía.**

El detalle de cada tarea está en [`docs/task/`](task/README.md).

## Cómo medimos si va bien

- ¿Quiero jugar "una temporada más"? (la métrica más importante)
- ¿Recuerdo algún momento de la partida al día siguiente?
- ¿Una persona nueva entiende cómo jugar en menos de 5 minutos?
- ¿Alguien puede crear y cargar una liga propia sin ayuda?

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Crecer en funciones y perder la simplicidad | Principio "diversión > realismo > complejidad"; validar cada mecánica en playtest. |
| Derechos de nombres y escudos reales | Datos genéricos por defecto; datos reales como packs de la comunidad (T-017). |
| Formato JSON que cambia y rompe archivos | Versionado y migraciones (T-015). |
| Perder motivación en un proyecto grande | Tareas pequeñas, siempre una versión jugable, registro en `done/` para ver el avance. |

## Contexto del mercado
No encontramos un juego que combine todo este concepto. Ver [investigacion-mercado.md](investigacion-mercado.md).
