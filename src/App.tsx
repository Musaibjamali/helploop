
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import Auth from './Auth'
import Profile from './Profile'
import Community from './Community'
import Messages from './Messages'
import HelpCenter from './HelpCenter'
import AdminSupport from './AdminSupport'
import Education from './Education'
import AIAssistant from './AIAssistant'
import {
  useNotifications,
  NotificationBell,
  NotificationsPage,
} from './Notifications'
import type { NotificationItem } from './Notifications'
import { supabase } from './supabase'
import './App.css'

const menu = [
  { name: 'Home', icon: '\u2302' },
  { name: 'My Profile', icon: '\u25C9' },
  { name: 'Community', icon: '\u2637' },
  { name: 'Messages', icon: '\u2709' },
  { name: 'Help Center', icon: '\u2754' },
  { name: 'Admin Support', icon: '\u2699' },
  { name: 'Education', icon: '\u25A4' },
  { name: 'AI Assistant', icon: '\u2728' },
]

const descriptions: Record<string, string> = {
  Community: 'Meet people, share ideas and build meaningful connections.',
  Messages: 'Stay in touch with your people through private conversations.',
  'Help Center': 'Find answers, share guidance and get the support you need.',
  'Admin Support': 'Manage user support requests and help the community.',
  Education: 'Discover learning resources and grow your skills every day.',
  'AI Assistant': 'Explore ideas and get help with your everyday questions.',
}

function App() {
  const [active, setActive] = useState('Home')
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const [isSupportAdmin, setIsSupportAdmin] = useState(false)

  const {
    notifications,
    loading: notificationsLoading,
    unreadCount,
    markRead,
    markAllRead,
  } = useNotifications(session?.user.id)

  // Check login session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setChecking(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      setLoggingOut(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Check whether logged-in user is a support admin
  useEffect(() => {
    let cancelled = false

    async function checkSupportAdmin() {
      if (!session) {
        setIsSupportAdmin(false)
        return
      }

      const { data, error } = await supabase.rpc('is_support_admin')

      console.log('Support admin check:', {
        email: session.user.email,
        data,
        error,
      })

      if (!cancelled) {
        setIsSupportAdmin(!error && data === true)
      }
    }

    void checkSupportAdmin()

    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  async function handleLogout() {
    setLoggingOut(true)
    const { error } = await supabase.auth.signOut()

    if (error) {
      alert(error.message)
      setLoggingOut(false)
    }
  }

  function openNotification(item: NotificationItem) {
    setActive(item.type === 'message' ? 'Messages' : 'Community')
  }

  const visibleMenu = menu.filter(
    (item) => item.name !== 'Admin Support' || isSupportAdmin,
  )

  if (checking) {
    return (
      <div className="app-loading">
        <div className="loading-mark">H</div>
        <strong>HelpLoop</strong>
        <span>Getting everything ready...</span>
      </div>
    )
  }

  if (!session) return <Auth />

  const userInitial = (session.user.email?.[0] || 'U').toUpperCase()

  return (
    <div className="app">
      <aside className="sidebar">
        <button className="brand" onClick={() => setActive('Home')}>
          <span className="brand-icon">H</span>
          <span className="brand-name">HelpLoop</span>
        </button>

        <div className="sidebar-caption">WORKSPACE</div>

        <nav className="sidebar-nav">
          {visibleMenu.map((item) => (
            <button
              key={item.name}
              className={`nav-item ${active === item.name ? 'active' : ''}`}
              onClick={() => setActive(item.name)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.name}</span>
              {active === item.name && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-help-card">
          <div className="help-card-icon">✦</div>
          <strong>Keep growing</strong>
          <p>Every connection can make a difference.</p>
          <button onClick={() => setActive('Community')}>
            Explore community <span>→</span>
          </button>
        </div>

        <button
          className="sidebar-profile"
          onClick={() => setActive('My Profile')}
        >
          <span className="sidebar-avatar">{userInitial}</span>
          <span className="sidebar-profile-copy">
            <strong>My account</strong>
            <small>{session.user.email}</small>
          </span>
          <span className="profile-chevron">›</span>
        </button>

        <div className="sidebar-tagline">ONE PLATFORM. MANY POSSIBILITIES.</div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="topbar-heading">
            <span className="eyebrow">YOUR WORLD, CONNECTED</span>
            <h1>{active}</h1>
          </div>

          <div className="top-actions">
            <div className="topbar-welcome">
              <span className="online-dot" />
              <span>You're connected</span>
            </div>

            <NotificationBell
              notifications={notifications}
              unreadCount={unreadCount}
              loading={notificationsLoading}
              onRead={markRead}
              onNavigate={openNotification}
              onViewAll={() => setActive('Notifications')}
            />

            <button
              className="top-avatar"
              onClick={() => setActive('My Profile')}
              aria-label="Open profile"
            >
              {userInitial}
            </button>

            <button
              className="logout-button"
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <span>↪</span>
              {loggingOut ? 'Logging out...' : 'Logout'}
            </button>
          </div>
        </header>

        <div className="page-content">
          {active === 'My Profile' ? (
            <Profile />
          ) : active === 'Community' ? (
            <Community />
          ) : active === 'Messages' ? (
            <Messages />
          ) : active === 'Help Center' ? (
            <HelpCenter userId={session.user.id} />
) : active === 'Admin Support' && isSupportAdmin ? (
  <AdminSupport />
) : active === 'Education' ? (
  <Education />
) : active === 'AI Assistant' ? (
  <AIAssistant />
) : active === 'Notifications' ? (
            <NotificationsPage
              notifications={notifications}
              unreadCount={unreadCount}
              loading={notificationsLoading}
              onRead={markRead}
              onMarkAllRead={markAllRead}
              onNavigate={openNotification}
              onViewAll={() => setActive('Notifications')}
            />
          ) : active === 'Home' ? (
            <div className="home-dashboard">
              <section className="welcome">
                <div className="welcome-copy">
                  <span className="welcome-label">
                    <span className="welcome-label-dot" />
                    WELCOME TO HELPLOOP
                  </span>
                  <h2>
                    One platform.
                    <br />
                    <span>Endless possibilities.</span>
                  </h2>
                  <p>
                    Connect with people, help others, learn new skills and
                    discover opportunities around the world.
                  </p>
                  <button
                    className="primary-btn"
                    onClick={() => setActive('Community')}
                  >
                    Explore Community <span>→</span>
                  </button>
                </div>

                <div className="welcome-art" aria-hidden="true">
                  <div className="art-orbit orbit-one" />
                  <div className="art-orbit orbit-two" />
                  <div className="art-circle">
                    <span>H</span>
                  </div>
                  <div className="float-icon float-one">✦</div>
                  <div className="float-icon float-two">◎</div>
                  <div className="float-icon float-three">↗</div>
                  <div className="art-caption">
                    <span className="art-caption-mark">●</span>
                    Connect. Learn. Grow.
                  </div>
                </div>
              </section>

              <div className="section-heading">
                <div>
                  <span className="section-kicker">YOUR SPACE</span>
                  <h2>Explore HelpLoop</h2>
                  <p>Everything you need, all in one place.</p>
                </div>
                <span className="section-count">
                  {visibleMenu
                    .filter(
                      (item) =>
                        item.name !== 'Home' && item.name !== 'My Profile',
                    )
                    .length.toString()
                    .padStart(2, '0')}{' '}
                  FEATURES
                </span>
              </div>

              <section className="feature-grid">
                {visibleMenu
                  .filter(
                    (item) =>
                      item.name !== 'Home' && item.name !== 'My Profile',
                  )
                  .map((item, index) => (
                    <button
                      className={`feature-card feature-card-${index + 1}`}
                      key={item.name}
                      onClick={() => setActive(item.name)}
                    >
                      <span className="feature-card-top">
                        <span className="feature-icon">{item.icon}</span>
                        <span className="card-arrow">↗</span>
                      </span>
                      <strong>{item.name}</strong>
                      <span className="feature-description">
                        {descriptions[item.name]}
                      </span>
                      <span className="feature-link">
                        Explore section <span>→</span>
                      </span>
                    </button>
                  ))}
              </section>

              <section className="bottom-banner">
                <div className="banner-symbol">✦</div>
                <div>
                  <span className="banner-kicker">BETTER TOGETHER</span>
                  <h2>Great things happen together.</h2>
                  <p>HelpLoop brings possibilities closer to everyone.</p>
                </div>
                <button onClick={() => setActive('Community')}>
                  Get connected <span>→</span>
                </button>
              </section>
            </div>
          ) : (
            <section className="coming-soon">
              <div className="coming-soon-icon">✦</div>
              <span className="section-kicker">COMING SOON</span>
              <h2>{active}</h2>
              <p>This section is being prepared for HelpLoop.</p>
              <button
                className="primary-btn"
                onClick={() => setActive('Home')}
              >
                Back to Home <span>→</span>
              </button>
            </section>
          )}
        </div>

        <footer className="app-footer">
          <span>© 2026 HelpLoop</span>
          <span>One world, many possibilities.</span>
        </footer>
      </main>
    </div>
  )
}

export default App
