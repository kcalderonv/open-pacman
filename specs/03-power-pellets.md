# SPEC 03 — Power pellets y modo asustado

> **Estado:** Implementado
> **Depende de:** SPEC 01, SPEC 02
> **Fecha:** 2026-10-24
> **Objetivo:** Añadir cuatro power pellets que, al comerse, vuelven azules y comestibles a los fantasmas durante 360 frames.

## Por qué existe este spec

El juego ya tiene los cuatro fantasmas del spec 01 y su salida al mapa del spec 02, pero la única interacción posible es huir: cualquier contacto cuesta una vida. Este spec cierra el ciclo clásico del arcade añadiendo el momento en que Pac-Man pasa al ataque.

Los dos specs anteriores dejaron "power pellets, modo asustado y comer fantasmas" explícitamente fuera de alcance. Este es ese spec.

## Alcance

**Dentro:**

- Cuarto valor de tile `4` en `parseTile`, escrito como `'o'` en `MAZE_STR`.
- Cuatro power pellets en las esquinas clásicas: `(1,3)`, `(26,3)`, `(1,23)`, `(26,23)`.
- Comer un pellet suma 50 puntos, lo borra de `game.grid` y cuenta para `dotsRemaining`.
- Modo asustado de 360 frames fijos, con los fantasmas en azul y parpadeo blanco en los últimos 120.
- Inversión de la dirección de los fantasmas en el instante en que empieza el susto.
- Huida determinista por BFS hacia la celda transitable más lejana de Pac-Man.
- Fantasmas comidos: 200, 400, 800 y 1600 puntos dentro del mismo pellet.
- El fantasma comido vuelve a la pen y reaparece por `GHOST_EXITS` cuando el susto termina.
- Perder una vida cancela el susto y reinicia la cadena de puntos.

**Fuera de alcance (para futuros specs):**

- Ojos volando de vuelta a la pen tras ser comidos.
- Cambios de velocidad durante el susto.
- Frutas, bonus y récords.
- Alternancia de fases scatter/chase.
- Sonido.

## Modelo de datos

```js
// maze.js — 'o' es el cuarto caracter reconocido por parseTile
parseTile: '#' = 1 pared · '.' = 2 dot · '-' = 3 puerta · 'o' = 4 power pellet

// Las dos filas que cambian respecto al spec 02 (28 chars cada una)
'#o####.#####.##.#####.####o#', // 3
'#o..##................##..o#', // 23
```

```js
// game.js — constantes del modo asustado
const FRIGHT_FRAMES = 360;        // 6 s a 60 Hz
const FRIGHT_BLINK_FRAMES = 120;  // últimos 2 s, parpadeo de aviso
const POWER_PELLET_SCORE = 50;
const GHOST_SCORES = [ 200, 400, 800, 1600 ];
```

```js
// game.js — estado nuevo en createGame()
{
  frightFrames: 0,  // frames de susto restantes; 0 = sin susto
  ghostsEaten: 0,   // cadena del pellet actual; se reinicia con cada pellet
  ghosts: [ { x, y, dir, speed, kind, released: false, eaten: false } ],
}
```

```js
// render.js — paleta del susto
const FRIGHT_COLOR = '#2121de';
const FRIGHT_BLINK_COLOR = '#ffffff';
```

Convenciones que se mantienen: coordenadas en celdas con origen arriba-izquierda, velocidades en celdas por frame sin delta-time, `game.grid` como única copia mutable y `MAZE` prístino.

## Plan de implementación

1. `maze.js`: añadir `'o'` → `4` en `parseTile` y cambiar a `'o'` las celdas `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)` de `MAZE_STR`. Manual: abrir `src/index.html`; las cuatro esquinas quedan sin dot visible porque `render.js` todavía no dibuja el tile 4, y la consola no da errores.
2. `render.js`: en `drawDots`, dibujar el tile `4` con radio `5.5` y el mismo color `#ffb897`. Manual: se ven cuatro puntos grandes en las esquinas del laberinto.
3. `game.js`: en `createGame`, contar también los tiles `4` en `dotsRemaining`; añadir `frightFrames: 0`, `ghostsEaten: 0` y `eaten: false` a cada fantasma. Manual: la partida ya no se gana sin comer los cuatro pellets.
4. `game.js`: añadir `startFright( game )` — pone `frightFrames = FRIGHT_FRAMES`, reinicia `ghostsEaten = 0` e invierte `dir` con `OPPOSITE` a los fantasmas con `released && !eaten` — y llamarla desde `movePacman` al comer un tile `4`, sumando 50 puntos. Manual: al comer un pellet los fantasmas visibles dan media vuelta en el sitio.
5. `game.js`: al inicio de `update`, si `frightFrames > 0`, descontar uno y, al llegar a 0, devolver a los comidos: `eaten = false`, `released = true`, `x/y` de `GHOST_EXITS[ kind ]`, `dir = 'up'`. Manual: el contador baja hasta 0 y el fantasma comido reaparece en la fila 11.
6. `game.js`: en `ghostTarget`, si `game.frightFrames > 0` devolver `farthestOpenCell( grid, celda de Pac-Man )`; nueva función que reutiliza `bfsDistances` y elige la celda alcanzable con mayor distancia, desempatando por el primer hallazgo en orden `y` y luego `x`. Manual: los fantasmas se alejan de Pac-Man en lugar de perseguirlo.
7. `game.js`: en el bucle de colisión de `update`, si `frightFrames > 0` comer al fantasma — sumar `GHOST_SCORES[ ghostsEaten ]`, incrementar `ghostsEaten`, mandarlo a su celda de `GHOST_STARTS` con `eaten = true` y `released = false`, y seguir revisando el resto — en lugar de restar una vida. En `resetPositions`, poner `frightFrames = 0`, `ghostsEaten = 0` y `eaten = false` en los cuatro. Manual: tocar un fantasma azul suma 200 y no cuesta vida; tocar uno normal cuesta una vida como antes.
8. `render.js`: `drawGhost` recibe `frightened` y `blinking`; pinta `FRIGHT_COLOR` y alterna con `FRIGHT_BLINK_COLOR` cuando `frightFrames <= FRIGHT_BLINK_FRAMES` y `Math.floor( frightFrames / 15 ) % 2 === 0`. `draw` pasa el estado desde `game`. Manual: los fantasmas se ven azules y parpadean en los últimos 2 segundos.
9. Pasada de verificación contra los criterios de aceptación.

## Criterios de aceptación

- [ ] Al empezar hay exactamente cuatro celdas con valor `4` en `game.grid`, en `(1,3)`, `(26,3)`, `(1,23)` y `(26,23)`.
- [ ] Cada pellet se dibuja con radio mayor que un dot normal.
- [ ] Comer un pellet suma 50 puntos, deja la celda en `0` y descuenta uno de `dotsRemaining`.
- [ ] `dotsRemaining` inicial incluye los cuatro pellets.
- [ ] La partida solo pasa a `won` cuando no queda ningún dot ni pellet.
- [ ] Comer un pellet pone `frightFrames` en `360`.
- [ ] Los fantasmas ya liberados y no comidos se ven azules al comer un pellet.
- [ ] En los últimos 120 frames del susto los fantasmas alternan entre azul y blanco.
- [ ] Al comer el pellet los fantasmas liberados invierten su dirección en el sitio.
- [ ] Durante el susto los fantasmas se alejan de Pac-Man en cada cruce.
- [ ] Tocar un fantasma azul no resta vidas y suma 200, 400, 800 y 1600 en ese orden dentro del mismo pellet.
- [ ] Comer un segundo pellet reinicia la cadena a 200.
- [ ] Un fantasma comido deja de verse en el mapa y no colisiona.
- [ ] Al llegar `frightFrames` a 0 el fantasma comido reaparece en su celda de `GHOST_EXITS` y vuelve a su color normal.
- [ ] Al terminar el susto tocar un fantasma vuelve a costar una vida.
- [ ] Perder una vida deja `frightFrames` en 0 y devuelve a los cuatro a sus celdas de `GHOST_EXITS` con su color normal.
- [ ] Las velocidades siguen siendo `PACMAN_SPEED = 0.125` y `GHOST_SPEED = 0.1`.
- [ ] La consola del navegador queda sin errores.

## Decisiones

- **Sí:** tile `4` en `game.grid` en lugar de una lista aparte. Los pellets se comen y se dibujan con el mismo recorrido que los dots, sin una segunda fuente de verdad que mantener sincronizada.
- **Sí:** las cuatro esquinas del arcade. Es la posición que el jugador espera y las cuatro celdas ya eran dots transitables en el laberinto actual.
- **Sí:** 50 puntos y contabilizados en `dotsRemaining`. Si no contaran, la partida se podría ganar ignorando los pellets, y el modo asustado quedaría como un adorno opcional.
- **Sí:** 360 frames fijos. Sin delta-time, la duración se expresa en frames como `RELEASE_FRAMES` del spec 01; un solo nivel no justifica una tabla por nivel.
- **Sí:** el fantasma comido vuelve a la pen y espera al final del susto. Reutiliza `released` y `GHOST_EXITS` del spec 02 y evita inventar el estado "ojos volando", que está fuera de alcance.
- **Sí:** cadena 200/400/800/1600 reiniciada por pellet. Es la regla del arcade y convierte comerse los cuatro en un objetivo con recompensa propia.
- **Sí:** huida determinista hacia la celda más lejana por BFS. Mantiene la reproducibilidad que el spec 01 consiguió al quitar `Math.random`, y el BFS ya existe.
- **Sí:** invertir la dirección al empezar el susto. Es la señal más clara de que el pellet ha funcionado y cuesta una línea; la regla de no girar 180° se exceptúa solo en ese instante.
- **Sí:** velocidades sin cambios. Cambiar `speed` a mitad de celda deja fracciones que nunca vuelven a alinear y el actor se queda sin comer ni girar (ver `AGENTS.md`); el susto se comunica con color y reglas, no con ritmo.
- **Sí:** azul `#2121de` con parpadeo blanco en los últimos 120 frames. El parpadeo avisa de que el susto se acaba sin necesidad de HUD.
- **Sí:** al perder una vida el susto termina y la cadena vuelve a 0. La recolocación del spec 02 ya reinicia la posición de todo; arrastrar frames de susto dejaría fantasmas azules recién salidos.
- **Sí:** un pellet comido durante otro susto reinicia el contador a 360, la cadena a 0 y vuelve a invertir direcciones. Una sola regla para "empieza un susto", sin casos especiales.
- **No:** ojos volando a la pen. Es animación y ruta propias; el teletransporte deja el mismo estado de juego con una fracción del código.
- **No:** fantasmas más lentos durante el susto. Requeriría aplicar el cambio solo en celdas alineadas y añadir un caso más que verificar.
- **No:** azar en la huida. Reintroduciría `Math.random`, que el spec 01 eliminó a propósito.
- **No:** HUD nuevo ni temporizador visible. El color y el parpadeo ya comunican el estado.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un pellet mal escrito en `MAZE_STR` descuadra la fila y corrompe la rejilla | `'o'` sustituye a un `'.'` existente: las filas 3 y 23 siguen teniendo 28 caracteres |
| La inversión de dirección deja al fantasma a mitad de celda | Es seguro: al volver recorre la misma fracción hasta el centro y vuelve a alinear |
| El fantasma comido se libera al instante porque `game.frame` ya supera su `RELEASE_FRAMES` | La espera la gobierna `eaten`, no `released`; solo se libera cuando `frightFrames` llega a 0 |
| Dos fantasmas solapados con Pac-Man en el mismo frame | El bucle no hace `break` en la rama de susto, así que se comen los dos y la cadena avanza dos pasos |
| `farthestOpenCell` añade un BFS extra por fantasma y frame alineado | 868 celdas como máximo, mismo orden que el BFS del spec 01; si molesta, se cachea por frame |
| El parpadeo depende del frame de render y no del estado | Se calcula con `game.frightFrames`, así que también es correcto con el juego en pausa |

## Lo que **no** entra en este spec

- Ojos volviendo a casa tras ser comidos.
- Cambios de velocidad o delta-time.
- Frutas, bonus, récords.
- Fases scatter/chase alternas.
- HUD o marcador del tiempo de susto.
- Sonido.

Cada uno de esos, si llega, va en su propio spec.
