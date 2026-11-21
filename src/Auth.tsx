
import { useState } from 'react'
import { supabase } from './supabase'
import './Auth.css'

export default function Auth() {
  const [showAuth, setShowAuth] = useState(false)
  const [isLogin, setIsLogin] = useState(true)
  const [isForgot, setIsForgot] = useState(false)
  const [isReset, setIsReset] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      if (isReset) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw error
        setMessage('Password updated successfully! You can now sign in.')
        setIsReset(false)
        setIsLogin(true)
        setPassword('')
      } else if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setMessage('Password reset link sent! Please check your email.')
      } else if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: name },
          },
        })
        if (error) throw error
        setMessage('Account created! Please check your email for verification.')
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  function openAuth(login: boolean) {
    setIsLogin(login)
    setIsForgot(false)
    setIsReset(false)
    setMessage('')
    setShowAuth(true)
  }

  if (!showAuth && !isReset) {
    return (
      <div className="landing-page">
        <div className="landing-glow landing-glow-one" />
        <div className="landing-glow landing-glow-two" />

        <nav className="landing-nav">
          <button className="landing-brand" onClick={() => setShowAuth(false)}>
            <span className="landing-brand-icon">H</span>
            <span>Help<span>Loop</span></span>
          </button>

          <div className="landing-nav-links">
            <a href="#features">Features</a>
            <a href="#about">About</a>
          </div>

          <div className="landing-nav-actions">
            <button className="landing-login" onClick={() => openAuth(true)}>
              Log In
            </button>
            <button className="landing-nav-start" onClick={() => openAuth(false)}>
              Get Started <span>↗</span>
            </button>
          </div>
        </nav>

        <main>
          <section className="landing-hero">
            <div className="landing-hero-content">
              <div className="landing-pill">
                <span className="landing-live-dot" />
                YOUR WORLD. YOUR COMMUNITY. YOUR FUTURE.
              </div>

              <h1>
                One place.
                <br />
                <span>Endless possibilities.</span>
              </h1>

              <p>
                Connect with people, share your ideas, learn new skills and
                discover a world of possibilities. Everything you need to
                connect, grow and move forward — together.
              </p>

              <div className="landing-hero-buttons">
                <button className="landing-primary" onClick={() => openAuth(false)}>
                  Get Started Free <span>→</span>
                </button>
                <button className="landing-secondary" onClick={() => openAuth(true)}>
                  Sign In <span>↗</span>
                </button>
              </div>

              <div className="landing-trust">
                <div className="landing-trust-icon">✦</div>
                <div>
                  <strong>One platform, many possibilities</strong>
                  <span>Connect · Help · Learn · Grow</span>
                </div>
              </div>
            </div>

            <div className="landing-visual">
              <div className="landing-visual-orbit orbit-a" />
              <div className="landing-visual-orbit orbit-b" />

              <div className="landing-main-orb">
                <div className="landing-orb-inner">H</div>
                <span className="orb-sparkle sparkle-a">✦</span>
                <span className="orb-sparkle sparkle-b">✧</span>
              </div>

              <div className="landing-float-card float-community">
                <span className="float-card-icon purple">◎</span>
                <div><strong>Community</strong><small>Connect with people</small></div>
              </div>

              <div className="landing-float-card float-learning">
                <span className="float-card-icon blue">◈</span>
                <div><strong>Learning</strong><small>Grow every day</small></div>
              </div>

              <div className="landing-float-card float-ai">
                <span className="float-card-icon pink">✦</span>
                <div><strong>AI Assistant</strong><small>Ideas made easier</small></div>
              </div>

              <div className="landing-visual-caption">
                <span /> CONNECT. LEARN. GROW.
              </div>
            </div>
          </section>

          <section className="landing-stats">
            <div><strong>01</strong><span>One connected platform</span></div>
            <div><strong>∞</strong><span>Possibilities to explore</span></div>
            <div><strong>24/7</strong><span>Ideas and inspiration</span></div>
          </section>

          <section className="landing-features" id="features">
            <div className="landing-section-heading">
              <span>EXPLORE THE EXPERIENCE</span>
              <h2>Everything you need.<br /><em>All in one place.</em></h2>
              <p>A connected space designed to help you communicate, learn and grow.</p>
            </div>

            <div className="landing-feature-grid">
              <article className="landing-feature feature-purple">
                <div className="landing-feature-icon">◎</div>
                <span className="landing-feature-number">01 / CONNECT</span>
                <h3>Community</h3>
                <p>Meet new people, share your thoughts and build meaningful connections.</p>
                <span className="landing-feature-arrow">↗</span>
              </article>

              <article className="landing-feature feature-blue">
                <div className="landing-feature-icon">✉</div>
                <span className="landing-feature-number">02 / COMMUNICATE</span>
                <h3>Messages</h3>
                <p>Keep conversations going with private and simple communication.</p>
                <span className="landing-feature-arrow">↗</span>
              </article>

              <article className="landing-feature feature-pink">
                <div className="landing-feature-icon">✧</div>
                <span className="landing-feature-number">03 / DISCOVER</span>
                <h3>AI Assistant</h3>
                <p>Explore ideas, ask questions and get help with everyday tasks.</p>
                <span className="landing-feature-arrow">↗</span>
              </article>

              <article className="landing-feature feature-green">
                <div className="landing-feature-icon">◇</div>
                <span className="landing-feature-number">04 / GROW</span>
                <h3>Education</h3>
                <p>Discover learning resources and keep building your skills.</p>
                <span className="landing-feature-arrow">↗</span>
              </article>

              <article className="landing-feature feature-orange">
                <div className="landing-feature-icon">?</div>
                <span className="landing-feature-number">05 / SUPPORT</span>
                <h3>Help Center</h3>
                <p>Find guidance, explore answers and get the support you need.</p>
                <span className="landing-feature-arrow">↗</span>
              </article>

              <article className="landing-feature feature-cyan">
                <div className="landing-feature-icon">⌁</div>
                <span className="landing-feature-number">06 / EXPERIENCE</span>
                <h3>Live Voice</h3>
                <p>Experience a more natural way to interact with AI using your voice.</p>
                <span className="landing-feature-arrow">↗</span>
              </article>
            </div>
          </section>

          <section className="landing-about" id="about">
            <div className="landing-about-symbol">H</div>
            <div>
              <span>MORE THAN A PLATFORM</span>
              <h2>Great things happen <em>together.</em></h2>
              <p>
                HelpLoop brings people, knowledge and helpful technology
                together in one connected experience.
              </p>
            </div>
            <button onClick={() => openAuth(false)}>
              Join HelpLoop <span>→</span>
            </button>
          </section>
        </main>

        <footer className="landing-footer">
          <div className="landing-footer-brand">
            <span className="landing-brand-icon">H</span>
            <strong>HelpLoop</strong>
          </div>
          <p>Connect. Help. Learn. Grow.</p>
          <div className="landing-credit">
            Made &amp; Developed by <strong>Engr. Mr. Musaib</strong>
            <span>🇵🇰 Pakistan</span>
          </div>
          <small>© 2026 HelpLoop. All rights reserved.</small>
        </footer>
      </div>
    )
  }

  return (
    <div className="auth-page">

      <div className="auth-showcase">
        <div className="auth-showcase-badge">
          <span /> YOUR SPACE TO GROW
        </div>

        <div className="auth-showcase-logo">H</div>

        <h2>
          Welcome to a world of
          <span> endless possibilities.</span>
        </h2>

        <p>
          Connect with people, discover new ideas, learn new skills
          and make every interaction meaningful.
        </p>

        <div className="auth-showcase-points">
          <div><span>✦</span> Connect with your community</div>
          <div><span>✦</span> Learn and discover new things</div>
          <div><span>✦</span> Get help with AI Assistant</div>
        </div>

        <div className="auth-showcase-credit">
          Made &amp; Developed by <strong>Engr. Mr. Musaib</strong>
          <span>🇵🇰 Pakistan</span>
        </div>
      </div>

      <button
        className="auth-back-home"
        type="button"
        onClick={() => {
          setShowAuth(false)
          setIsForgot(false)
          setIsReset(false)
          setMessage('')
        }}
      >
        ← Back to Home
      </button>

      <form className="auth-card" onSubmit={handleSubmit}>
        <div className="auth-logo">H</div>
        <h1>Welcome to HelpLoop</h1>
        <p>Connect • Help • Learn • Grow</p>

        <h2>
          {isReset
            ? 'Set New Password'
            : isForgot
            ? 'Reset Your Password'
            : isLogin
            ? 'Sign in to your account'
            : 'Create your account'}
        </h2>

        {!isLogin && !isForgot && !isReset && (
          <input
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={isReset}
        />

        {!isForgot && (
          <input
            type="password"
            placeholder={isReset ? 'New password' : 'Password (minimum 6 characters)'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        )}

        {isLogin && !isForgot && !isReset && (
          <div className="auth-forgot-row">
            <button
              type="button"
              onClick={() => {
                setIsForgot(true)
                setMessage('')
              }}
            >
              Forgot Password?
            </button>
          </div>
        )}

        <button className="auth-submit" type="submit" disabled={loading}>
          {loading
            ? 'Please wait...'
            : isReset
            ? 'Update Password'
            : isForgot
            ? 'Send Reset Link'
            : isLogin
            ? 'Sign In'
            : 'Create Account'}
        </button>

        {message && <div className="auth-message">{message}</div>}

        <div className="auth-switch">
          {isForgot || isReset ? (
            <button
              type="button"
              onClick={() => {
                setIsForgot(false)
                setIsReset(false)
                setPassword('')
                setMessage('')
              }}
            >
              Back to Sign In
            </button>
          ) : (
            <>
              {isLogin ? "Don't have an account?" : 'Already have an account?'}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin)
                  setMessage('')
                }}
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  )
}
