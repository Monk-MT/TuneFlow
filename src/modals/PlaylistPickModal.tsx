import { useEffect, useState } from 'react'
import { Modal, Input, List, Avatar, Button, Space, Spin, Empty, App as AntApp } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useStore, selectAddableSongIds } from '../store/useStore'
import type { Playlist } from '@shared/types'

export default function PlaylistPickModal(): JSX.Element {
  const { message, modal } = AntApp.useApp()
  const activeModal = useStore((s) => s.activeModal)
  const closeModal = useStore((s) => s.closeModal)
  const openModal = useStore((s) => s.openModal)
  const items = useStore((s) => s.items)
  const setProgress = useStore((s) => s.setProgress)
  const setResult = useStore((s) => s.setResult)

  const [loading, setLoading] = useState(false)
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [kw, setKw] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const open = activeModal === 'playlist'

  useEffect(() => {
    if (!open) return
    void (async () => {
      setLoading(true)
      try {
        setPlaylists(await window.api.playlist.listMine())
      } catch (e) {
        message.error(`获取歌单失败：${String(e)}`)
      } finally {
        setLoading(false)
      }
    })()
  }, [open, message])

  const selectableSongIds = selectAddableSongIds(items)
  const selectableCount = selectableSongIds.length

  const startTask = (playlist: Playlist): void => {
    modal.confirm({
      title: '确认添加',
      content: `将 ${selectableCount} 首歌曲添加到「${playlist.name}」？`,
      onOk: async () => {
        setResult(null)
        setProgress({ phase: 'dedupe', total: selectableCount, succeeded: 0, failed: 0, skipped: 0 })
        openModal('result')
        try {
          const result = await window.api.task.start({
            playlistId: playlist.id,
            songIds: selectableSongIds
          })
          setResult(result)
        } catch (e) {
          message.error(`任务失败：${String(e)}`)
          setProgress({
            phase: 'error',
            total: selectableCount,
            succeeded: 0,
            failed: 0,
            skipped: 0,
            message: String(e)
          })
        }
      }
    })
  }

  const onCreate = async (): Promise<void> => {
    if (!newName.trim()) return
    setLoading(true)
    try {
      const pl = await window.api.playlist.create(newName.trim())
      message.success(`已新建歌单「${pl.name}」`)
      setCreating(false)
      setNewName('')
      setPlaylists((s) => [pl, ...s])
    } catch (e) {
      message.error(`新建失败：${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  const filtered = playlists.filter((p) => p.name.toLowerCase().includes(kw.trim().toLowerCase()))

  return (
    <Modal
      title="选择目标歌单"
      open={open}
      footer={null}
      onCancel={closeModal}
      width={560}
      maskClosable={false}
    >
      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Space.Compact style={{ width: '100%' }}>
            <Input.Search
              placeholder="搜索我的歌单"
              value={kw}
              onChange={(e) => setKw(e.target.value)}
              allowClear
            />
            <Button icon={<PlusOutlined />} onClick={() => setCreating((v) => !v)}>
              新建
            </Button>
          </Space.Compact>

          {creating && (
            <Space.Compact style={{ width: '100%' }}>
              <Input
                placeholder="新歌单名称"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onPressEnter={onCreate}
              />
              <Button type="primary" onClick={onCreate}>
                创建
              </Button>
            </Space.Compact>
          )}

          {filtered.length === 0 ? (
            <Empty description="没有可写歌单" />
          ) : (
            <List
              style={{ maxHeight: 360, overflow: 'auto' }}
              dataSource={filtered}
              renderItem={(p) => (
                <List.Item
                  actions={[
                    <Button key="pick" type="primary" size="small" onClick={() => startTask(p)}>
                      选择
                    </Button>
                  ]}
                >
                  <List.Item.Meta
                    avatar={<Avatar shape="square" src={p.coverUrl} />}
                    title={p.name}
                    description={`${p.trackCount} 首`}
                  />
                </List.Item>
              )}
            />
          )}
        </Space>
      </Spin>
    </Modal>
  )
}
