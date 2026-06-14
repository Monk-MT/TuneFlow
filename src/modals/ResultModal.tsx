import { useEffect } from 'react'
import { Modal, Progress, Statistic, Row, Col, Button, Table, Tag, Space, App as AntApp } from 'antd'
import { useStore } from '../store/useStore'
import type { TaskProgress } from '@shared/types'

export default function ResultModal(): JSX.Element {
  const { message } = AntApp.useApp()
  const activeModal = useStore((s) => s.activeModal)
  const closeModal = useStore((s) => s.closeModal)
  const progress = useStore((s) => s.progress)
  const setProgress = useStore((s) => s.setProgress)
  const result = useStore((s) => s.result)
  const items = useStore((s) => s.items)

  const open = activeModal === 'result'
  const running = !!progress && progress.phase !== 'done' && progress.phase !== 'error' && progress.phase !== 'cancelled'

  useEffect(() => {
    const off = window.api.task.onProgress((p: TaskProgress) => setProgress(p))
    return off
  }, [setProgress])

  const done = progress?.phase === 'done' || !!result

  const total = progress?.total ?? 0
  const processed = (progress?.succeeded ?? 0) + (progress?.failed ?? 0) + (progress?.skipped ?? 0)
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0

  const unmatched = items.filter((i) => i.status === 'unmatched')

  const exportFailures = async (): Promise<void> => {
    const rows: Record<string, string>[] = []
    result?.failed.forEach((f) =>
      rows.push({ type: '失败', songId: f.songId, reason: f.reason, input: '' })
    )
    unmatched.forEach((u) => rows.push({ type: '未匹配', songId: '', reason: '无候选', input: u.rawInput }))
    if (rows.length === 0) {
      message.info('没有失败或未匹配项')
      return
    }
    const res = await window.api.report.exportCsv(rows)
    if (res.saved) message.success(`已导出到 ${res.path}`)
  }

  const cancel = async (): Promise<void> => {
    await window.api.task.cancel()
    message.info('已请求取消，当前批完成后停止')
  }

  return (
    <Modal
      title="导入结果"
      open={open}
      maskClosable={false}
      closable={!running}
      keyboard={!running}
      footer={
        running
          ? [
              <Button key="cancel" danger onClick={cancel}>
                取消任务
              </Button>
            ]
          : [
              <Button key="export" onClick={exportFailures}>
                导出失败/未匹配
              </Button>,
              <Button key="close" type="primary" onClick={closeModal}>
                关闭
              </Button>
            ]
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <Progress percent={percent} status={progress?.phase === 'error' ? 'exception' : running ? 'active' : 'success'} />
        <Row gutter={16}>
          <Col span={6}>
            <Statistic title="成功" value={progress?.succeeded ?? 0} valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col span={6}>
            <Statistic title="失败" value={progress?.failed ?? 0} valueStyle={{ color: '#ff4d4f' }} />
          </Col>
          <Col span={6}>
            <Statistic title="已存在" value={progress?.skipped ?? 0} valueStyle={{ color: '#999' }} />
          </Col>
          <Col span={6}>
            <Statistic title="未匹配" value={unmatched.length} valueStyle={{ color: '#faad14' }} />
          </Col>
        </Row>

        {progress?.phase === 'dedupe' && <Tag color="processing">正在去重比对…</Tag>}
        {progress?.message && <Tag color="error">{progress.message}</Tag>}

        {done && result && result.failed.length > 0 && (
          <Table
            size="small"
            rowKey={(r) => r.songId}
            pagination={false}
            scroll={{ y: 160 }}
            dataSource={result.failed}
            columns={[
              { title: '歌曲 ID', dataIndex: 'songId', width: 120 },
              { title: '失败原因', dataIndex: 'reason' }
            ]}
          />
        )}
      </Space>
    </Modal>
  )
}
