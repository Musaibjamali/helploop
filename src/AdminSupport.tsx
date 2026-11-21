
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import './AdminSupport.css'

type SupportRequest = {
  id: string
  user_id: string
  subject: string
  category: string
  message: string
  status: string
  created_at: string
}

type PostReport = {
  id: string
  post_id: string
  reporter_id: string
  reason: string
  details: string | null
  status: 'pending' | 'reviewed' | 'resolved'
  created_at: string
  post_content?: string
  post_owner?: string
  post_username?: string
  reporter_name?: string
  reporter_username?: string
}

type ProfileInfo = {
  id: string
  full_name: string | null
  username: string | null
}

function AdminSupport() {
  const [requests, setRequests] = useState<SupportRequest[]>([])
  const [reports, setReports] = useState<PostReport[]>([])

  const [loading, setLoading] = useState(true)
  const [reportsLoading, setReportsLoading] = useState(true)

  const [error, setError] = useState('')
  const [reportsError, setReportsError] = useState('')

  const [updating, setUpdating] = useState<string | null>(null)
  const [updatingReport, setUpdatingReport] = useState<string | null>(null)

  const [filter, setFilter] = useState('all')
  const [reportFilter, setReportFilter] = useState('all')

  const loadRequests = useCallback(async () => {
    setLoading(true)
    setError('')

    const { data, error: fetchError } = await supabase
      .from('support_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
    } else {
      setRequests((data ?? []) as SupportRequest[])
    }

    setLoading(false)
  }, [])

  const loadReports = useCallback(async () => {
    setReportsLoading(true)
    setReportsError('')

    const { data, error: fetchError } = await supabase
      .from('post_reports')
      .select('*')
      .order('created_at', { ascending: false })

    if (fetchError) {
      setReportsError(fetchError.message)
      setReportsLoading(false)
      return
    }

    const reportList = (data ?? []) as PostReport[]

    if (reportList.length === 0) {
      setReports([])
      setReportsLoading(false)
      return
    }

    const postIds = [...new Set(reportList.map(report => report.post_id))]
    const userIds = [...new Set(reportList.map(report => report.reporter_id))]

    const { data: postData } = await supabase
      .from('posts')
      .select('id, content, user_id')
      .in('id', postIds)

    const posts = postData ?? []

    const ownerIds = posts.map(post => post.user_id)
    const allUserIds = [...new Set([...userIds, ...ownerIds])]

    const { data: profileData } = await supabase
      .from('profiles')
      .select('id, full_name, username')
      .in('id', allUserIds)

    const profiles = (profileData ?? []) as ProfileInfo[]

    const enrichedReports = reportList.map(report => {
      const post = posts.find(item => item.id === report.post_id)

      const reporter = profiles.find(
        profile => profile.id === report.reporter_id
      )

      const owner = profiles.find(
        profile => profile.id === post?.user_id
      )

      return {
        ...report,
        post_content: post?.content || 'Post unavailable or deleted',
        post_owner: owner?.full_name || 'Unknown user',
        post_username: owner?.username || '',
        reporter_name: reporter?.full_name || 'Unknown user',
        reporter_username: reporter?.username || '',
      }
    })

    setReports(enrichedReports)
    setReportsLoading(false)
  }, [])

  useEffect(() => {
    void loadRequests()
    void loadReports()
  }, [loadRequests, loadReports])

  async function updateStatus(id: string, status: string) {
    setUpdating(id)
    setError('')

    const { error: updateError } = await supabase
      .from('support_requests')
      .update({ status })
      .eq('id', id)

    if (updateError) {
      setError(updateError.message)
    } else {
      setRequests(current =>
        current.map(request =>
          request.id === id ? { ...request, status } : request
        )
      )
    }

    setUpdating(null)
  }

  async function updateReportStatus(
    id: string,
    status: PostReport['status']
  ) {
    setUpdatingReport(id)
    setReportsError('')

    const { error: updateError } = await supabase
      .from('post_reports')
      .update({ status })
      .eq('id', id)

    if (updateError) {
      setReportsError(updateError.message)
    } else {
      setReports(current =>
        current.map(report =>
          report.id === id ? { ...report, status } : report
        )
      )
    }

    setUpdatingReport(null)
  }

  const filteredRequests = requests.filter(request =>
    filter === 'all' ? true : request.status === filter
  )

  const filteredReports = reports.filter(report =>
    reportFilter === 'all'
      ? true
      : report.status === reportFilter
  )

  const pendingCount = requests.filter(
    request => request.status === 'pending'
  ).length

  const progressCount = requests.filter(
    request => request.status === 'in_progress'
  ).length

  const resolvedCount = requests.filter(
    request => request.status === 'resolved'
  ).length

  const pendingReports = reports.filter(
    report => report.status === 'pending'
  ).length

  const reviewedReports = reports.filter(
    report => report.status === 'reviewed'
  ).length

  const resolvedReports = reports.filter(
    report => report.status === 'resolved'
  ).length

  return (
    <div className="admin-support-page">
      <section className="admin-support-hero">
        <div>
          <span className="admin-support-kicker">
            HELPLOOP ADMINISTRATION
          </span>
          <h2>Support Dashboard</h2>
          <p>Manage user requests and keep track of support activity.</p>
        </div>

        <button
          onClick={() => {
            void loadRequests()
            void loadReports()
          }}
          disabled={loading || reportsLoading}
        >
          ↻ Refresh Dashboard
        </button>
      </section>

      <section className="admin-support-stats">
        <article>
          <span className="admin-stat-icon">▤</span>
          <small>Total requests</small>
          <strong>{requests.length}</strong>
        </article>

        <article>
          <span className="admin-stat-icon pending-icon">◷</span>
          <small>Pending</small>
          <strong>{pendingCount}</strong>
        </article>

        <article>
          <span className="admin-stat-icon progress-icon">↻</span>
          <small>In progress</small>
          <strong>{progressCount}</strong>
        </article>

        <article>
          <span className="admin-stat-icon resolved-icon">✓</span>
          <small>Resolved</small>
          <strong>{resolvedCount}</strong>
        </article>
      </section>

      <section className="admin-request-section">
        <div className="admin-request-heading">
          <div>
            <span className="admin-support-kicker">
              USER COMMUNICATION
            </span>
            <h3>Support requests</h3>
          </div>

          <select
            value={filter}
            onChange={event => setFilter(event.target.value)}
            aria-label="Filter support requests"
          >
            <option value="all">All requests</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        {error && (
          <div className="admin-support-error">{error}</div>
        )}

        {loading ? (
          <div className="admin-support-empty">
            Loading support requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="admin-support-empty">
            <span>✦</span>
            <strong>No support requests found</strong>
            <p>New user requests will appear here.</p>
          </div>
        ) : (
          <div className="admin-request-list">
            {filteredRequests.map(request => (
              <article
                className="admin-request-card"
                key={request.id}
              >
                <div className="admin-request-top">
                  <div>
                    <span className="admin-request-category">
                      {request.category}
                    </span>
                    <h4>{request.subject}</h4>
                  </div>

                  <span
                    className={`admin-request-status status-${request.status}`}
                  >
                    {request.status.replace('_', ' ')}
                  </span>
                </div>

                <p className="admin-request-message">
                  {request.message}
                </p>

                <div className="admin-request-meta">
                  <span>
                    User ID: {request.user_id.slice(0, 8)}...
                  </span>
                  <span>
                    {new Date(request.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="admin-request-actions">
                  <label htmlFor={`status-${request.id}`}>
                    Update status
                  </label>

                  <select
                    id={`status-${request.id}`}
                    value={request.status}
                    disabled={updating === request.id}
                    onChange={event =>
                      void updateStatus(request.id, event.target.value)
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>

                  {updating === request.id && <small>Saving...</small>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="admin-request-section" style={{ marginTop: 28 }}>
        <div className="admin-request-heading">
          <div>
            <span className="admin-support-kicker">
              COMMUNITY SAFETY
            </span>
            <h3>Community Reports 🛡️</h3>
            <p>Review posts reported by HelpLoop users.</p>
          </div>

          <select
            value={reportFilter}
            onChange={event => setReportFilter(event.target.value)}
            aria-label="Filter community reports"
          >
            <option value="all">All reports</option>
            <option value="pending">Pending</option>
            <option value="reviewed">Reviewed</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>

        <div className="admin-support-stats" style={{ marginBottom: 18 }}>
          <article>
            <small>Total reports</small>
            <strong>{reports.length}</strong>
          </article>

          <article>
            <small>Pending</small>
            <strong>{pendingReports}</strong>
          </article>

          <article>
            <small>Reviewed</small>
            <strong>{reviewedReports}</strong>
          </article>

          <article>
            <small>Resolved</small>
            <strong>{resolvedReports}</strong>
          </article>
        </div>

        {reportsError && (
          <div className="admin-support-error">
            {reportsError}
          </div>
        )}

        {reportsLoading ? (
          <div className="admin-support-empty">
            Loading community reports...
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="admin-support-empty">
            <span>🛡️</span>
            <strong>No reports found</strong>
            <p>New community reports will appear here.</p>
          </div>
        ) : (
          <div className="admin-request-list">
            {filteredReports.map(report => (
              <article
                className="admin-request-card"
                key={report.id}
              >
                <div className="admin-request-top">
                  <div>
                    <span className="admin-request-category">
                      {report.reason}
                    </span>
                    <h4>Reported Community Post</h4>
                  </div>

                  <span
                    className={`admin-request-status status-${report.status}`}
                  >
                    {report.status}
                  </span>
                </div>

                <div style={{
                  background: '#f7f7fc',
                  borderRadius: 12,
                  padding: 14,
                  marginTop: 12,
                  overflowWrap: 'anywhere',
                }}>
                  <strong>Reported content</strong>
                  <p style={{ lineHeight: 1.6, marginBottom: 10 }}>
                    {report.post_content}
                  </p>

                  <small>
                    Post owner: {report.post_owner}
                    {report.post_username
                      ? ` (@${report.post_username})`
                      : ''}
                  </small>
                </div>

                <div style={{ marginTop: 13 }}>
                  <strong>Reported by</strong>
                  <p style={{ margin: '5px 0' }}>
                    {report.reporter_name}
                    {report.reporter_username
                      ? ` (@${report.reporter_username})`
                      : ''}
                  </p>
                </div>

                {report.details && (
                  <div style={{
                    background: '#fffaf0',
                    padding: 12,
                    borderRadius: 10,
                    marginTop: 12,
                  }}>
                    <strong>Additional details</strong>
                    <p style={{
                      marginBottom: 0,
                      overflowWrap: 'anywhere',
                    }}>
                      {report.details}
                    </p>
                  </div>
                )}

                <div className="admin-request-meta">
                  <span>
                    Report ID: {report.id.slice(0, 8)}...
                  </span>
                  <span>
                    {new Date(report.created_at).toLocaleString()}
                  </span>
                </div>

                <div className="admin-request-actions">
                  <label htmlFor={`report-status-${report.id}`}>
                    Update report status
                  </label>

                  <select
                    id={`report-status-${report.id}`}
                    value={report.status}
                    disabled={updatingReport === report.id}
                    onChange={event =>
                      void updateReportStatus(
                        report.id,
                        event.target.value as PostReport['status']
                      )
                    }
                  >
                    <option value="pending">Pending</option>
                    <option value="reviewed">Reviewed</option>
                    <option value="resolved">Resolved</option>
                  </select>

                  {updatingReport === report.id && (
                    <small>Saving...</small>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default AdminSupport
