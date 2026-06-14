import { useState } from 'react'
import { Modal, Input, Typography, Alert, Segmented, Space, Button, App as AntApp } from 'antd'
import { ScanOutlined } from '@ant-design/icons'
import { useStore } from '../store/useStore'
import type { ProviderType } from '@shared/types'

type LoginTab = 'qr' | 'cookie'

export default function AuthModal(): JSX.Element {
  const { message } = AntApp.useApp()
  const activeModal = useStore((s) => s.activeModal)
  const closeModal = useStore((s) => s.closeModal)
  const setAuth = useStore((s) => s.setAuth)
  const provider = useStore((s) => s.provider)
  const setProvider = useStore((s) => s.setProvider)

  const [tab, setTab] = useState<LoginTab>('qr')
  const [cookie, setCookie] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)

  const open = activeModal === 'auth'

  const onProviderChange = async (p: ProviderType): Promise<void> => {
    await window.api.config.setProvider(p)
    setProvider(p)
  }

  // 方案一：打开网易云官方登录页扫码，成功后自动捕获 Cookie
  const onScanLogin = async (): Promise<void> => {
    setScanning(true)
    try {
      const state = await window.api.auth.loginByWindow()
      if (state.loggedIn) {
        setAuth(state)
        message.success(`已登录：${state.nickname}`)
        closeModal()
      } else {
        message.info('未完成登录（窗口已关闭或超时）')
      }
    } catch (e) {
      message.error(`登录失败：${String(e)}`)
    } finally {
      setScanning(false)
    }
  }

  const onCookieLogin = async (): Promise<void> => {
    if (!cookie.trim()) {
      message.warning('请粘贴登录 Cookie')
      return
    }
    setLoading(true)
    try {
      const state = await window.api.auth.login({ cookie: cookie.trim() })
      if (state.loggedIn) {
        setAuth(state)
        message.success(`已登录：${state.nickname}`)
        closeModal()
      } else {
        message.error('登录失败，请检查 Cookie 是否有效')
      }
    } catch (e) {
      message.error(`登录失败：${String(e)}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="授权登录"
      open={open}
      footer={tab === 'cookie' && provider === 'community' ? undefined : null}
      onOk={onCookieLogin}
      okText="登录"
      confirmLoading={loading}
      onCancel={closeModal}
      maskClosable={false}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <Typography.Text type="secondary">接口方案</Typography.Text>
          <br />
          <Segmented
            value={provider}
            onChange={(v) => onProviderChange(v as ProviderType)}
            options={[
              { label: '社区接口（可用）', value: 'community' },
              { label: '官方平台（待确认）', value: 'official' }
            ]}
          />
        </div>

        {provider === 'official' ? (
          <Alert
            type="warning"
            message="官方开放平台「写入歌单」能力为 M0 待确认项，暂不可用。请选择社区接口。"
          />
        ) : (
          <>
            <Segmented
              block
              value={tab}
              onChange={(v) => setTab(v as LoginTab)}
              options={[
                { label: '扫码登录', value: 'qr' },
                { label: 'Cookie 登录', value: 'cookie' }
              ]}
            />

            {tab === 'qr' ? (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <Alert
                  type="info"
                  showIcon
                  message="将打开网易云官方登录页"
                  description="点击下方按钮会弹出网易云音乐官方登录页，用手机 App 扫码并确认后，工具会自动捕获登录凭证。此方式走真实浏览器登录，可规避网页模拟扫码的风控拦截。"
                  style={{ textAlign: 'left', marginBottom: 16 }}
                />
                <Button
                  type="primary"
                  size="large"
                  icon={<ScanOutlined />}
                  loading={scanning}
                  onClick={onScanLogin}
                >
                  {scanning ? '等待扫码登录…' : '打开扫码登录'}
                </Button>
                <div style={{ marginTop: 12 }}>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    登录凭证仅加密保存在本地，不上传。
                  </Typography.Text>
                </div>
              </div>
            ) : (
              <>
                <Alert
                  type="info"
                  message="Cookie 登录"
                  description="在浏览器登录 music.163.com 后，从开发者工具复制 Cookie（需包含 MUSIC_U）。凭证仅加密保存在本地，不上传。"
                />
                <Input.TextArea
                  rows={4}
                  placeholder="粘贴 Cookie，例如：MUSIC_U=xxx; __csrf=xxx; ..."
                  value={cookie}
                  onChange={(e) => setCookie(e.target.value)}
                />
              </>
            )}
          </>
        )}
      </Space>
    </Modal>
  )
}
