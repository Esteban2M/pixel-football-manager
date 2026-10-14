// Seeded pseudo-random number generator (mulberry32).
// Same seed -> same sequence, so a match can be replayed exactly.

export function createRng(seed = Date.now()) {
  let a = hashSeed(seed) >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    int: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    // Approximately normal (sum of uniforms), mean 0, std ~1.
    gauss: () => (next() + next() + next() + next() + next() + next() - 3) * 1.414,
  }
}

export function hashSeed(seed) {
  if (typeof seed === 'number') return seed | 0
  let h = 2166136261
  for (const ch of String(seed)) {
    h ^= ch.charCodeAt(0)
    h = Math.imul(h, 16777619)
  }
  return h | 0
}
