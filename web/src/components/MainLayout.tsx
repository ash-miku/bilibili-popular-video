import React, { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { Drawer } from 'antd'
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
  AimOutlined,
  TagOutlined,
  InteractionOutlined,
  RocketOutlined,
  FileTextOutlined,
  MenuOutlined,
} from '@ant-design/icons'
import { useTheme } from '../contexts/ThemeContext'

const menuGroups = [
  {
    label: '浏览',
    items: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '仪表盘' },
      { key: '/hot', icon: <FireOutlined />, label: '综合热门' },
      { key: '/search', icon: <SearchOutlined />, label: '搜索' },
      { key: '/player', icon: <PlayCircleOutlined />, label: '视频播放' },
      { key: '/gallery', icon: <PictureOutlined />, label: '封面画廊' },
      { key: '/favorites', icon: <HeartOutlined />, label: '我的收藏' },
    ],
  },
  {
    label: '视频分析',
    items: [
      { key: '/trend', icon: <LineChartOutlined />, label: '趋势分析' },
      { key: '/ranking-change', icon: <SwapOutlined />, label: '排行变化' },
      { key: '/rank-tracker', icon: <AimOutlined />, label: '排名追踪' },
      { key: '/interaction', icon: <InteractionOutlined />, label: '互动分析' },
      { key: '/compare', icon: <FundOutlined />, label: '数据对比' },
      { key: '/duration', icon: <FieldTimeOutlined />, label: '时长分析' },
    ],
  },
  {
    label: 'UP主与分区',
    items: [
      { key: '/uploader', icon: <UserOutlined />, label: 'UP主分析' },
      { key: '/uploader-leaderboard', icon: <CrownOutlined />, label: 'UP主排行' },
      { key: '/newcomer', icon: <RocketOutlined />, label: '新人发现' },
      { key: '/category', icon: <AppstoreOutlined />, label: '分类分析' },
      { key: '/partition-rank', icon: <BarChartOutlined />, label: '分区排行' },
      { key: '/tag-cloud', icon: <TagOutlined />, label: '标签云' },
    ],
  },
  {
    label: '数据报告',
    items: [
      { key: '/stats', icon: <BarChartOutlined />, label: '数据概览' },
      { key: '/calendar', icon: <CalendarOutlined />, label: '数据日历' },
      { key: '/history', icon: <HistoryOutlined />, label: '历史榜单' },
      { key: '/weekly-report', icon: <FileTextOutlined />, label: '周报汇总' },
    ],
  },
]

const MainLayout: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const { isDark, toggleTheme } = useTheme()

  const navigateTo = (path: string) => {
    navigate(path)
    setMobileDrawerOpen(false)
  }

  const renderMenuGroups = (isCollapsed: boolean) => (
    menuGroups.map((group) => (
      <div key={group.label}>
        {!isCollapsed ? (
          <div className="menu-group-label">{group.label}</div>
        ) : (
          <div className="menu-group-divider" />
        )}
        {group.items.map((item) => {
          const isActive = location.pathname === item.key
          return (
            <button
              key={item.key}
              className={`menu-item${isActive ? ' active' : ''}`}
              onClick={() => navigateTo(item.key)}
              title={isCollapsed ? item.label : undefined}
            >
              <span className="menu-icon">{item.icon}</span>
              {!isCollapsed && <span>{item.label}</span>}
            </button>
          )
        })}
      </div>
    ))
  )

  return (
    <div className="bili-layout-shell" style={{ display: 'flex', minHeight: '100vh' }}>
      <div className="bili-mobile-topbar">
        <button
          className="bili-mobile-topbar__menu"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="打开导航菜单"
        >
          <MenuOutlined />
        </button>
        <button className="bili-mobile-topbar__brand" onClick={() => navigateTo('/dashboard')}>
          <span className="bili-mobile-topbar__brand-icon">
            <ThunderboltOutlined />
          </span>
          <span className="bili-mobile-topbar__brand-text">B站热门分析</span>
        </button>
        <button
          className="bili-mobile-topbar__theme"
          onClick={toggleTheme}
          aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
        >
          {isDark ? <SunOutlined /> : <MoonOutlined />}
        </button>
      </div>

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

        <nav className="sidebar-menu" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {renderMenuGroups(collapsed)}
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

      <Drawer
        className="bili-mobile-drawer"
        placement="left"
        open={mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        width={280}
        title={(
          <div className="bili-mobile-drawer__title">
            <span className="bili-mobile-drawer__title-icon">
              <ThunderboltOutlined />
            </span>
            <div>
              <div className="logo-text">B站热门分析</div>
              <div className="logo-sub">Popular Video Analytics</div>
            </div>
          </div>
        )}
        footer={(
          <div className="bili-mobile-drawer__footer">
            <button className="menu-item sidebar-action-btn" onClick={toggleTheme}>
              <span className="menu-icon theme-toggle-icon">
                {isDark ? <SunOutlined /> : <MoonOutlined />}
              </span>
              <span>{isDark ? '浅色模式' : '深色模式'}</span>
            </button>
          </div>
        )}
      >
        <nav className="sidebar-menu bili-mobile-drawer__menu">
          {renderMenuGroups(false)}
        </nav>
      </Drawer>

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
