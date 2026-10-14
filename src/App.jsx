import { useCallback, useMemo, useState } from 'react'
import { useWorld } from './state/WorldContext.jsx'
import { applyResult, completeRound, nextUserFixture } from './game/season.js'
import MainMenu from './screens/MainMenu.jsx'
import TeamSelect from './screens/TeamSelect.jsx'
import FriendlySetup from './screens/FriendlySetup.jsx'
import Prematch from './screens/Prematch.jsx'
import MatchScreen from './screens/MatchScreen.jsx'
import Hub from './screens/Hub.jsx'
import TeamsScreen from './screens/TeamsScreen.jsx'
import TeamEditor from './screens/TeamEditor.jsx'
import PixelStudio from './screens/PixelStudio.jsx'

function MatchRoute({ params, nav }) {
  const { world, update } = useWorld()
  // Freeze a copy of both teams for the whole match.
  const [home, away] = useMemo(
    () => [params.homeId, params.awayId].map((id) => structuredClone(world.teams.find((t) => t.id === id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params.homeId, params.awayId, params.seed],
  )
  const onFinish = useCallback(
    (result) => {
      if (params.mode === 'career') {
        update((w) => {
          const c = w.career
          const fx = nextUserFixture(c)
          if (!fx || fx.result) return
          applyResult(w, c, fx, result)
          c.lastResult = { fixtureId: fx.id }
          completeRound(w, c)
        })
        nav('hub')
      } else nav('menu')
    },
    [params.mode, update, nav],
  )
  if (!home || !away) return null
  const title = params.mode === 'career' ? `${world.career?.name} · Jornada ${(world.career?.current ?? 0) + 1}` : 'Partido amistoso'
  return <MatchScreen key={params.seed} home={home} away={away} userSide={params.userSide} seed={params.seed} title={title} onFinish={onFinish} />
}

export default function App() {
  const [route, setRoute] = useState({ screen: 'menu', params: {} })
  const nav = useCallback((screen, params = {}) => {
    setRoute({ screen, params })
    window.scrollTo(0, 0)
  }, [])
  const { screen, params } = route
  switch (screen) {
    case 'select':
      return <TeamSelect nav={nav} />
    case 'friendly':
      return <FriendlySetup nav={nav} />
    case 'prematch':
      return <Prematch nav={nav} params={params} />
    case 'match':
      return <MatchRoute nav={nav} params={params} />
    case 'hub':
      return <Hub nav={nav} />
    case 'teams':
      return <TeamsScreen nav={nav} />
    case 'teamEdit':
      return <TeamEditor nav={nav} params={params} />
    case 'studio':
      return <PixelStudio nav={nav} />
    default:
      return <MainMenu nav={nav} />
  }
}
