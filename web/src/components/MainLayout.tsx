import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  DashboardOutlined,
  LineChartOutlined,
  UserOutlined,
  AppstoreOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ThunderboltOutlined,
  FireOutlined,
  PlayCircleOutlined,
  SunOutlined,
  MoonOutlined,
  SearchOutlined,
  PictureOutlined,
  BarChartOutlined,
  SwapOutlined,
  HeartOutlined,
  FundOutlined,
  CalendarOutlined,
  FieldTimeOutlined,
  HistoryOutlined,
  CrownOutlined,
} from '@ant-design/icons'
import { useTheme } from '../contexts/ThemeContext'

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/hot', icon: <FireOutlined />, label: '综合热门' },
  { key: '/search', icon: <SearchOutlined />, label: '搜索' },
  { key: '/player', icon: <PlayCircleOutlined />, label: '视频播放' },
  { key: '/trend', icon: <LineChartOutlined />, label: '趋势分析' },
  { key: '/uploader', icon: <UserOutlined />, label: 'UP主分析' },
  { key: '/uploader-leaderboard', icon: <CrownOutlined />, label: 'UP主排行' },
  { key: '/category', icon: <AppstoreOutlined />, label: '分类分析' },
  { key: '/stats', icon: <BarChartOutlined />, label: '数据概览' },
  { key: '/ranking-change', icon: <SwapOutlined />, label: '排行变化' },
  { key: '/favorites', icon: <HeartOutlined />, label: '我的收藏' },
  { key: '/compare', icon: <FundOutlined />, label: '数据对比' },
  { key: '/calendar', icon: <CalendarOutlined />, label: '数据日历' },
  { key: '/duration', icon: <FieldTimeOutlined />, label: '时长分析' },
  { key: '/history', icon: <HistoryOutlined />, label: '历史榜单' },
  { key: '/gallery', icon: <PictureOutlined />, label: '封面画廊' },
]

const MainLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const { isDark, toggleTheme } = useTheme()

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside
        className="bili-sidebar"
        style={{
          width: collapsed ? 72 : 240,
          minHeight: '100vh',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 100,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div className="sidebar-logo">
          <div className="logo-icon">
            <ThunderboltOutlined />
          </div>
          {!collapsed && (
            <div>
              <div className="logo-text">B站热门分析</div>
              <div className="logo-sub">Popular Video Analytics</div>
            </div>
          )}
        </div>

        <nav className="sidebar-menu" style={{ flex: 1 }}>
          {menuItems.map((item) => {
            const isActive = location.pathname === item.key
            return (
              <button
                key={item.key}
                className={`menu-item${isActive ? ' active' : ''}`}
                onClick={() => navigate(item.key)}
                title={collapsed ? item.label : undefined}
              >
                <span className="menu-icon">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="menu-item sidebar-action-btn"
            onClick={toggleTheme}
            title={collapsed ? (isDark ? '浅色模式' : '深色模式') : undefined}
            style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <span className="menu-icon theme-toggle-icon">
              {isDark ? <SunOutlined /> : <MoonOutlined />}
            </span>
            {!collapsed && <span>{isDark ? '浅色模式' : '深色模式'}</span>}
          </button>
          <button
            className="menu-item sidebar-action-btn"
            onClick={() => setCollapsed(!collapsed)}
            style={{ justifyContent: collapsed ? 'center' : 'flex-start' }}
          >
            <span className="menu-icon collapse-icon">
              {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            </span>
            {!collapsed && <span>收起侧栏</span>}
          </button>
        </div>
      </aside>

      <main
        className="bili-content"
        style={{
          marginLeft: collapsed ? 72 : 240,
          flex: 1,
          padding: '32px',
          transition: 'margin-left 0.3s ease',
          minWidth: 0,
        }}
      >
        <Outlet />
      </main>
    </div>
  )
}

export default MainLayout
