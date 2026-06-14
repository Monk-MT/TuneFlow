import { Empty, Button } from 'antd'
import { useStore } from '../store/useStore'

export default function EmptyState(): JSX.Element {
  const openModal = useStore((s) => s.openModal)
  const auth = useStore((s) => s.auth)
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Empty description="还没有录入任何歌曲">
        <Button type="primary" onClick={() => openModal(auth.loggedIn ? 'import' : 'auth')}>
          录入歌曲
        </Button>
      </Empty>
    </div>
  )
}
