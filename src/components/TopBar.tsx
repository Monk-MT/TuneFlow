import { Avatar, Button, Space, Typography, Dropdown, App as AntApp } from 'antd'
import { UserOutlined, PlusOutlined, ImportOutlined } from '@ant-design/icons'
import { useStore, selectAddableSongIds } from '../store/useStore'

export default function TopBar(): JSX.Element {
  const { message, modal } = AntApp.useApp()
  const auth = useStore((s) => s.auth)
  const items = useStore((s) => s.items)
  const openModal = useStore((s) => s.openModal)
  const setAuth = useStore((s) => s.setAuth)

  const requireLogin = (next: () => void): void => {
    if (!auth.loggedIn) {
      message.warning('请先登录')
      openModal('auth')
      return
    }
    next()
  }

  const onImport = (): void => {
    requireLogin(() => {
      const hasSelectable = selectAddableSongIds(items).length > 0
      if (!hasSelectable) {
        message.warning('没有可导入的歌曲，请先录入并匹配')
        return
      }
      openModal('playlist')
    })
  }

  const logout = async (): Promise<void> => {
    await window.api.auth.logout()
    setAuth({ loggedIn: false })
    message.success('已退出登录')
    openModal('auth')
  }

  return (
    <div
      style={{
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        background: '#c20c0c',
        color: '#fff'
      }}
    >
      <Typography.Text strong style={{ color: '#fff', fontSize: 16 }}>
        网易云音乐批量加歌工具
      </Typography.Text>
      <Space>
        <Button icon={<PlusOutlined />} onClick={() => requireLogin(() => openModal('import'))}>
          录入歌曲
        </Button>
        <Button icon={<ImportOutlined />} onClick={onImport} style={{ color: '#c20c0c' }}>
          导入到歌单
        </Button>
        {auth.loggedIn ? (
          <Dropdown
            menu={{
              items: [{ key: 'logout', label: '退出登录' }],
              onClick: () => modal.confirm({ title: '确认退出登录？', onOk: logout })
            }}
          >
            <Space style={{ cursor: 'pointer', color: '#fff' }}>
              <Avatar size="small" src={auth.avatarUrl} icon={<UserOutlined />} />
              {auth.nickname}
            </Space>
          </Dropdown>
        ) : (
          <Button onClick={() => openModal('auth')}>登录</Button>
        )}
      </Space>
    </div>
  )
}
