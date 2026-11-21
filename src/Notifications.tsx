
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import './Notifications.css'

export type NotificationItem = {
  id: string
  recipient_id: string
  sender_id: string | null
  type: 'like' | 'comment' | 'message'
  post_id: string | null
  comment_id: string | null
  message_id: string | null
  conversation_id: string | null
  is_read: boolean
  created_at: string
  sender_name: string
  sender_username: string
}

export function useNotifications(userId?: string) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([])
      setLoading(false)
      return
    }

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Notifications error:', error.message)
      setLoading(false)
      return
    }

    const rows = data || []
    const senderIds = [...new Set(
      rows.map(item => item.sender_id).filter(Boolean)
    )] as string[]

    let profiles: {
      id: string
      full_name: string | null
      username: string | null
    }[] = []

    if (senderIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', senderIds)

      profiles = profileData || []
    }

    const result: NotificationItem[] = rows.map(item => {
      const sender = profiles.find(p => p.id === item.sender_id)

      return {
        ...item,
        sender_name: sender?.full_name || sender?.username || 'A user',
        sender_username: sender?.username || '',
      }
    })

    setNotifications(result)
    setLoading(false)
  }, [userId])

  useEffect(() => {
    loadNotifications()

    if (!userId) return

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        () => loadNotifications()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, loadNotifications])

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('recipient_id', userId!)

    if (!error) {
      setNotifications(current =>
        current.map(item =>
          item.id === id ? { ...item, is_read: true } : item
        )
      )
    }
  }

  const markAllRead = async () => {
    if (!userId) return

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('is_read', false)

    if (!error) {
      setNotifications(current =>
        current.map(item => ({ ...item, is_read: true }))
      )
    }
  }

  const unreadCount = notifications.filter(item => !item.is_read).length

  return {
    notifications,
    loading,
    unreadCount,
    markRead,
    markAllRead,
    refreshNotifications: loadNotifications,
  }
}

function notificationText(item: NotificationItem) {
  if (item.type === 'like') return 'liked your post.'
  if (item.type === 'comment') return 'commented on your post.'
  return 'sent you a message.'
}

function notificationTime(date: string) {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  )

  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`

  return new Date(date).toLocaleDateString()
}

type NotificationProps = {
  notifications: NotificationItem[]
  unreadCount: number
  loading: boolean
  onRead: (id: string) => void
  onNavigate: (item: NotificationItem) => void
  onViewAll: () => void
}

export function NotificationBell({
  notifications,
  unreadCount,
  loading,
  onRead,
  onNavigate,
  onViewAll,
}: NotificationProps) {
  const [open, setOpen] = useState(false)

  function handleOpen(item: NotificationItem) {
    if (!item.is_read) onRead(item.id)
    setOpen(false)
    onNavigate(item)
  }

  return (
    <div className="notification-bell-wrap">
      <button
        className="icon-button notification-bell"
        aria-label="Notifications"
        onClick={() => setOpen(!open)}
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-count">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <button
            className="notification-overlay"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />

          <div className="notification-dropdown">
            <div className="notification-dropdown-header">
              <strong>Notifications</strong>
              <button onClick={() => {
                setOpen(false)
                onViewAll()
              }}>
                View all
              </button>
            </div>

            {loading ? (
              <p className="notification-empty">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="notification-empty">
                No notifications yet.
              </p>
            ) : (
              notifications.slice(0, 6).map(item => (
                <button
                  key={item.id}
                  className={`notification-item ${!item.is_read ? 'unread' : ''}`}
                  onClick={() => handleOpen(item)}
                >
                  <span className="notification-avatar">
                    {item.type === 'like' ? '❤️' :
                      item.type === 'comment' ? '💬' : '✉️'}
                  </span>

                  <span className="notification-content">
                    <span>
                      <strong>{item.sender_name}</strong>{' '}
                      {notificationText(item)}
                    </span>
                    <small>{notificationTime(item.created_at)}</small>
                  </span>

                  {!item.is_read && (
                    <span className="notification-dot" />
                  )}
                </button>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function NotificationsPage({
  notifications,
  loading,
  onRead,
  onMarkAllRead,
  onNavigate,
}: NotificationProps & {
  onMarkAllRead: () => void
}) {
  return (
    <section className="notifications-page">
      <div className="notifications-page-heading">
        <div>
          <span className="eyebrow">STAY CONNECTED</span>
          <h2>Your Notifications</h2>
          <p>See what's happening in your HelpLoop community.</p>
        </div>

        <button
          className="notification-mark-all"
          onClick={onMarkAllRead}
        >
          Mark all as read
        </button>
      </div>

      <div className="notifications-list">
        {loading ? (
          <p className="notification-empty">Loading notifications...</p>
        ) : notifications.length === 0 ? (
          <div className="notification-no-data">
            <span>🔔</span>
            <h3>You're all caught up!</h3>
            <p>New likes, comments and messages will appear here.</p>
          </div>
        ) : (
          notifications.map(item => (
            <button
              key={item.id}
              className={`notification-item ${!item.is_read ? 'unread' : ''}`}
              onClick={() => {
                if (!item.is_read) onRead(item.id)
                onNavigate(item)
              }}
            >
              <span className="notification-avatar">
                {item.type === 'like' ? '❤️' :
                  item.type === 'comment' ? '💬' : '✉️'}
              </span>

              <span className="notification-content">
                <span>
                  <strong>{item.sender_name}</strong>{' '}
                  {notificationText(item)}
                </span>
                <small>{notificationTime(item.created_at)}</small>
              </span>

              {!item.is_read && (
                <span className="notification-dot" />
              )}
            </button>
          ))
        )}
      </div>
    </section>
  )
}
