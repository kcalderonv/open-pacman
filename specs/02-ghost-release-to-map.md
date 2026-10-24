# SPEC 02 — Salida de los fantasmas al mapa

> **Estado:** Implementado
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-24
> **Objetivo:** Al cumplir su retardo, cada fantasma deja la jaula y aparece en una celda transitable del mapa, sin recorrer la pen.

## Por qué existe este spec

El comportamiento actual no es un fallo. El spec 01 hace que cada fantasma espere dentro de la jaula hasta su turno y salga caminando por la puerta. Medido en `main`, salen en los frames 6, 60, 115 y 170, así que ninguno queda encerrado.

Aun así, los hasta 135 frames de espera se ven como cuatro fantasmas encerrados y no es evidente que vayan a salir. Este spec cambia la puesta en escena: en el frame de su retardo el fantasma ya está en el mapa.

## Alcance

**Dentro:**

- Tabla `GHOST_EXITS` en `maze.js` con una celda exterior distinta por `kind`.
- Teletransporte a esa celda en el frame de salida de cada fantasma.
- Bandera `released` por fantasma para saber si ya salió.
- Recolocación tras perder una vida directamente en las celdas de salida.
- Los cuatro siguen esperando visibles dentro de la jaula hasta su frame.

**Fuera de alcance (para futuros specs):**

- Power pellets, modo asustado y comer fantasmas.
- Alternancia de fases scatter/chase.
- Animación de salida por la puerta.
- Cambiar el BFS, los objetivos o las personalidades del spec 01.
- Frutas, puntuación extra, récords.

## Modelo de datos

```js
// maze.js — solo geometría, sin lógica
const GHOST_EXITS = {
  blinky: { x: 13, y: 11 }, // justo encima de la puerta
  pinky:  { x: 14, y: 11 },
  inky:   { x: 12, y: 11 },
  clyde:  { x: 15, y: 11 },
};
```

```js
// game.js — el fantasma recuerda si ya salió de la jaula
{ x, y, dir, speed, kind, released: false }
```

Convenciones que se mantienen: coordenadas en celdas con origen arriba-izquierda, velocidades en celdas por frame, `game.grid` como única copia mutable y `MAZE` prístino.

## Plan de implementación

1. `maze.js`: añadir `GHOST_EXITS` con las cuatro celdas y exportarlo con `window.GHOST_EXITS`. Manual: abrir `src/index.html`; nada cambia a la vista.
2. `game.js`: añadir `released: false` a cada fantasma de `createGame`. Manual: nada cambia a la vista.
3. `game.js`: en `moveGhost`, sustituir el corte `if ( game.frame < RELEASE_FRAMES[ g.kind ] ) return;` por: si no está `released` y aún no toca su frame, no mover; si toca, colocar en `GHOST_EXITS[ g.kind ]`, poner `dir = 'up'`, marcar `released = true` y seguir con el movimiento normal en esa misma llamada. Manual: al pulsar Start, el rojo aparece en (13,11) y los otros tres siguen quietos en la jaula.
4. `game.js`: `resetPositions` coloca a los cuatro en sus celdas de salida con `released = true`, sin pasar por la jaula. Manual: al perder una vida reaparecen en la fila 11.
5. Pasada de verificación contra los criterios de aceptación.

## Criterios de aceptación

- [ ] La partida arranca con los cuatro fantasmas quietos dentro de la jaula.
- [ ] Antes de su frame de salida, cada fantasma permanece en su celda de `GHOST_STARTS`.
- [ ] El rojo está en (13,11) en el frame 1.
- [ ] El rosa está en (14,11) en el frame 45.
- [ ] El cian está en (12,11) en el frame 90.
- [ ] El naranja está en (15,11) en el frame 135.
- [ ] Las cuatro celdas de `GHOST_EXITS` son transitables para fantasmas, están fuera de la jaula y ninguna es la puerta (valor 3).
- [ ] Dos fantasmas nunca comparten celda de salida.
- [ ] Ningún fantasma vuelve a estar dentro de la jaula después de su frame de salida, hasta perder una vida.
- [ ] Tras perder una vida los cuatro reaparecen en sus celdas de salida, no en la jaula.
- [ ] Los cuatro siguen decidiendo con BFS desde su celda de salida y con su personalidad del spec 01.
- [ ] Puntuación, vidas, dots restantes y estados `won`/`lost` funcionan igual que antes.
- [ ] La consola del navegador queda sin errores.

## Decisiones

- **Sí:** teletransporte en lugar de una rutina de salida. Es lo pedido: en cuanto el fantasma empieza a moverse, ya está en el mapa.
- **Sí:** una celda de salida distinta por `kind`. Evita solapamientos aunque dos salgan casi seguidos.
- **Sí:** la fila 11, justo encima de la puerta. Es la boca de salida del arcade y queda a una celda de la jaula, así que el salto es corto.
- **Sí:** mantener los retardos 0/45/90/135 del spec 01. La salida sigue siendo escalonada; solo cambia cómo se materializa.
- **Sí:** mantener `GHOST_STARTS` dentro de la jaula. La espera sigue siendo visible y no se toca el modelo del spec 01.
- **Sí:** bandera `released` por fantasma en vez de comparar `game.frame === RELEASE_FRAMES[ g.kind ]`. El rojo tiene retardo 0 y el frame del primer `update()` ya vale 1, así que la comparación exacta nunca se cumpliría para él.
- **Sí:** tras perder una vida aparecen en las celdas de salida, coherente con la decisión del spec 01 de que salen sin esperar.
- **No:** subir por la puerta con una rutina fija. Sería un camino nuevo para el mismo problema y el síntoma reportado es justamente el paseo dentro de la jaula.
- **No:** tocar `isWall`, `canMove`, el BFS o los objetivos. La puerta sigue siendo transitable para fantasmas aunque ya no la usen.
- **No:** quitar la jaula ni la puerta. Siguen siendo geometría válida y `MAZE` no se toca.
- **Nota:** el mecanismo, las celdas de salida, los retardos y la recolocación tras perder una vida se confirmaron con el usuario antes de aprobar el spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El fantasma aparece de golpe, sin transición | Asumido: es el objetivo del spec. Si molesta, una animación de entrada va en otro spec |
| Aparecer sobre la celda de Pac-Man y restar una vida sin querer | Las celdas están en la fila 11 y Pac-Man empieza en la 23; si coincide, la colisión es la normal y no se añade lógica de aplazamiento |
| `released` mal inicializado tras reiniciar o recolocar | Criterio explícito: tras perder una vida reaparecen en las celdas de salida, no en la jaula |
| Dos fantasmas en la misma celda al salir | Cuatro celdas distintas, una por `kind` |

## Lo que **no** entra en este spec

- Power pellets, modo asustado, comer fantasmas.
- Fases scatter/chase alternas.
- Animación de salida por la puerta.
- Frutas, bonus, récords.
- Delta-time o desacople de la tasa de refresco.
- Sonido.
- Ojos volviendo a casa tras ser comidos.

Cada uno de esos, si llega, va en su propio spec.
