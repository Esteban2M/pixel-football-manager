# Pixel Football Manager ⚽🎨

A browser football-manager game with pixel art, built with React + Vite.
This first version is a playable prototype for testing gameplay and mechanics.
It runs entirely locally: there is no backend, and all data is saved in your browser (`localStorage`).

It ships with the **Liga MX Apertura 2026** squads of **Cruz Azul** and **América**. You can create more teams and players and draw them yourself in the built-in Pixel Art Creator.

## Run it

```bash
npm install
npm run dev        # open http://localhost:5173
npm test           # unit tests (engine, fixtures, pixel tools)
npm run sim -- 50  # simulate 50 matches and print average stats (add --diag for more)
npm run build      # production build in dist/
```

## What you can do

| Mode | What it does |
| --- | --- |
| **New season** | Pick a club and play a league against every team in the editor. With only the two base teams it is a 6-match series (3 home, 3 away). |
| **Friendly** | Any two teams. You can manage either side or just watch. |
| **Team editor** | Create clubs with their own colours, kits (5 patterns), crest and a generated 23-player squad. You can edit, add and delete players and attributes. |
| **Pixel Art Studio** | A free-drawing pixel editor with a gallery. You can assign a drawing as a club crest or a player portrait, or export it as a PNG. |

### Tactical roles

Every slot has a **position** (where the player stands) and a **role** (what he does from there). There are 24 roles, modelled on modern tactical vocabulary:

| Position | Roles |
| --- | --- |
| Goalkeeper | Portero, Portero líbero (sweeper keeper) |
| Centre-back | Central, Central con salida (ball-playing), Central de cobertura (cover) |
| Full-back | Lateral, Carrilero (wing-back), Lateral invertido, Lateral defensivo |
| Defensive mid | Ancla (anchor), Regista, Recuperador (ball winner) |
| Central mid | Box to box, Mezzala, Organizador (playmaker) |
| Attacking mid | Enganche (classic 10), Mediapunta llegador (shadow striker) |
| Wide | Extremo (winger), Extremo invertido (inside forward), Extremo defensivo |
| Striker | Delantero centro, Ariete (target man), Cazagoles (poacher), Falso 9, Delantero presionante |

In the match engine (`src/game/roles.js`), a role changes how high and how wide the player stands, how often he makes runs, how eagerly he presses and how much stamina he uses. It also biases his decisions toward shooting, dribbling, forward and long passes, or crosses, and target men get an aerial bonus. Every player has a **preferred role** (★), which gives a small boost when he plays it. A suitability score (0-99) shows how well a player fits each role. The auto-lineup considers roles too, using a greedy pick followed by pairwise-swap local search.

### Managing

- **Tactics:** 5 formations (4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 5-3-2), plus mentality, pressing, tempo and width. To build the lineup, tap a slot, then tap another slot or a player.
- **During the match:** you can change tactics, make up to 5 substitutions, and give a team talk at half-time that affects morale. Speeds are ×1/×2/×4/×8, the camera can zoom and follow the ball, shirt numbers can be shown, and you can simulate the rest of the match.
- **Between matches:** players carry fitness (condition), morale, injuries and suspensions over to the next game. Season stats are tracked (apps, goals, assists, average rating), along with the league table, top scorers and news.

## How the match engine works

`src/game/engine/` is a fixed-timestep (20 Hz) 2D simulation of 22 agents and a ball. The same code drives the live pixel view and the instant results, and a seed makes every match reproducible.

- **Positioning:** each player has a formation slot. The team shape shifts with the ball, and tactics change its height, width and compactness. Defenders man-mark through a greedy assignment, the nearest players press, and forwards time runs behind the offside line.
- **Decisions:** the ball carrier scores every option and picks the best one. The options are shoot (simple xG model), pass to each teammate (interception risk along the passing lane), dribble, cross and clear.
- **Physics and rules:** the ball rolls with friction and has height for lofted passes and crosses, so headers happen. The engine also handles tackles, fouls, cards, penalties, offside, corners, throw-ins, goal kicks, keeper dives and saves, and fatigue.
- **Calibration:** across many simulated matches the averages are about 3 goals, 18 shots, ~79% pass accuracy and ~68% saves per game (`npm run sim`).

Player attributes use the classic 1-20 scale: pace, stamina, strength, passing, dribbling, finishing, tackling, positioning and goalkeeping.

## Algorithms worth reading

| Algorithm | Where |
| --- | --- |
| Round-robin scheduling (circle method) | `src/game/season.js` → `roundRobin` |
| Seeded PRNG (mulberry32) | `src/game/rng.js` |
| Flood fill (BFS) | `src/pixel/grid.js` → `floodFill` |
| Bresenham line rasterisation | `src/pixel/grid.js` → `linePoints` |
| Midpoint circle algorithm | `src/pixel/pitchRenderer.js` → `circlePoints` |
| Greedy assignment (lineups, man-marking) | `src/game/team.js`, `src/game/engine/ai.js` |
| Steering / arrive behaviour | `src/game/engine/match.js` → `moveAgent` |
| Point-to-segment distance (passing lanes) | `src/game/engine/geometry.js` |

## Project layout

```
src/
  data/        squads (teams.js), crests, name pools
  game/        players, formations, lineups, season, storage
    engine/    match simulation: match.js (rules/physics), ai.js (decisions), geometry, commentary
  pixel/       pixel grids, procedural sprites, pitch renderer, palettes
  components/  PixelEditor, TacticsBoard, PlayerModal, SquadTable…
  screens/     menu, hub, prematch, match, team editor, pixel studio
scripts/simulate.js   headless batch simulation for tuning
```

## About the data

- **Rosters:** these are the squads registered for the Apertura 2026, as published by the clubs and the press up to September/October 2026, with shirt numbers. América's late additions are included: Carlos Álvarez, Óscar Perea, Edwin Cerrillo and Miguel Borja. The coaches are Joel Huiqui (Cruz Azul) and Guillermo Almada (América). Known long-term injuries are modelled: Malagón (Achilles) and Dávila (ACL).
- **Attributes:** these are gameplay estimates, not official ratings. Edit them freely.
- **Physique:** heights come from ESPN's 2026-27 squad pages, and a few marked `~` in `teams.js` are estimates. Height and strength determine the sprite's size and build. Height also matters in aerial duels.
- **Looks:** skin tone, hair and beard approximate each player's real appearance. They are approximations, so refine them in the player editor or paint a full portrait in the Pixel Art Creator.
- **Crests:** the crests are simple pixel designs inspired by each club's colours.

Club names and squads belong to their respective owners. This is a non-commercial fan prototype.
