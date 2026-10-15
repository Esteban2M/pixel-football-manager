# Pixel Football Manager ⚽🎨

A browser football-manager game with pixel art, built with React + Vite.
This first version is a playable prototype for testing gameplay and mechanics.
It runs entirely locally: there is no backend, and all data is saved in your browser (`localStorage`).

It ships with the **Liga MX Apertura 2026**: all 18 clubs and its real format (17 matchdays plus a two-legged Liguilla for the top 8). Cruz Azul and América have their real squads, while the other 16 clubs have generated squads (see *About the data*). Everything is customisable and portable: leagues and formats are configurable, and teams, leagues, formats or the whole world can be **imported and exported as JSON**.

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
| **New season** | Pick a competition (Liga MX Apertura 2026, Copa Pixel MX or any league you create or import), then a club. |
| **Leagues & tournaments** | Create or edit competitions by choosing the teams, a format preset, and the details of each stage. A live preview shows how many matchdays and matches the format produces. |
| **Import / export JSON** | Load teams, leagues, formats or a full backup from a `.json` file. The data is validated first, with clear messages, and anything can be exported. |
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

## League formats

A competition is a list of **stages**. Each stage is one of the following:

- `league`: round robin, played 1-4 times, with optional groups, a table split, or points carried over (optionally halved).
- `swiss`: a Swiss-system phase.
- `knockout`: single match, two legs or best of three. Ties are broken by better seed, penalties or away goals. Byes and reseeding are automatic.

Teams move between stages with `qualify: { top }`, `{ perGroup }` or `{ from, to }`.

The built-in presets cover the most common real formats:

| Preset | How it works |
| --- | --- |
| `liga-mx` | Apertura 2026: single round robin, then the top 8 play the Liguilla (1v8, 2v7…, two legs). The better seed goes through on aggregate in the QF/SF, and the final goes to penalties. There is no Play-In from 2026. |
| `liga-mx-playin` | The 2021-2025 Liga MX format with a Play-In (simplified). |
| `premier-league`, `laliga`, `serie-a`, `bundesliga` | Double round robin with each league's tie-breakers. LaLiga and Serie A use head-to-head first. |
| `scotland` | Three rounds, then the table splits into top and bottom halves that keep their points. |
| `belgium` | The top 6 go into a championship play-off starting with half their points. |
| `mls` | Two conferences, then playoffs with a best-of-three first round. |
| `argentina` | Two zones, then a single-match knockout (1st vs 8th of the other zone). |
| `champions-league` | An 8-game Swiss league phase. Places 1-8 go straight to the round of 16 and places 9-24 play a playoff round. |
| `world-cup` | Groups of 4, then knockout rounds. |
| `cup` | Straight knockout. |

Matches the user does not watch run through a fast statistical simulation (Poisson goals from attack vs. defence ratings). That way a 380-match Premier League season takes milliseconds. A league can switch to the full engine instead.

## JSON import / export

Every document has a `type`:

| `type` | Contents |
| --- | --- |
| `pfm-team` | `{ "team": { ... } }` |
| `pfm-teams` | `{ "teams": [ ... ] }` |
| `pfm-league` | `{ "league": { "name", "format", "teams": [ids, names or short names], "sim" }, "teams": [optional full teams] }` |
| `pfm-format` | `{ "format": { "points", "tiebreakers", "zones", "stages": [ ... ] } }` |
| `pfm-world` | A full backup that replaces everything. |

The importer is forgiving. Only `name` is required for a team and for each player; everything else is optional and gets generated if it is missing:

```json
{
  "type": "pfm-team",
  "team": {
    "name": "Pixel FC", "short": "PFC", "coach": "Tú",
    "colors": { "primary": "#7e2553", "secondary": "#ffec27" },
    "formation": "4-3-3",
    "tactics": { "mentality": 1, "pressing": 2, "tempo": 1, "width": 1 },
    "quality": 12,
    "crest": { "rows": ["..YY..", ".YPPY.", "YPPPPY"], "palette": { "Y": "#ffec27", "P": "#7e2553" } },
    "players": [
      { "name": "Goleador", "number": 9, "position": "DC", "rating": 78, "role": "ST_POACHER", "height": 186 },
      { "name": "El Diez", "number": 10, "position": "MCO", "attributes": { "passing": 18, "dribbling": 16 },
        "appearance": { "skin": 2, "hair": 3, "hairColor": 0, "beard": 1 } }
    ]
  }
}
```

The fields work like this:

- **Positions:** Spanish or English codes (`POR/GK, DFC/CB, LI/LB, LD/RB, MCD/DM, MC/CM, MCO/AM, EI/LW, ED/RW, DC/ST`).
- **Attributes:** use the 1-20 scale. Any missing attribute is generated from `rating` (1-99) or from the team's `quality`.
- **Squad size:** a squad with fewer than 16 players is topped up with generated ones.
- **Images:** crests and portraits accept `{ w, h, px }` or the compact `{ rows, palette }` form.

Exported teams re-import without losing anything. The in-app **Import / export** screen has examples and a quick reference.

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
  game/        players, formations, roles, lineups, storage
    competition.js  stage engine (league / split / swiss / knockout)
    formats.js      format presets + validation
    season.js       career on top of a competition
    quicksim.js     fast statistical simulation + penalty shoot-outs
    io.js           JSON import / export
    engine/    match simulation: match.js (rules/physics), ai.js (decisions), geometry, commentary
  pixel/       pixel grids, procedural sprites, pitch renderer, palettes
  components/  PixelEditor, TacticsBoard, PlayerModal, SquadTable…
  screens/     menu, hub, prematch, match, team editor, pixel studio
scripts/simulate.js   headless batch simulation for tuning
```

## About the data

- **Liga MX clubs:** all 18 Apertura 2026 teams are included; Atlante replaces Mazatlán FC. Names, colours, nicknames and coaches at the start of the tournament are real. Atlas's and Santos's coaches were reported inconsistently by the press.
- **Real squads of the other 16 clubs:** they live in `src/data/ligamx-rosters.js`, a `pfm-teams` JSON document. The game loads it through the same importer you use, and you can download it from *Import / export*. Sources are TV Azteca, Mediotiempo, Informador, El Siglo de Torreón, Infobae, SI, Excelsior, Récord, VAVEL and fichajes.com, as of July–October 2026. Each club is tagged with a `confidence` level:
  - `alta`: Chivas, Atlas, Santos, Querétaro and Atlante. These match a published squad list.
  - `media`: Toluca, Tigres, Monterrey, Pachuca, Pumas and Tijuana. These have the core squad plus confirmed signings, and may still include someone who has left.
  - `parcial`: León, Necaxa, San Luis, Juárez and Puebla. Only a handful of names could be verified, so the squad is topped up to 22 with generated players a little below the club's level.

  Ratings are gameplay estimates. Shirt numbers only appear where they were reported, and age and height are defaults. Correct or complete the squads by editing that JSON and re-importing it.
- **Rosters:** these are the squads registered for the Apertura 2026, as published by the clubs and the press up to September/October 2026, with shirt numbers. América's late additions are included: Carlos Álvarez, Óscar Perea, Edwin Cerrillo and Miguel Borja. The coaches are Joel Huiqui (Cruz Azul) and Guillermo Almada (América). Known long-term injuries are modelled: Malagón (Achilles) and Dávila (ACL).
- **Attributes:** these are gameplay estimates, not official ratings. Edit them freely.
- **Physique:** heights come from ESPN's 2026-27 squad pages, and a few marked `~` in `teams.js` are estimates. Height and strength determine the sprite's size and build. Height also matters in aerial duels.
- **Looks:** skin tone, hair and beard approximate each player's real appearance. They are approximations, so refine them in the player editor or paint a full portrait in the Pixel Art Creator.
- **Crests:** the crests are simple pixel designs inspired by each club's colours.

Club names and squads belong to their respective owners. This is a non-commercial fan prototype.
