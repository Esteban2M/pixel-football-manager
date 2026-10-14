import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { loadWorld, saveWorld, createWorld } from '../game/storage.js'

const WorldCtx = createContext(null)

export function WorldProvider({ children }) {
  const [world, setWorld] = useState(loadWorld)

  useEffect(() => {
    const id = setTimeout(() => saveWorld(world), 250)
    return () => clearTimeout(id)
  }, [world])

  // update(draft => { ...mutate... }) works on a deep copy, so React sees a new object.
  const update = useCallback((fn) => {
    setWorld((w) => {
      const next = structuredClone(w)
      fn(next)
      return next
    })
  }, [])

  const reset = useCallback(() => setWorld(createWorld()), [])

  return <WorldCtx.Provider value={{ world, update, reset }}>{children}</WorldCtx.Provider>
}

export function useWorld() {
  return useContext(WorldCtx)
}
