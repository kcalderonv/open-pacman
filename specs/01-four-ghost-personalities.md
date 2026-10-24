# SPEC 01 — Cuatro fantasmas con personalidad propia

> **Estado:** Approved
> **Depende de:** —
> **Fecha:** 2026-10-24
> **Objetivo:** Dar al juego cuatro fantasmas con comportamientos distintos y una persecución real por ruta más corta.

## Alcance

**Dentro:**

- Cuatro fantasmas en `GHOST_STARTS`, cada uno con su `kind`: `blinky`, `pinky`, `inky`, `clyde`.
- Cuatro celdas objetivo distintas, una por personalidad, siguiendo el reparto clásico del arcade.
- Búsqueda en anchura (BFS) sobre `game.grid` para elegir el primer paso de la ruta más corta.
- Salida escalonada de la pen mediante retardos en frames.
- Colores clásicos en el orden correcto: rojo, rosa, cian, naranja.

**Fuera de alcance (para futuros specs):**

- Power pellets, modo asustado y comer fantasmas.
- Alternancia de fases scatter/chase.
- Frutas, puntuación extra, récords.
- Delta-time: el juego sigue atado a la tasa de refresco.

## Modelo de datos

```js
// maze.js — solo geometría, sin lógica
const GHOST_STARTS = [
  { x: 13, y: 13, kind: 'blinky' }, // bajo la puerta, sale primero
  { x: 14, y: 13, kind: 'pinky'  },
  { x: 13, y: 15, kind: 'inky'   },
  { x: 14, y: 15, kind: 'clyde'  },
];
```

```js
// game.js — retardos de salida, en frames jugados
const RELEASE_FRAMES = { blinky: 0, pinky: 45, inky: 90, clyde: 135 };

// createGame() añade un contador y no cambia la forma de cada fantasma
{ frame: 0, ghosts: [ { x, y, dir, speed, kind } ] }
```

Convenciones que se mantienen: coordenadas en celdas con origen arriba-izquierda, velocidades en celdas por frame, `game.grid` como única copia mutable.

## Plan de implementación

1. `maze.js`: sustituir los 2 `GHOST_STARTS` por los 4 de arriba. Manual: abrir `src/index.html`; se ven 4 fantasmas, todos con la rama aleatoria porque `decideGhost` aún no conoce los `kind` nuevos.
2. `render.js`: reordenar `GHOST_COLORS` a `['#ff0000', '#ffb8ff', '#00ffff', '#ffb852']`. Manual: los 4 fantasmas tienen color distinto y el rojo es el de la celda (13,13).
3. `game.js`: añadir `RELEASE_FRAMES`, `frame: 0` en `createGame` e incrementarlo al inicio de `update`. En `moveGhost`, si `game.frame < RELEASE_FRAMES[ g.kind ]`, no mover. Manual: salen de uno en uno, separados ~45 frames.
4. `game.js`: sustituir el `if ( g.kind === 'hunter' )` por `ghostTarget( game, g )`, que devuelve la celda objetivo:

   ```js
   blinky → celda redondeada de Pac-Man
   pinky  → celda de Pac-Man + 4 en su dirección actual
   inky   → 2 * (Pac-Man + 2 celdas) - posición de Blinky
   clyde  → Pac-Man si su distancia Manhattan > 8; si no, la esquina (1, 29)
   ```

   Se conservan la regla de no girar 180° y el fallback de callejón. Manual: cada fantasma toma un camino distinto y visiblemente reconocible.
5. `game.js`: añadir `firstStepToward( grid, from, to )` con BFS y usarlo en lugar del desempate Manhattan. Nodos transitables para fantasmas = todo lo que no sea `1` (la puerta sigue siendo transitable). Si el objetivo cae fuera de la rejilla o sobre una pared, se recorta a los límites y, si sigue sin ser alcanzable, se cae a Manhattan greedy. Manual: el rojo deja de oscilar y llega a Pac-Man.
6. Pasada de verificación contra los criterios de aceptación.

## Criterios de aceptación

- [ ] Al pulsar Start aparecen cuatro fantasmas con colores distintos: rojo, rosa, cian, naranja.
- [ ] Los cuatro empiezan en (13,13), (14,13), (13,15) y (14,15), dentro de la pen.
- [ ] Salen de la pen en ese orden, con unos 45 frames entre uno y el siguiente y sin amontonarse.
- [ ] Sin tocar el teclado desde Start, el fantasma rojo llega a Pac-Man y se pierde una vida en menos de 15 segundos.
- [ ] El rojo no se queda oscilando entre dos celdas ni parado contra una pared en 60 segundos de partida.
- [ ] Con Pac-Man moviéndose a la derecha por la fila 23, el objetivo del rosa es `(x + 4, 23)`.
- [ ] Mover al rojo de sitio cambia la decisión del cian en la misma situación de Pac-Man.
- [ ] El naranja persigue cuando está a más de 8 celdas y se aleja hacia (1,29) cuando está a 8 o menos.
- [ ] Ningún fantasma atraviesa una celda de pared (valor 1) y los cuatro usan el túnel de la fila 14.
- [ ] Puntuación, vidas, dots restantes y estados `won`/`lost` funcionan igual que antes.
- [ ] La consola del navegador queda sin errores.

## Decisiones

- **Sí:** las cuatro personalidades clásicas adaptadas. Es el reparto que ya conoce cualquiera que haya jugado al original y da cuatro comportamientos distinguibles sin inventar reglas.
- **Sí:** BFS para los cuatro, no solo para el cazador. Un solo algoritmo y cuatro objetivos distintos producen cuatro comportamientos; duplicar la lógica de decisión sería más código para el mismo resultado.
- **No:** Manhattan greedy como decisión principal. Es lo que hay hoy y se queda oscilando en forma de U, justo lo que "perseguir decididamente" pide evitar.
- **No:** A\*. Con 868 celdas y cuatro fantasmas el coste es irrelevante y la heurística solo añadiría código que mantener.
- **No:** alternancia scatter/chase. Se elige persecución permanente para que cada personalidad sea predecible y verificable.
- **Sí:** retardos de salida en frames y solo al empezar la partida. Tras perder una vida se recolocan y salen sin esperar, igual que el resto del juego evita acumular estado.
- **No:** bloquear la reentrada a la pen. `isWall` se queda como está; el BFS saca a los fantasmas igual.
- **Sí:** orden de colores clásico. El índice en `GHOST_COLORS` es la identidad del fantasma en `render.js`; mantener el orden alineado con `GHOST_STARTS` evita un mapa extra de colores.
- **No:** BFS con túnel envolvente. Los vecinos de la fila 14 no se conectan por los bordes; el rodeo es la única ruta que ve el algoritmo y el resultado sigue siendo correcto.
- **No:** azar. Al desaparecer `kind: 'random'`, `Math.random` deja de usarse y las partidas pasan a ser reproducibles, lo que ayuda a verificar.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El objetivo del rosa o del cian cae fuera del laberinto o sobre una pared | Recorte a los límites de la rejilla y desempate Manhattan si el BFS no lo alcanza |
| BFS recalculado en cada frame alineado para cada fantasma | 868 celdas como máximo, solo al alinearse; si molesta, cachear por par (origen, objetivo) |
| Los cuatro se amontonan al salir | Retardos 0/45/90/135 y dos columnas de salida distintas |
| Sin delta-time, los retardos dependen de la tasa de refresco | Se expresan en frames; a 144 Hz salen ~2,4× más rápido, coherente con el resto del juego |
| El naranja oscila justo en el umbral de 8 celdas | Umbral sobre distancia Manhattan redondeada; no se añade histéresis |

## Lo que **no** entra en este spec

- Power pellets, modo asustado, comer fantasmas.
- Fases scatter/chase alternas.
- Frutas, bonus, récords.
- Delta-time o desacople de la tasa de refresco.
- Sonido.
- Ojos volviendo a casa tras ser comidos.

Cada uno de esos, si llega, va en su propio spec.
