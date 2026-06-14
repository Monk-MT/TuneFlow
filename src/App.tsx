import { useEffect } from 'react'
import { Layout } from 'antd'
import { useStore } from './store/useStore'
import TopBar from './components/TopBar'
import StatsFilterBar from './components/StatsFilterBar'
import MatchTable from './components/MatchTable'
import EmptyState from './components/EmptyState'
import AuthModal from './modals/AuthModal'
import ImportModal from './modals/ImportModal'
import PlaylistPickModal from './modals/PlaylistPickModal'
import ResultModal from './modals/ResultModal'

export default function App(): JSX.Element {
  const items = useStore((s) => s.items)
  const setAuth = useStore((s) => s.setAuth)
  const setProvider = useStore((s) => s.setProvider)
  const openModal = useStore((s) => s.openModal)

  useEffect(() => {
    void (async () => {
      const [auth, provider] = await Promise.all([
        window.api.auth.getState(),
        window.api.config.getProvider()
      ])
      setAuth(auth)
      setProvider(provider)
      if (!auth.loggedIn) openModal('auth')
    })()
  }, [setAuth, setProvider, openModal])

  return (
    <Layout style={{ height: '100vh' }}>
      <TopBar />
      <Layout.Content style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <StatsFilterBar />
        {items.length === 0 ? <EmptyState /> : <MatchTable />}
      </Layout.Content>
      <AuthModal />
      <ImportModal />
      <PlaylistPickModal />
      <ResultModal />
    </Layout>
  )
}
