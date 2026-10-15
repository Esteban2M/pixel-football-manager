// Long-run balance check for career mode: plays N seasons headless and prints budgets,
// squad strength and champions. Usage: node scripts/economy.js [seasons] [club]
import { createWorld } from '../src/game/storage.js'
import { createCareer, completeRound, startNextSeason, takeJob } from '../src/game/season.js'
import { teamStrength } from '../src/game/team.js'
import { overall } from '../src/game/player.js'

const seasons = Number(process.argv[2] ?? 20)
const club = process.argv[3] ?? 'cruz-azul'
const w = createWorld()
const c = createCareer(w, 'liga-mx-a26', club)
const start = Object.fromEntries(w.teams.map((t) => [t.id, t.finances.budget]))
const champions = {}
const median = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)]
const fmt = (v) => v.toFixed(1).padStart(6)

console.log('season          | budget max  med   min | strength max  med  min | avg ovr top-11 | champion')
for (let s = 0; s < seasons; s++) {
  for (let g = 0; g < 100 && !c.finished; g++) completeRound(w, c)
  champions[c.competition.champion] = (champions[c.competition.champion] ?? 0) + 1
  const budgets = w.teams.map((t) => t.finances.budget)
  const str = w.teams.map(teamStrength)
  const top11 = w.teams.map((t) => {
    const o = t.players.map(overall).sort((a, b) => b - a).slice(0, 11)
    return o.reduce((x, y) => x + y, 0) / o.length
  })
  console.log(
    `${c.seasonLabel.padEnd(15)} | ${fmt(Math.max(...budgets))} ${fmt(median(budgets))} ${fmt(Math.min(...budgets))} | ${String(Math.max(...str)).padStart(4)} ${String(median(str)).padStart(4)} ${String(Math.min(...str)).padStart(4)} | ${fmt(top11.reduce((a, b) => a + b, 0) / top11.length)} | ${c.competition.champion}`,
  )
  if (c.sacked && c.jobOffers.length) takeJob(w, c, c.jobOffers[0].teamId)
  if (c.sacked) break
  startNextSeason(w, c)
}
console.log('\nChampions:', Object.entries(champions).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '))
console.log('Budget vs start (×):', w.teams.map((t) => `${t.short} ${(t.finances.budget / start[t.id]).toFixed(1)}`).join('  '))
