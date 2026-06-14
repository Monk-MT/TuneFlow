import { Space, Tag, Button, App as AntApp } from 'antd'
import { useStore, selectFilteredItems, selectStats } from '../store/useStore'
import { useMemo } from 'react'

export default function StatsFilterBar(): JSX.Element {
  const { message } = AntApp.useApp()
  const items = useStore((s) => s.items)
  const statusFilter = useStore((s) => s.statusFilter)
  const setStatusFilter = useStore((s) => s.setStatusFilter)
  const removeItems = useStore((s) => s.removeItems)

  const stats = useMemo(() => selectStats(items), [items])
  const filtered = useStore(selectFilteredItems)

  const chip = (label: string, value: number, key: typeof statusFilter, color?: string) => (
    <Tag.CheckableTag
      checked={statusFilter === key}
      onChange={() => setStatusFilter(statusFilter === key ? 'all' : key)}
      style={{ fontSize: 13, padding: '2px 10px', border: '1px solid #eee' }}
    >
      <span style={{ color }}>
        {label} {value}
      </span>
    </Tag.CheckableTag>
  )

  const removeFilteredUnmatched = (): void => {
    const ids = filtered.filter((i) => i.status === 'unmatched').map((i) => i.id)
    if (ids.length === 0) {
      message.info('当前筛选结果没有未匹配项')
      return
    }
    removeItems(ids)
    message.success(`已剔除 ${ids.length} 项未匹配`)
  }

  if (items.length === 0) return <></>

  return (
    <div
      style={{
        padding: '10px 16px',
        borderBottom: '1px solid #f0f0f0',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'space-between'
      }}
    >
      <Space size={4} wrap>
        {chip('全部', stats.total, 'all')}
        {chip('已匹配', stats.auto, 'auto', '#52c41a')}
        {chip('需确认', stats.need_confirm, 'need_confirm', '#faad14')}
        {chip('未匹配', stats.unmatched, 'unmatched', '#ff4d4f')}
      </Space>
      <Button size="small" danger onClick={removeFilteredUnmatched}>
        剔除当前未匹配
      </Button>
    </div>
  )
}
