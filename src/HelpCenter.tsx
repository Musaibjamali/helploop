
import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from './supabase'
import './HelpCenter.css'

type HelpCenterProps = {
  userId: string
}

type SupportRequest = {
  id: string
  subject: string
  category: string
  message: string
  status: string
  created_at: string
}

const faqs = [
  {
    question: 'How do I update my profile?',
    answer:
      'Open My Profile from the sidebar. You can view and update your personal information there.',
    category: 'Account',
  },
  {
    question: 'How can I connect with other people?',
    answer:
      'Visit the Community page to discover posts, share your ideas and connect with other members.',
    category: 'Community',
  },
  {
    question: 'How do I send a private message?',
    answer:
      'Open Messages and select a conversation to communicate privately with another member.',
    category: 'Messages',
  },
  {
    question: 'How do I know when I receive a notification?',
    answer:
      'The notification bell in the top bar shows your unread notifications. Open it to view updates.',
    category: 'Account',
  },
  {
    question: 'What should I do if something is not working?',
    answer:
      'Submit a support request below. Choose the relevant category and explain the problem clearly.',
    category: 'Technical',
  },
  {
    question: 'How can I stay safe on HelpLoop?',
    answer:
      'Never share your password or private account information. Report suspicious activity through the support form.',
    category: 'Safety',
  },
]

const categories = ['Account', 'Community', 'Messages', 'Technical', 'Safety', 'Other']

function HelpCenter({ userId }: HelpCenterProps) {
  const [search, setSearch] = useState('')
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [subject, setSubject] = useState('')
  const [category, setCategory] = useState('Technical')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [myRequests, setMyRequests] = useState<SupportRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(true)
  const [requestError, setRequestError] = useState('')

  async function loadMyRequests() {
    if (!userId) {
      setMyRequests([])
      setLoadingRequests(false)
      return
    }

    setLoadingRequests(true)
    setRequestError('')

    const { data, error: fetchError } = await supabase
      .from('support_requests')
      .select('id, subject, category, message, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setRequestError(fetchError.message)
    } else {
      setMyRequests((data || []) as SupportRequest[])
    }

    setLoadingRequests(false)
  }

  useEffect(() => {
    loadMyRequests()
  }, [userId])

  const filteredFaqs = faqs.filter((faq) =>
    `${faq.question} ${faq.answer} ${faq.category}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  )

  function formatStatus(status: string) {
    switch (status) {
      case 'in_progress':
        return 'In Progress'
      case 'resolved':
        return 'Resolved'
      case 'pending':
        return 'Pending'
      default:
        return status.replace(/_/g, ' ')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSuccess(false)

    if (!userId) {
      setError('Please sign in again before submitting a request.')
      return
    }

    setSubmitting(true)

    const { error: submitError } = await supabase
      .from('support_requests')
      .insert({
        user_id: userId,
        subject: subject.trim(),
        category,
        message: message.trim(),
      })

    setSubmitting(false)

    if (submitError) {
      setError(submitError.message)
      return
    }

    setSuccess(true)
    setSubject('')
    setCategory('Technical')
    setMessage('')

    await loadMyRequests()
  }

  return (
    <div className="help-center-page">
      <section className="help-hero">
        <div className="help-hero-content">
          <span className="help-eyebrow">HELPLOOP SUPPORT</span>
          <h2>How can we help you?</h2>
          <p>
            Find answers, explore helpful guides or contact our support team.
            We're here to help you.
          </p>

          <div className="help-search">
            <span>⌕</span>
            <input
              type="search"
              placeholder="Search for answers..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="search-shortcut">FAQ</span>
          </div>
        </div>

        <div className="help-hero-art" aria-hidden="true">
          <div className="help-art-circle">
            <span>?</span>
          </div>
          <span className="help-art-star star-one">✦</span>
          <span className="help-art-star star-two">✧</span>
          <span className="help-art-dot dot-one" />
          <span className="help-art-dot dot-two" />
        </div>
      </section>

      <section className="help-category-section">
        <div className="help-section-heading">
          <div>
            <span className="help-kicker">BROWSE BY TOPIC</span>
            <h3>What do you need help with?</h3>
          </div>
        </div>

        <div className="help-category-grid">
          {[
            { name: 'Account', icon: '◉', detail: 'Profile and settings' },
            { name: 'Community', icon: '♧', detail: 'Posts and connections' },
            { name: 'Messages', icon: '✉', detail: 'Private conversations' },
            { name: 'Technical', icon: '⚙', detail: 'Technical problems' },
            { name: 'Safety', icon: '◇', detail: 'Privacy and security' },
            { name: 'Other', icon: '✦', detail: 'General questions' },
          ].map((item) => (
            <button
              type="button"
              className="help-category-card"
              key={item.name}
              onClick={() => {
                setCategory(item.name)
                document
                  .getElementById('help-contact-form')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              <span className="help-category-icon">{item.icon}</span>
              <strong>{item.name}</strong>
              <small>{item.detail}</small>
              <span className="help-category-arrow">↗</span>
            </button>
          ))}
        </div>
      </section>

      <section className="help-faq-section">
        <div className="help-section-heading">
          <div>
            <span className="help-kicker">QUICK ANSWERS</span>
            <h3>Frequently asked questions</h3>
            <p>Find quick answers to common questions.</p>
          </div>
          <span className="help-faq-count">{filteredFaqs.length} ARTICLES</span>
        </div>

        <div className="help-faq-list">
          {filteredFaqs.length > 0 ? (
            filteredFaqs.map((faq) => {
              const originalIndex = faqs.indexOf(faq)
              const isOpen = openFaq === originalIndex

              return (
                <article
                  className={`help-faq-item ${isOpen ? 'is-open' : ''}`}
                  key={faq.question}
                >
                  <button
                    type="button"
                    className="help-faq-question"
                    onClick={() => setOpenFaq(isOpen ? null : originalIndex)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <span className="help-faq-toggle">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="help-faq-answer">
                      <span>{faq.category}</span>
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </article>
              )
            })
          ) : (
            <div className="help-no-results">
              <span>⌕</span>
              <strong>No matching answers found</strong>
              <p>Try another search or submit a support request below.</p>
            </div>
          )}
        </div>
      </section>

      {/* MY SUPPORT REQUESTS */}
      <section className="help-my-requests">
        <div className="help-section-heading">
          <div>
            <span className="help-kicker">YOUR SUPPORT ACTIVITY</span>
            <h3>My Support Requests</h3>
            <p>Track the progress of your submitted requests.</p>
          </div>

          <button
            type="button"
            className="help-refresh-button"
            onClick={loadMyRequests}
            disabled={loadingRequests}
          >
            {loadingRequests ? 'Loading...' : '↻ Refresh'}
          </button>
        </div>

        {requestError && (
          <div className="help-error-message">{requestError}</div>
        )}

        {loadingRequests ? (
          <div className="help-requests-empty">
            Loading your support requests...
          </div>
        ) : myRequests.length === 0 ? (
          <div className="help-requests-empty">
            <span>✉</span>
            <strong>No support requests yet</strong>
            <p>Your submitted support requests will appear here.</p>
          </div>
        ) : (
          <div className="help-request-list">
            {myRequests.map((request) => (
              <article className="help-request-card" key={request.id}>
                <div className="help-request-top">
                  <div>
                    <span className="help-request-category">
                      {request.category}
                    </span>
                    <h4>{request.subject}</h4>
                  </div>

                  <span
                    className={`help-request-status status-${request.status}`}
                  >
                    {formatStatus(request.status)}
                  </span>
                </div>

                <p className="help-request-message">{request.message}</p>

                <div className="help-request-footer">
                  <span>
                    Submitted:{' '}
                    {new Date(request.created_at).toLocaleDateString()}
                  </span>
                  <span>Request ID: {request.id.slice(0, 8)}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="help-contact-section" id="help-contact-form">
        <div className="help-contact-info">
          <span className="help-kicker">WE'RE HERE FOR YOU</span>
          <h3>Still need a hand?</h3>
          <p>
            Tell us what happened. Submit a support request and it will be
            securely saved for our team.
          </p>

          <div className="help-contact-point">
            <span>✦</span>
            <div>
              <strong>Personal support</strong>
              <small>Tell us about your specific issue.</small>
            </div>
          </div>

          <div className="help-contact-point">
            <span>✓</span>
            <div>
              <strong>Trackable request</strong>
              <small>Your request is saved to your account.</small>
            </div>
          </div>
        </div>

        <form className="help-support-form" onSubmit={handleSubmit}>
          <div className="help-form-heading">
            <span>SUPPORT REQUEST</span>
            <h3>Send us a message</h3>
          </div>

          {success && (
            <div className="help-success-message">
              ✓ Your support request has been submitted successfully.
            </div>
          )}

          {error && <div className="help-error-message">{error}</div>}

          <label htmlFor="help-subject">Subject</label>
          <input
            id="help-subject"
            type="text"
            placeholder="What do you need help with?"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            maxLength={120}
            required
          />

          <label htmlFor="help-category">Category</label>
          <select
            id="help-category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <label htmlFor="help-message">Describe your issue</label>
          <textarea
            id="help-message"
            placeholder="Explain your question or problem in detail..."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            minLength={15}
            maxLength={3000}
            rows={5}
            required
          />

          <div className="help-form-footer">
            <small>{message.length}/3000 characters</small>
            <button type="submit" disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit request'}
              <span>→</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  )
}

export default HelpCenter
