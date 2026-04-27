import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, theme } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import ErrorBoundary from './components/ErrorBoundary'
import MainLayout from './components/MainLayout'
import Dashboard from './pages/Dashboard'
import Trend from './pages/Trend'
import Uploader from './pages/Uploader'
import Category from './pages/Category'
import Hot from './pages/Hot'
import Player, { VideoModalProvider } from './pages/Player'
import Search from './pages/Search'
import Gallery from './pages/Gallery'
import Stats from './pages/Stats'
import RankingChange from './pages/RankingChange'
import Favorites from './pages/Favorites'
import Compare from './pages/Compare'
import NotFound from './pages/NotFound'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { FavoritesProvider } from './contexts/FavoritesContext'
import './styles/global.css'

const DARK_TOKEN = {
  colorPrimary: '#FB7299',
  colorBgContainer: '#191932',
  colorBgElevated: '#1e1e3a',
  colorBgLayout: '#0f0f1a',
  colorBorder: 'rgba(255,255,255,0.08)',
  colorBorderSecondary: 'rgba(255,255,255,0.05)',
  colorText: '#e8e8f0',
  colorTextSecondary: '#9a9ab0',
  borderRadius: 10,
  fontFamily: `-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', 'Helvetica Neue', Helvetica, Arial, sans-serif`,
}

const DARK_COMPONENTS = {
  Card: {
    colorBgContainer: 'rgba(25,25,50,0.65)',
    borderRadiusLG: 16,
  },
  Table: {
    colorBgContainer: 'transparent',
    headerBg: 'rgba(255,255,255,0.03)',
    rowHoverBg: 'rgba(251,114,153,0.08)',
  },
  Input: {
    colorBgContainer: 'rgba(255,255,255,0.06)',
    colorBorder: 'rgba(255,255,255,0.08)',
    activeBorderColor: '#FB7299',
  },
  Select: {
    colorBgContainer: 'rgba(255,255,255,0.06)',
    colorBorder: 'rgba(255,255,255,0.08)',
  },
  DatePicker: {
    colorBgContainer: 'rgba(255,255,255,0.06)',
    colorBorder: 'rgba(255,255,255,0.08)',
  },
  Drawer: {
    colorBgElevated: '#161627',
  },
  Spin: {
    colorPrimary: '#FB7299',
  },
}

const LIGHT_TOKEN = {
  colorPrimary: '#FB7299',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBgLayout: '#f5f5f8',
  colorBorder: 'rgba(0,0,0,0.08)',
  colorBorderSecondary: 'rgba(0,0,0,0.05)',
  colorText: '#1a1a2e',
  colorTextSecondary: '#666680',
  borderRadius: 10,
  fontFamily: `-apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans SC', 'Helvetica Neue', Helvetica, Arial, sans-serif`,
}

const ThemedApp: React.FC = () => {
  const { isDark } = useTheme()

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: isDark ? DARK_TOKEN : LIGHT_TOKEN,
        components: isDark ? DARK_COMPONENTS : undefined,
      }}
    >
      <BrowserRouter>
        <FavoritesProvider>
          <VideoModalProvider>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<MainLayout />}>
                  <Route index element={<Navigate to="/dashboard" replace />} />
                  <Route path="dashboard" element={<Dashboard />} />
                  <Route path="hot" element={<Hot />} />
                  <Route path="trend" element={<Trend />} />
                  <Route path="uploader" element={<Uploader />} />
                  <Route path="category" element={<Category />} />
                  <Route path="player" element={<Player />} />
                  <Route path="search" element={<Search />} />
                  <Route path="gallery" element={<Gallery />} />
                  <Route path="stats" element={<Stats />} />
                  <Route path="ranking-change" element={<RankingChange />} />
                  <Route path="favorites" element={<Favorites />} />
                  <Route path="compare" element={<Compare />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </ErrorBoundary>
          </VideoModalProvider>
        </FavoritesProvider>
      </BrowserRouter>
    </ConfigProvider>
  )
}

const App: React.FC = () => (
  <ThemeProvider>
    <ThemedApp />
  </ThemeProvider>
)

export default App
