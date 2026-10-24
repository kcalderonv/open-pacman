// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS, GHOST_EXITS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Retardos de salida de la pen, en frames jugados (spec 01).
const RELEASE_FRAMES = { blinky: 0, pinky: 45, inky: 90, clyde: 135 };

// Modo asustado (spec 03), en frames fijos a 60 Hz.
const FRIGHT_FRAMES = 360;        // 6 s
const FRIGHT_BLINK_FRAMES = 120;  // ultimos 2 s: parpadeo de aviso
const POWER_PELLET_SCORE = 50;
const GHOST_SCORES = [ 200, 400, 800, 1600 ];

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    frame: 0, // frames jugados; gobierna la salida escalonada de la pen
    frightFrames: 0, // frames de susto restantes; 0 = sin susto (spec 03)
    ghostsEaten: 0,  // cadena del pellet actual; se reinicia con cada pellet
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      released: false, // aun espera su turno dentro de la jaula (spec 02)
      eaten: false,    // comido durante el susto; espera fuera del mapa (spec 03)
    } ) ),
  };
}

// Empieza el modo asustado (spec 03): reinicia la cadena de puntos e invierte
// en el sitio la direccion de los fantasmas que estan en el mapa.
function startFright( game ) {
  game.frightFrames = FRIGHT_FRAMES;
  game.ghostsEaten = 0;
  game.ghosts.forEach( ( g ) => {
    if ( g.released && !g.eaten ) g.dir = OPPOSITE[ g.dir ];
  } );
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Comer power pellet: 50 puntos y arranca el susto (spec 03).
    if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += POWER_PELLET_SCORE;
      game.dotsRemaining--;
      startFright( game );
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Celda objetivo segun la personalidad del fantasma (spec 01).
// Devuelve celdas sin recortar: rosa y cian pueden apuntar fuera del laberinto.
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const pd = DIRS[ p.dir ] || { x: 0, y: 0 };

  // Durante el susto la huida manda: la celda transitable mas lejana (spec 03).
  if ( game.frightFrames > 0 ) {
    return farthestOpenCell( game.grid, { x: px, y: py } );
  }

  if ( g.kind === 'pinky' ) {
    // 4 celdas por delante de la direccion actual de Pac-Man.
    return { x: px + pd.x * 4, y: py + pd.y * 4 };
  }

  if ( g.kind === 'inky' ) {
    // 2 * (2 celdas por delante de Pac-Man) - posicion de Blinky.
    const blinky = game.ghosts.find( ( o ) => o.kind === 'blinky' );
    const bx = blinky ? Math.round( blinky.x ) : px;
    const by = blinky ? Math.round( blinky.y ) : py;
    return { x: 2 * ( px + pd.x * 2 ) - bx, y: 2 * ( py + pd.y * 2 ) - by };
  }

  if ( g.kind === 'clyde' ) {
    // Persigue de lejos; a 8 celdas o menos se retira a su esquina.
    const dist = Math.abs( Math.round( g.x ) - px ) + Math.abs( Math.round( g.y ) - py );
    if ( dist > 8 ) return { x: px, y: py };
    return { x: 1, y: 29 };
  }

  // blinky (y cualquier kind desconocido): la celda de Pac-Man.
  return { x: px, y: py };
}

// Recorta una celda a los limites de la rejilla.
function clampToGrid( grid, cell ) {
  return {
    x: Math.max( 0, Math.min( grid[ 0 ].length - 1, Math.round( cell.x ) ) ),
    y: Math.max( 0, Math.min( grid.length - 1, Math.round( cell.y ) ) ),
  };
}

// Si el objetivo cae sobre una pared (el recorte puede dejarlo en el borde),
// se usa la celda transitable mas cercana en Manhattan. Sin esto el BFS no lo
// alcanza y el desempate greedy puede encerrar al fantasma en la pen.
function snapToOpen( grid, cell ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  if ( grid[ cell.y ][ cell.x ] !== 1 ) return cell;

  let best = cell;
  let bestDist = Infinity;
  for ( let y = 0; y < H; y++ ) {
    for ( let x = 0; x < W; x++ ) {
      if ( grid[ y ][ x ] === 1 ) continue;
      const d = Math.abs( x - cell.x ) + Math.abs( y - cell.y );
      if ( d < bestDist ) {
        bestDist = d;
        best = { x, y };
      }
    }
  }
  return best;
}

// Distancias BFS, en celdas, desde 'to' hasta cada celda transitable para
// fantasmas: todo lo que no sea pared (1); la puerta de la pen (3) cuenta.
// No conecta los extremos del tunel (spec 01). Infinity = inalcanzable.
function bfsDistances( grid, to ) {
  const H = grid.length;
  const W = grid[ 0 ].length;
  const dist = grid.map( ( row ) => row.map( () => Infinity ) );

  if ( to.x < 0 || to.x >= W || to.y < 0 || to.y >= H ) return dist;
  if ( grid[ to.y ][ to.x ] === 1 ) return dist;

  const queue = [ [ to.x, to.y ] ];
  dist[ to.y ][ to.x ] = 0;
  for ( let i = 0; i < queue.length; i++ ) {
    const x = queue[ i ][ 0 ];
    const y = queue[ i ][ 1 ];
    for ( const dir of Object.keys( DIRS ) ) {
      const d = DIRS[ dir ];
      const nx = x + d.x;
      const ny = y + d.y;
      if ( nx < 0 || nx >= W || ny < 0 || ny >= H ) continue;
      if ( grid[ ny ][ nx ] === 1 ) continue;
      if ( dist[ ny ][ nx ] !== Infinity ) continue;
      dist[ ny ][ nx ] = dist[ y ][ x ] + 1;
      queue.push( [ nx, ny ] );
    }
  }
  return dist;
}

// Celda transitable alcanzable mas lejana (en celdas BFS) desde 'from'.
// Desempata por el primer hallazgo en orden de fila (y) y luego columna (x),
// para que la huida sea determinista (spec 03).
function farthestOpenCell( grid, from ) {
  const dist = bfsDistances( grid, from );
  let best = { x: from.x, y: from.y };
  let bestDist = -1;
  for ( let y = 0; y < grid.length; y++ ) {
    for ( let x = 0; x < grid[ 0 ].length; x++ ) {
      if ( dist[ y ][ x ] === Infinity ) continue;
      if ( dist[ y ][ x ] > bestDist ) {
        bestDist = dist[ y ][ x ];
        best = { x, y };
      }
    }
  }
  return best;
}

// Primer paso de la ruta mas corta desde 'from' hacia 'to', limitado a
// 'options'. Devuelve null si el objetivo no es alcanzable, para que el
// llamador caiga al desempate Manhattan.
function firstStepToward( grid, from, to, options ) {
  const W = grid[ 0 ].length;
  const H = grid.length;
  const dist = bfsDistances( grid, to );

  let best = null;
  let bestDist = Infinity;
  for ( const dir of options ) {
    const d = DIRS[ dir ];
    const nx = Math.round( from.x ) + d.x;
    const ny = Math.round( from.y ) + d.y;
    // Fuera de la rejilla: solo puede ser el tunel, que el BFS no modela.
    if ( nx < 0 || nx >= W || ny < 0 || ny >= H ) continue;
    const nd = dist[ ny ][ nx ];
    if ( nd < bestDist ) {
      bestDist = nd;
      best = dir;
    }
  }
  if ( best === null || bestDist === Infinity ) return null;
  return best;
}

// Desempate clasico por distancia Manhattan, para cuando el BFS no alcanza
// el objetivo (objetivo sobre una pared o en zona aislada).
function greedyStep( from, to, options ) {
  let best = options[ 0 ];
  let bestDist = Infinity;
  for ( const dir of options ) {
    const d = DIRS[ dir ];
    const nx = from.x + d.x;
    const ny = from.y + d.y;
    const dist = Math.abs( nx - to.x ) + Math.abs( ny - to.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  const target = snapToOpen( grid, clampToGrid( grid, ghostTarget( game, g ) ) );
  const step = firstStepToward( grid, g, target, choices );
  g.dir = step || greedyStep( g, target, choices );
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Comido: espera fuera del mapa hasta que termine el susto (spec 03).
  if ( g.eaten ) return;

  // Salida escalonada: cada fantasma espera su turno en la jaula y, al cumplirlo,
  // se materializa en su celda exterior y sigue moviendose en esta misma llamada.
  if ( !g.released ) {
    if ( game.frame < RELEASE_FRAMES[ g.kind ] ) return;
    const exit = GHOST_EXITS[ g.kind ];
    g.x = exit.x;
    g.y = exit.y;
    g.dir = 'up';
    g.released = true;
  }

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Tras perder una vida los cuatro reaparecen ya en el mapa, en su celda de
  // salida y sin volver a esperar turno en la jaula (spec 02).
  // El susto termina y la cadena de puntos vuelve a 0 (spec 03).
  game.frightFrames = 0;
  game.ghostsEaten = 0;
  game.ghosts.forEach( ( g ) => {
    const exit = GHOST_EXITS[ g.kind ];
    g.x = exit.x;
    g.y = exit.y;
    g.dir = 'up';
    g.released = true;
    g.eaten = false;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.frame++;

  // Cuenta atras del susto (spec 03). Al llegar a 0, los comidos reaparecen en
  // su celda de salida y vuelven a su color y reglas normales.
  if ( game.frightFrames > 0 ) {
    game.frightFrames--;
    if ( game.frightFrames === 0 ) {
      game.ghosts.forEach( ( g ) => {
        if ( !g.eaten ) return;
        const exit = GHOST_EXITS[ g.kind ];
        g.x = exit.x;
        g.y = exit.y;
        g.dir = 'up';
        g.eaten = false;
        g.released = true;
      } );
    }
  }

  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( g.eaten ) continue;
    if ( !collides( game.pacman, g ) ) continue;

    // Durante el susto el fantasma es comestible: cadena 200/400/800/1600 y
    // vuelve a la pen sin costar vida (spec 03).
    if ( game.frightFrames > 0 ) {
      game.score += GHOST_SCORES[ game.ghostsEaten ];
      game.ghostsEaten++;
      const start = GHOST_STARTS.find( ( s ) => s.kind === g.kind );
      g.x = start.x;
      g.y = start.y;
      g.dir = 'up';
      g.eaten = true;
      g.released = false;
      continue;
    }

    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
