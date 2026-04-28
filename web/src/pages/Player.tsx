import React, { useState, useRef, useEffect, useCallback, createContext, useContext } from 'react'
import { Input, Empty, message, Modal } from 'antd'
import { PlayCircleOutlined, SearchOutlined, CloseCircleFilled } from '@ant-design/icons'
import Artplayer from 'artplayer'
import { formatCount } from '../utils/format'

const QUALITY_OPTIONS = [
  { qn: 120, label: '4K' },
  { qn: 116, label: '1080P60' },
  { qn: 112, label: '1080P+' },
  { qn: 80, label: '1080P' },
  { qn: 64, label: '720P' },
]

interface VideoInfo {
  bvid: string
  title?: string
  uploaderName?: string
  viewCount?: number
}

interface VideoModalContextType {
  open: (video: VideoInfo) => void
}

const VideoModalContext = createContext<VideoModalContextType>({ open: () => {} })
export const useVideoModal = () => useContext(VideoModalContext)

export const VideoModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [video, setVideo] = useState<VideoInfo | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const artRef = useRef<HTMLDivElement>(null)
  const artInstance = useRef<Artplayer | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const destroyArt = useCallback(() => {
    if (artInstance.current) {
      localStorage.setItem('bili-volume', String(artInstance.current.volume))
      artInstance.current.destroy()
      artInstance.current = null
    }
  }, [])

  const initArt = useCallback(() => {
    const container = artRef.current
    if (!video?.bvid || !container) return

    setTimeout(async () => {
      if (!artRef.current) return

      setLoading(true)
      setError('')

      destroyArt()

      try {
        const bvid = video.bvid
        const makeStreamUrl = (qn: number) => `/api/v1/player/stream?bvid=${bvid}&qn=${qn}`

        const art = new Artplayer({
          container: artRef.current!,
          url: makeStreamUrl(80),
          volume: parseFloat(localStorage.getItem('bili-volume') || '0.5'),
          autoplay: true,
          fullscreen: true,
          fullscreenWeb: true,
          miniProgressBar: true,
          mutex: true,
          theme: '#FB7299',
          lang: 'zh-cn',
          quality: QUALITY_OPTIONS.map((o) => ({
            html: o.label,
            url: makeStreamUrl(o.qn),
            default: o.qn === 80,
          })),
        })

        art.on('video:canplay', () => setLoading(false))
        art.on('video:error', () => {
          setError('视频加载失败，可能需要配置 SESSDATA Cookie 或检查网络连接')
          setLoading(false)
        })

        artInstance.current = art
      } catch {
        setError('播放器初始化失败')
        setLoading(false)
      }
    }, 50)
  }, [video, destroyArt])

  const handleOpen = useCallback((v: VideoInfo) => {
    setVideo(v)
    setModalOpen(true)
  }, [])

  const handleClose = useCallback(() => {
    destroyArt()
    setModalOpen(false)
  }, [destroyArt])

  const handleAfterOpenChange = useCallback((open: boolean) => {
    if (open) {
      initArt()
    }
  }, [initArt])

  useEffect(() => {
    return () => { destroyArt() }
  }, [destroyArt])

  return (
    <VideoModalContext.Provider value={{ open: handleOpen }}>
      {children}
      <Modal
        open={modalOpen}
        onCancel={handleClose}
        afterOpenChange={handleAfterOpenChange}
        footer={null}
        destroyOnClose
        className="player-modal"
        width={'90vw'}
        style={{ maxWidth: 1600 }}
        centered
        title={video ? (
          <div className="player-modal__title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PlayCircleOutlined style={{ color: '#FB7299' }} />
            <span className="player-modal__title-text" style={{ fontWeight: 600, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60vw' }}>{video.title || video.bvid}</span>
            {video.uploaderName && (
              <span className="player-modal__meta" style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-secondary)' }}>
                · {video.uploaderName}
              </span>
            )}
            {video.viewCount !== undefined && (
              <span className="player-modal__meta" style={{ fontWeight: 400, fontSize: 13, color: '#FB7299' }}>
                · {formatCount(video.viewCount)} 播放
              </span>
            )}
          </div>
        ) : '视频播放'}
        styles={{ body: { padding: '0 0 16px 0' } }}
      >
        <div style={{ position: 'relative', background: '#000' }}>
          {loading && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.6)', zIndex: 100,
            }}>
              <div style={{ color: '#FB7299', fontSize: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <PlayCircleOutlined spin style={{ fontSize: 24 }} />
                加载中...
              </div>
            </div>
          )}
          <div ref={artRef} style={{ width: '100%', aspectRatio: '16/9' }} />
          {error && (
            <div style={{
              position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)',
              padding: '10px 24px', background: 'rgba(0,0,0,0.85)', color: '#FB7299',
              fontSize: 13, borderRadius: 8, zIndex: 50,
            }}>
              {error}
            </div>
          )}
        </div>
        <div className="player-modal__hint" style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            点击播放器右侧「清晰度」按钮选择（720P / 1080P / 4K）
          </span>
        </div>
      </Modal>
    </VideoModalContext.Provider>
  )
}

const Player: React.FC = () => {
  const [bvid, setBvid] = useState('')
  const [playingBvid, setPlayingBvid] = useState('')
  const [history, setHistory] = useState<{ bvid: string; title: string }[]>([])
  const { open } = useVideoModal()

  useEffect(() => {
    try {
      const saved = localStorage.getItem('bili-player-history')
      if (saved) setHistory(JSON.parse(saved))
    } catch { console.warn('Failed to parse player history from localStorage') }
  }, [])

  const extractBvid = (input: string): string | null => {
    const m = input.match(/BV[a-zA-Z0-9]{6,12}/)
    return m ? m[0] : null
  }

  const handlePlay = () => {
    const extracted = extractBvid(bvid.trim())
    if (!extracted) {
      message.warning('请输入有效的 BV号 或 B站视频链接')
      return
    }
    setPlayingBvid(extracted)
    open({ bvid: extracted })
    const exists = history.find((h) => h.bvid === extracted)
    if (!exists) {
      const next = [{ bvid: extracted, title: extracted }, ...history].slice(0, 20)
      setHistory(next)
      try { localStorage.setItem('bili-player-history', JSON.stringify(next)) } catch { console.warn('Failed to save player history to localStorage') }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className="bili-banner">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PlayCircleOutlined style={{ color: '#FB7299' }} />
          视频播放
        </h2>
        <p>输入BV号或粘贴B站视频链接，后端代理高清播放（最高4K）</p>
      </div>

      <div className="section-card">
        <div style={{ padding: '20px 24px' }}>
          <div className="player-toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Input
              className="player-toolbar__input"
              placeholder="输入 BV号（如 BV1xx411c7mD）或粘贴视频链接"
              prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
              suffix={bvid ? (
                <CloseCircleFilled
                  style={{ color: 'var(--text-muted)', cursor: 'pointer' }}
                  onClick={() => setBvid('')}
                />
              ) : null}
              value={bvid}
              onChange={(e) => setBvid(e.target.value)}
              onPressEnter={handlePlay}
              style={{ flex: 1, height: 44, fontSize: 15, borderRadius: 10 }}
            />
            <button
              className="player-toolbar__button"
              onClick={handlePlay}
              style={{
                height: 44,
                padding: '0 28px',
                borderRadius: 10,
                border: 'none',
                background: 'linear-gradient(135deg, #FB7299 0%, #e8456b 100%)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(251,114,153,0.3)',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(251,114,153,0.4)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(251,114,153,0.3)' }}
            >
              播放
            </button>
          </div>

          {history.length > 0 && (
            <div className="player-history" style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <span className="player-history__label" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: '28px', marginRight: 4 }}>最近播放：</span>
              {history.slice(0, 10).map((h) => (
                <span
                  key={h.bvid}
                  className="partition-tag player-history__chip"
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => { setBvid(h.bvid); setPlayingBvid(h.bvid); open({ bvid: h.bvid }) }}
                >
                  {h.bvid}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {!playingBvid && (
        <div className="section-card" style={{ padding: '80px 24px', textAlign: 'center' }}>
          <Empty
            image={<PlayCircleOutlined style={{ fontSize: 64, color: 'var(--text-muted)', opacity: 0.3 }} />}
            description={<span style={{ color: 'var(--text-muted)' }}>输入BV号开始播放视频</span>}
          />
        </div>
      )}
    </div>
  )
}

export default Player
