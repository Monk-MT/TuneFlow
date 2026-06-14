import { useMemo, useState, useRef, useLayoutEffect } from 'react'
import { Table, Tag, Select, Button, Input, Space, App as AntApp } from 'antd'
import { RightOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useStore, selectFilteredItems } from '../store/useStore'
import { isAlbumRow } from '@shared/types'
import type { ListRow, MatchItem, AlbumRow, SongCandidate, MatchStatus } from '@shared/types'

const statusMeta: Record<MatchStatus, { color: string; text: string }> = {
  auto: { color: 'success', text: '已匹配' },
  need_confirm: { color: 'warning', text: '需确认' },
  unmatched: { color: 'error', text: '未匹配' }
}

function fmtDuration(ms: number): string {
  if (!ms) return '-'
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function MatchTable(): JSX.Element {
  const { message } = AntApp.useApp()
  const filtered = useStore(selectFilteredItems)
  const updateItemSelection = useStore((s) => s.updateItemSelection)
  const confirmItem = useStore((s) => s.confirmItem)
  const replaceItemCandidates = useStore((s) => s.replaceItemCandidates)
  const setAlbumSelection = useStore((s) => s.setAlbumSelection)
  const removeItem = useStore((s) => s.removeItem)
  const removeAlbumTrack = useStore((s) => s.removeAlbumTrack)
  const [searching, setSearching] = useState<Record<string, boolean>>({})
  const [switching, setSwitching] = useState<Record<string, boolean>>({})
  const [kwDraft, setKwDraft] = useState<Record<string, string>>({})

  // 动态测量「匹配结果」列相对表格的左偏移，使专辑曲目缩进与之对齐
  const wrapRef = useRef<HTMLDivElement>(null)
  const [trackIndent, setTrackIndent] = useState(0)

  useLayoutEffect(() => {
    const measure = (): void => {
      const wrap = wrapRef.current
      if (!wrap) return
      const target = wrap.querySelector<HTMLElement>('th.col-match-result')
      const table = wrap.querySelector<HTMLElement>('.ant-table-container')
      if (!target || !table) return
      const offset = target.getBoundingClientRect().left - table.getBoundingClientRect().left
      setTrackIndent(offset)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (wrapRef.current) ro.observe(wrapRef.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [filtered.length])

  const onReSearch = async (item: MatchItem): Promise<void> => {
    const kw = (kwDraft[item.id] ?? item.rawInput).trim()
    if (!kw) return
    setSearching((s) => ({ ...s, [item.id]: true }))
    try {
      const cands = await window.api.match.reSearch(item.id, kw)
      replaceItemCandidates(item.id, cands)
      if (cands.length === 0) message.info('仍无结果，换个关键词试试')
    } catch (e) {
      message.error(`搜索失败：${String(e)}`)
    } finally {
      setSearching((s) => ({ ...s, [item.id]: false }))
    }
  }

  // 专辑行切换候选专辑 → 重新拉取曲目
  const onSwitchAlbum = async (row: AlbumRow, albumId: string): Promise<void> => {
    const album = row.albumCandidates.find((a) => a.albumId === albumId)
    if (!album) return
    setSwitching((s) => ({ ...s, [row.id]: true }))
    try {
      const tracks = await window.api.import.getAlbumTracks(albumId)
      setAlbumSelection(row.id, album, tracks)
    } catch (e) {
      message.error(`获取专辑曲目失败：${String(e)}`)
    } finally {
      setSwitching((s) => ({ ...s, [row.id]: false }))
    }
  }

  const candOptions = (item: MatchItem) =>
    item.candidates.map((c: SongCandidate) => ({
      value: c.songId,
      label: `${c.name} - ${c.artists.join('/')} 《${c.album}》 ${fmtDuration(c.durationMs)}`
    }))

  const albumOptions = (row: AlbumRow) =>
    row.albumCandidates.map((a) => ({
      value: a.albumId,
      label: `${a.name} - ${a.artists.join('/')}${a.publishYear ? ` (${a.publishYear})` : ''} · ${a.trackCount} 首`
    }))

  const columns: ColumnsType<ListRow> = useMemo(
    () => [
      {
        title: '输入',
        dataIndex: 'rawInput',
        width: 220,
        render: (_t, row) => (
          <Space direction="vertical" size={0}>
            <span>{row.rawInput}</span>
            {isAlbumRow(row) ? (
              <Tag color="purple" style={{ marginTop: 4 }}>
                专辑 · {row.tracks.length} 首
              </Tag>
            ) : (
              row.sourceTag && (
                <Tag color="blue" style={{ marginTop: 4 }}>
                  {row.sourceTag}
                </Tag>
              )
            )}
          </Space>
        )
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 90,
        render: (st: MatchStatus) => <Tag color={statusMeta[st].color}>{statusMeta[st].text}</Tag>
      },
      {
        title: '匹配结果',
        width: 420,
        className: 'col-match-result',
        render: (_t, row) => {
          if (isAlbumRow(row)) {
            if (row.status === 'unmatched') {
              return <span style={{ color: '#999' }}>未找到专辑，请删除后重新录入</span>
            }
            return (
              <Select
                size="small"
                style={{ width: '100%' }}
                loading={switching[row.id]}
                value={row.selectedAlbum?.albumId}
                options={albumOptions(row)}
                onOpenChange={(open) => {
                  if (!open) confirmItem(row.id)
                }}
                onChange={(albumId) => onSwitchAlbum(row, albumId)}
              />
            )
          }
          if (row.status === 'unmatched') {
            return (
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  size="small"
                  placeholder="重新输入关键词搜索"
                  defaultValue={row.rawInput}
                  onChange={(e) => setKwDraft((s) => ({ ...s, [row.id]: e.target.value }))}
                  onPressEnter={() => onReSearch(row)}
                />
                <Button size="small" loading={searching[row.id]} onClick={() => onReSearch(row)}>
                  搜索
                </Button>
              </Space.Compact>
            )
          }
          return (
            <Select
              size="small"
              style={{ width: '100%' }}
              value={row.selected?.songId}
              options={candOptions(row)}
              onOpenChange={(open) => {
                if (!open) confirmItem(row.id)
              }}
              onChange={(songId) => {
                const cand = row.candidates.find((c) => c.songId === songId)
                if (cand) updateItemSelection(row.id, cand)
              }}
            />
          )
        }
      },
      {
        title: '操作',
        width: 70,
        render: (_t, row) => (
          <Button size="small" type="link" danger onClick={() => removeItem(row.id)}>
            删除
          </Button>
        )
      }
    ],
    [searching, switching, updateItemSelection, confirmItem, removeItem, kwDraft]
  )

  // 专辑行展开区：缩进显示曲目，左侧与「匹配结果」列对齐，支持单曲删除
  const expandedRowRender = (row: ListRow): JSX.Element => {
    if (!isAlbumRow(row)) return <></>
    if (row.tracks.length === 0) {
      return <span style={{ color: '#999', paddingLeft: trackIndent }}>暂无曲目</span>
    }
    return (
      <div style={{ paddingLeft: trackIndent }}>
        {row.tracks.map((t) => (
          <div
            key={t.songId}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 0',
              borderBottom: '1px solid #f5f5f5'
            }}
          >
            <span style={{ color: '#595959' }}>
              {t.name} - {t.artists.join('/')}{' '}
              <span style={{ color: '#bbb' }}>{fmtDuration(t.durationMs)}</span>
            </span>
            <Button
              size="small"
              type="link"
              danger
              onClick={() => removeAlbumTrack(row.id, t.songId)}
            >
              删除
            </Button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div ref={wrapRef} style={{ flex: 1, overflow: 'auto', padding: 16 }}>
      <Table<ListRow>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={filtered}
        pagination={false}
        expandable={{
          expandedRowRender,
          rowExpandable: (row) => isAlbumRow(row) && row.tracks.length > 0,
          expandIcon: ({ expanded, onExpand, record, expandable }) =>
            expandable ? (
              <RightOutlined
                onClick={(e) => onExpand(record, e)}
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)'
                }}
              />
            ) : null
        }}
        scroll={{ x: 800 }}
      />
    </div>
  )
}
