// Runs many headless matches and prints average stats, to tune the engine.
// Usage: npm run sim -- [matches]
import { createBaseTeams } from '../src/data/teams.js'
import { simulateMatch } from '../src/game/engine/match.js'

const n = Number(process.argv[2] ?? 100)
const [caz, ame] = createBaseTeams()

const totals = { goals: 0, shots: 0, onTarget: 0, xg: 0, passes: 0, passesOk: 0, corners: 0, fouls: 0, yellows: 0, reds: 0, offsides: 0, saves: 0, tackles: 0 }
const wins = [0, 0, 0]
const scores = {}
let possHome = 0
const diagTotals = {}
const t0 = Date.now()
for (let i = 0; i < n; i++) {
  const [home, away] = i % 2 === 0 ? [caz, ame] : [ame, caz]
  const { result, state } = simulateMatch(home, away, `sim-${i}`)
  for (const [k, v] of Object.entries(state.diag)) diagTotals[k] = (diagTotals[k] ?? 0) + v
  const [h, a] = result.score
  totals.goals += h + a
  wins[h > a ? 0 : h < a ? 2 : 1]++
  const key = `${Math.max(h, a)}-${Math.min(h, a)}`
  scores[key] = (scores[key] ?? 0) + 1
  for (const st of result.stats) for (const k of Object.keys(totals)) if (k !== 'goals') totals[k] += st[k]
  possHome += result.stats[0].possessionPct
}
const per = (v) => (v / n).toFixed(2)
console.log(`${n} matches in ${Date.now() - t0} ms`)
console.log(`goals/match ${per(totals.goals)} | home W/D/L ${wins.join('/')}`)
console.log(`shots ${per(totals.shots)} | on target ${per(totals.onTarget)} | xG ${per(totals.xg)} | saves ${per(totals.saves)}`)
console.log(`passes ${per(totals.passes)} | completion ${((totals.passesOk / totals.passes) * 100).toFixed(1)}% | tackles ${per(totals.tackles)}`)
console.log(`corners ${per(totals.corners)} | fouls ${per(totals.fouls)} | yellows ${per(totals.yellows)} | reds ${per(totals.reds)} | offsides ${per(totals.offsides)}`)
console.log(`home possession ${(possHome / n).toFixed(1)}%`)
console.log('scorelines', Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k}:${v}`).join(' '))
if (process.argv.includes('--diag')) {
  console.log(Object.entries(diagTotals).sort().map(([k, v]) => `${k}=${(v / n).toFixed(1)}`).join('  '))
}
