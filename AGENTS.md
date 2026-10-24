# AGENTS.md

Arcade Pac-Man clone: vanilla JS + Canvas 2D. No build, no dependencies, no tests.
Run by opening `src/index.html` in a browser (`start src/index.html` on Windows). There is no
package manager, dev server, linter or test command — don't add one to "fix" that gap.

## Architecture you will get wrong by default

- **Globals, not modules.** The four scripts are classic `<script>` tags in `src/index.html` and
  share state via implicit globals plus `window.X = ...` at the bottom of each file
  (`window.createGame`, `window.update`, `window.draw`, `window.MAZE`). Load order
  `maze → game → render → main` is load-bearing. Never introduce `import`/`export` or
  `type="module"`: it breaks `file://` loading and the global contract.
- **Layering.** `maze.js` = immutable data · `game.js` = state and rules (no DOM, no canvas) ·
  `render.js` = drawing only · `main.js` = the only wiring layer (input, rAF loop, overlays).
- **`MAZE` is pristine and must never be mutated.** `createGame()` copies it into `game.grid` and
  dots are eaten from that copy. "Restart" always means calling `createGame()` again.

## Movement model — do not "just tweak" the speeds

- Positions are **cell coordinates as floats**, origin top-left, 28×31. Pixels only exist in
  `render.js` (`TILE = 20`); the canvas must stay `28*20 × 31*20 = 560×620`.
- Speeds are **cells per frame** with **no delta-time** (`PACMAN_SPEED = 0.125`,
  `GHOST_SPEED = 0.1`). Turn decisions, dot pickup and ghost choices run only when `aligned()` is
  true, i.e. exactly at a cell center. A speed whose reciprocal isn't an integer makes actors
  drift past centers: they never align, never turn and stop eating.
- Input only sets `pacman.nextDir` (intent); `movePacman` applies it when the turn becomes legal —
  that is what allows buffering a direction before a corner. Don't move that validation into the
  keydown handler.
- `isWall` is actor-dependent: tile `1` blocks everyone, tile `3` (pen door) blocks **pacman only**.
  Ghosts leaving the pen through the door is intended, not a bug.

## Maze edits

- Exactly 31 strings of exactly 28 chars, parsed by `parseTile` (`#`=1 wall, `.`=2 dot, `-`=3 door,
  space=0). A short/long row silently corrupts the grid because width is read as `grid[0].length`.
- Row 14 is the tunnel (`TUNNEL_ROW`); its ends must stay empty spaces or wrapping stops working.

## Conventions

- Match the existing code style: single quotes, spaces inside parens (`fn( arg )`), 2-space indent;
  comments and UI strings in **Spanish**.
- Keep changes inside the four existing files; adding a new script also means editing
  `index.html` in the right position.

## Spec-driven workflow (the point of this repo)

- The `/spec` skill lives in `.agents/skills/spec/` and is installed from `klerith/fernando-skills`
  (recorded in `skills-lock.json`). Its `template.md` defines the required spec shape. Don't
  hand-edit that skill: the lockfile hash would no longer match.
- Specs go to `specs/NN-slug.md`. `specs/` does not exist yet, so the first one is `01-`. New specs
  start as `Draft`; only the user promotes them to `Approved`.
- The skill refers to `/spec-impl`, which is **not** installed in this repo — implementation is manual.
