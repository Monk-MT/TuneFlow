import { useState } from 'react'
import {
  Modal,
  Segmented,
  Input,
  Button,
  Upload,
  Space,
  Typography,
  Spin,
  App as AntApp
} from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import { useStore } from '../store/useStore'
import { selectAddableSongIds } from '../store/useStore'
import type { EntryMode, MatchItem, AlbumRow, ParsedEntry } from '@shared/types'

const MAX_TOTAL = 500

export default function ImportModal(): JSX.Element {
  const { message } = AntApp.useApp()
  const activeModal = useStore((s) => s.activeModal)
  const closeModal = useStore((s) => s.closeModal)
  const items = useStore((s) => s.items)
  const addItems = useStore((s) => s.addItems)
  const addAlbumRows = useStore((s) => s.addAlbumRows)

  const [mode, setMode] = useState<EntryMode>('song')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  const open = activeModal === 'import'

  const reset = (): void => {
    setText('')
  }

  // 当前已占用的曲目数（单曲计 1，专辑计其曲目数）
  const currentCount = (): number => selectAddableSongIds(items).length

  const checkLimit = (incoming: number): boolean => {
    const cur = currentCount()
    if (cur + incoming > MAX_TOTAL) {
      message.warning(`超出单次上限 ${MAX_TOTAL} 首（当前 ${cur}，新增 ${incoming}）`)
      return false
    }
    return true
  }

  // 单曲模式：解析 → 搜索匹配 → 入列表
  const onSubmitSongs = async (): Promise<void> => {
    if (!text.trim()) {
      message.warning('请输入歌曲')
      return
    }
    setLoading(true)
    try {
      const entries: ParsedEntry[] = await window.api.import.parseText(text, 'song')
      if (!checkLimit(entries.length)) return
      const matched: MatchItem[] = await window.api.match.searchBatch(entries)
      addItems(matched)
      message.success(`已录入 ${matched.length} 首`)
      reset()
      closeModal()
    } catch (e) {
      message.error(`录入失败：${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  // 专辑模式：批量专辑名 → 搜索候选、自动选首个并展开 → 入列表为专辑行
  const onSubmitAlbums = async (): Promise<void> => {
    if (!text.trim()) {
      message.warning('请输入专辑名')
      return
    }
    setLoading(true)
    try {
      const names = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
      const rows: AlbumRow[] = await window.api.import.buildAlbumRows(names)
      const trackCount = rows.reduce((n, r) => n + r.tracks.length, 0)
      if (!checkLimit(trackCount)) return
      addAlbumRows(rows)
      message.success(`已录入 ${rows.length} 张专辑，共 ${trackCount} 首`)
      reset()
      closeModal()
    } catch (e) {
      message.error(`录入失败：${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  const onUpload = (file: File): boolean => {
    const reader = new FileReader()
    reader.onload = async () => {
      const content = String(reader.result ?? '')
      setLoading(true)
      try {
        const entries: ParsedEntry[] = await window.api.import.parseFile(content, file.name, mode)
        if (mode === 'song') {
          if (!checkLimit(entries.length)) return
          const matched = await window.api.match.searchBatch(entries)
          addItems(matched)
          message.success(`已从文件录入 ${matched.length} 首`)
          closeModal()
        } else {
          const names = entries.map((e) => e.album ?? e.rawInput)
          const rows = await window.api.import.buildAlbumRows(names)
          const trackCount = rows.reduce((n, r) => n + r.tracks.length, 0)
          if (!checkLimit(trackCount)) return
          addAlbumRows(rows)
          message.success(`已从文件录入 ${rows.length} 张专辑，共 ${trackCount} 首`)
          closeModal()
        }
      } catch (err) {
        message.error(`文件录入失败：${String(err)}`)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsText(file)
    return false
  }

  return (
    <Modal
      title="录入歌曲"
      open={open}
      footer={null}
      onCancel={() => {
        reset()
        closeModal()
      }}
      width={640}
      maskClosable={false}
    >
      <Spin spinning={loading}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Segmented
            block
            value={mode}
            onChange={(v) => {
              setMode(v as EntryMode)
              reset()
            }}
            options={[
              { label: '单曲模式', value: 'song' },
              { label: '专辑模式', value: 'album' }
            ]}
          />

          <Upload.Dragger accept=".txt,.csv" beforeUpload={onUpload} showUploadList={false}>
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p>点击或拖拽 txt / csv 文件到此处</p>
            <Typography.Text type="secondary">
              {mode === 'song'
                ? 'txt：每行「歌名 - 歌手」；csv 列：title/artist/album'
                : 'txt：每行一个专辑名；csv 列：album/artist'}
            </Typography.Text>
          </Upload.Dragger>

          <Input.TextArea
            rows={6}
            placeholder={
              mode === 'song'
                ? '粘贴歌曲，每行一首\n例如：晴天 - 周杰伦'
                : '粘贴专辑名，每行一张\n例如：范特西'
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            type="primary"
            block
            onClick={mode === 'song' ? onSubmitSongs : onSubmitAlbums}
          >
            搜索并录入
          </Button>
        </Space>
      </Spin>
    </Modal>
  )
}
