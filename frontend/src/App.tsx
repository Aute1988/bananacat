import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import HomePage from './pages/HomePage'
import CreateTokenPage from './pages/CreateTokenPage'
import TokenListPage from './pages/TokenListPage'
import TokenDetailPage from './pages/TokenDetailPage'
import MyTokensPage from './pages/MyTokensPage'
import LPUnlockPage from './pages/LPUnlockPage'
import NotificationsPage from './pages/NotificationsPage'
import DashboardPage from './pages/DashboardPage'
import LeaderboardPage from './pages/LeaderboardPage'
import DocsPage from './pages/DocsPage'
import PWAStatus from './components/PWAStatus'
import { ToastContainer } from './components/CommonUI'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="create" element={<CreateTokenPage />} />
          <Route path="tokens" element={<TokenListPage />} />
          <Route path="token/:chainId/:address" element={<TokenDetailPage />} />
          <Route path="my-tokens" element={<MyTokensPage />} />
          <Route path="unlock/:lockId" element={<LPUnlockPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="leaderboard" element={<LeaderboardPage />} />
          <Route path="docs" element={<DocsPage />} />
        </Route>
      </Routes>
      <PWAStatus />
      <ToastContainer />
    </>
  )
}
