
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { supabase } from './supabase'
import './Messages.css'

type ChatUser = {
  id: string
  username: string | null
  full_name: string | null
  avatar_path: string | null
}

type Conversation = {
  conversation_id: string
  other_user_id: string
  other_username: string | null
  other_full_name: string | null
  other_avatar_path: string | null
  last_message: string | null
  last_message_at: string
  unread_count: number
}

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  image_path: string | null
  reply_to_id: string | null
  created_at: string
  edited_at: string | null
  deleted_at: string | null
}

type Reaction = {
  message_id: string
  user_id: string
  reaction: string
}

const EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🔥']

export default function Messages() {
  const [userId, setUserId] = useState('')
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reactions, setReactions] = useState<Reaction[]>([])
  const [search, setSearch] = useState('')
  const [users, setUsers] = useState<ChatUser[]>([])
  const [blocked, setBlocked] = useState<string[]>([])
  const [draft, setDraft] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [reply, setReply] = useState<Message | null>(null)
  const [editing, setEditing] = useState<Message | null>(null)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({})
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [onlineUsers, setOnlineUsers] = useState<string[]>([])
  const [reactionMenu, setReactionMenu] = useState('')

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const getAvatarUrl = useCallback(async (path: string | null) => {
    if (!path) return ''
    if (path.startsWith('http')) return path

    const { data } = await supabase.storage
      .from('profile-photos')
      .createSignedUrl(path, 3600)

    return data?.signedUrl || ''
  }, [])

  const loadConversations = useCallback(async () => {
    const { data, error: fetchError } = await supabase.rpc('get_my_conversations')
    if (fetchError) {
      setError(fetchError.message)
      return
    }

    const rows = (data || []) as Conversation[]
    setConversations(rows)

    const urls: Record<string, string> = {}
    await Promise.all(rows.map(async (chat) => {
      const url = await getAvatarUrl(chat.other_avatar_path)
      if (url) urls[chat.other_user_id] = url
    }))
    setAvatarUrls(previous => ({ ...previous, ...urls }))
  }, [getAvatarUrl])

  const loadBlocked = useCallback(async () => {
    const { data } = await supabase.rpc('get_user_blocks')
    setBlocked((data || []).map((item: { blocked_id?: string; user_id?: string }) =>
      item.blocked_id || item.user_id || ''
    ).filter(Boolean))
  }, [])

  const loadMessages = useCallback(async (conversationId: string) => {
    const { data, error: fetchError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError(fetchError.message)
      return
    }

    const rows = (data || []) as Message[]
    setMessages(rows)

    const { data: reactionData } = await supabase
      .from('message_reactions')
      .select('message_id,user_id,reaction')
      .in('message_id', rows.map(item => item.id).length ? rows.map(item => item.id) : ['00000000-0000-0000-0000-000000000000'])

    setReactions((reactionData || []) as Reaction[])

    const urls: Record<string, string> = {}
    await Promise.all(rows.filter(item => item.image_path).map(async item => {
      const { data: signed } = await supabase.storage
        .from('message-photos')
        .createSignedUrl(item.image_path!, 3600)
      if (signed?.signedUrl) urls[item.id] = signed.signedUrl
    }))
    setImageUrls(previous => ({ ...previous, ...urls }))

    const unread = rows.filter(item => item.sender_id !== userId && !item.deleted_at)
    if (unread.length) {
      await supabase.from('message_reads').upsert(
        unread.map(item => ({ message_id: item.id, user_id: userId })),
        { onConflict: 'message_id,user_id', ignoreDuplicates: true }
      )
      await loadConversations()
    }

    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
  }, [userId, loadConversations])

  useEffect(() => {
    let alive = true

    async function init() {
      const { data } = await supabase.auth.getUser()
      if (!alive) return
      if (!data.user) {
        setLoading(false)
        return
      }
      setUserId(data.user.id)
      setLoading(false)
    }

    init()
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!userId) return
    loadConversations()
    loadBlocked()
  }, [userId, loadConversations, loadBlocked])

  useEffect(() => {
    if (!selected || !userId) return

    loadMessages(selected.conversation_id)

    const channel = supabase
      .channel(`messages-${selected.conversation_id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selected.conversation_id}`,
      }, () => {
        loadMessages(selected.conversation_id)
        loadConversations()
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_reactions',
      }, () => loadMessages(selected.conversation_id))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selected, userId, loadMessages, loadConversations])

  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel('helploop-online', {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        setOnlineUsers(Object.keys(state))
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ online_at: new Date().toISOString() })
        }
      })

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  useEffect(() => {
    const term = search.trim()
    if (!term || term.length < 2) {
      setUsers([])
      return
    }

    let active = true
    const timer = setTimeout(async () => {
      const { data, error: searchError } = await supabase.rpc(
        'search_chat_users',
        { search_text: term }
      )

      if (!active) return
      if (searchError) {
        setError(searchError.message)
        return
      }

      const found = (data || []) as ChatUser[]
      setUsers(found)

      const urls: Record<string, string> = {}
      await Promise.all(found.map(async item => {
        const url = await getAvatarUrl(item.avatar_path)
        if (url) urls[item.id] = url
      }))
      if (active) setAvatarUrls(previous => ({ ...previous, ...urls }))
    }, 300)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [search, getAvatarUrl])

  async function openChat(user: ChatUser) {
    setError('')
    const { data, error: chatError } = await supabase.rpc(
      'get_or_create_conversation',
      { other_user: user.id }
    )

    if (chatError || !data) {
      setError(chatError?.message || 'Could not open conversation.')
      return
    }

    const existing = conversations.find(item => item.conversation_id === data)
    const chat: Conversation = existing || {
      conversation_id: data,
      other_user_id: user.id,
      other_username: user.username,
      other_full_name: user.full_name,
      other_avatar_path: user.avatar_path,
      last_message: null,
      last_message_at: new Date().toISOString(),
      unread_count: 0,
    }

    setSelected(chat)
    setMobileChatOpen(true)
    setSearch('')
    setUsers([])
    await loadConversations()
  }

  function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Please choose a JPG, PNG or WEBP image.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5 MB or smaller.')
      return
    }

    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  function clearPhoto() {
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhoto(null)
    setPhotoPreview('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    if (!selected || sending) return
    if (!draft.trim() && !photo && !editing) return

    setSending(true)
    setError('')

    if (editing) {
      const { error: editError } = await supabase
        .from('messages')
        .update({
          body: draft.trim(),
          edited_at: new Date().toISOString(),
        })
        .eq('id', editing.id)
        .eq('sender_id', userId)

      if (editError) setError(editError.message)
      else {
        setEditing(null)
        setDraft('')
        await loadMessages(selected.conversation_id)
      }
      setSending(false)
      return
    }

    let imagePath: string | null = null

    if (photo) {
      const extension = photo.name.split('.').pop()?.toLowerCase() || 'jpg'
      imagePath = `${selected.conversation_id}/${userId}/${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('message-photos')
        .upload(imagePath, photo, { contentType: photo.type, upsert: false })

      if (uploadError) {
        setError(uploadError.message)
        setSending(false)
        return
      }
    }

    const { error: insertError } = await supabase.from('messages').insert({
      conversation_id: selected.conversation_id,
      sender_id: userId,
      body: draft.trim(),
      image_path: imagePath,
      reply_to_id: reply?.id || null,
    })

    if (insertError) {
      if (imagePath) {
        await supabase.storage.from('message-photos').remove([imagePath])
      }
      setError(insertError.message)
    } else {
      await supabase
        .from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', selected.conversation_id)

      setDraft('')
      setReply(null)
      clearPhoto()
      await loadMessages(selected.conversation_id)
      await loadConversations()
    }

    setSending(false)
  }

  async function deleteMessage(message: Message) {
    if (!confirm('Delete this message?')) return

    const { error: deleteError } = await supabase
      .from('messages')
      .update({
        body: 'This message was deleted',
        image_path: null,
        deleted_at: new Date().toISOString(),
      })
      .eq('id', message.id)
      .eq('sender_id', userId)

    if (deleteError) setError(deleteError.message)
    else await loadMessages(message.conversation_id)
  }

  async function toggleReaction(messageId: string, emoji: string) {
    const existing = reactions.find(item =>
      item.message_id === messageId && item.user_id === userId
    )

    if (existing?.reaction === emoji) {
      await supabase.from('message_reactions')
        .delete().eq('message_id', messageId).eq('user_id', userId)
    } else {
      await supabase.from('message_reactions').upsert({
        message_id: messageId,
        user_id: userId,
        reaction: emoji,
      }, { onConflict: 'message_id,user_id' })
    }

    setReactionMenu('')
    if (selected) await loadMessages(selected.conversation_id)
  }

  async function toggleBlock() {
    if (!selected) return
    const otherId = selected.other_user_id
    const isBlocked = blocked.includes(otherId)

    if (isBlocked) {
      const { error: unblockError } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', userId)
        .eq('blocked_id', otherId)

      if (unblockError) setError(unblockError.message)
      else {
        setBlocked(previous => previous.filter(id => id !== otherId))
        setSelected(null)
        setMobileChatOpen(false)
        await loadConversations()
      }
    } else {
      if (!confirm('Block this user? You will no longer be able to chat.')) return

      const { error: blockError } = await supabase
        .from('user_blocks')
        .insert({ blocker_id: userId, blocked_id: otherId })

      if (blockError) setError(blockError.message)
      else {
        setBlocked(previous => [...previous, otherId])
        setSelected(null)
        setMobileChatOpen(false)
        await loadConversations()
      }
    }
  }

  function startEdit(message: Message) {
    setEditing(message)
    setReply(null)
    setDraft(message.body)
  }

  function startReply(message: Message) {
    setReply(message)
    setEditing(null)
    setDraft('')
  }

  function formatTime(value: string) {
    return new Date(value).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) return <div className="messages-loading">Loading messages...</div>

  const otherOnline = selected ? onlineUsers.includes(selected.other_user_id) : false

  return (
    <section className="messages-page">
      <div className={`messages-shell ${mobileChatOpen ? 'chat-open' : ''}`}>
        <aside className="messages-sidebar">
          <div className="messages-side-heading">
            <div>
              <span className="messages-eyebrow">STAY CONNECTED</span>
              <h2>Messages</h2>
            </div>
            <span className="messages-count">
              {conversations.reduce((sum, item) => sum + Number(item.unread_count || 0), 0)}
            </span>
          </div>

          <div className="messages-search">
            <span>⌕</span>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Find people by name or username"
            />
          </div>

          {search.trim().length >= 2 && (
            <div className="messages-search-results">
              <strong>People</strong>
              {users.length === 0 ? (
                <p className="messages-muted">No public users found.</p>
              ) : users.map(person => (
                <button key={person.id} className="messages-person" onClick={() => openChat(person)}>
                  <div className="messages-avatar">
                    {avatarUrls[person.id]
                      ? <img src={avatarUrls[person.id]} alt="" />
                      : (person.full_name || person.username || 'U').charAt(0).toUpperCase()}
                  </div>
                  <span>
                    <strong>{person.full_name || person.username || 'HelpLoop user'}</strong>
                    <small>@{person.username || 'user'}</small>
                  </span>
                  <span className="messages-arrow">→</span>
                </button>
              ))}
            </div>
          )}

          <div className="messages-chat-list">
            <div className="messages-list-label">YOUR CHATS</div>
            {conversations.length === 0 ? (
              <div className="messages-empty-list">
                <span>💬</span>
                <strong>No conversations yet</strong>
                <p>Search for a public user above to start chatting.</p>
              </div>
            ) : conversations.map(chat => (
              <button
                key={chat.conversation_id}
                className={`messages-chat-item ${selected?.conversation_id === chat.conversation_id ? 'selected' : ''}`}
                onClick={() => {
                  setSelected(chat)
                  setMobileChatOpen(true)
                }}
              >
                <div className="messages-avatar">
                  {avatarUrls[chat.other_user_id]
                    ? <img src={avatarUrls[chat.other_user_id]} alt="" />
                    : (chat.other_full_name || chat.other_username || 'U').charAt(0).toUpperCase()}
                  {onlineUsers.includes(chat.other_user_id) && <i className="messages-online-dot" />}
                </div>
                <span className="messages-chat-copy">
                  <strong>{chat.other_full_name || chat.other_username || 'HelpLoop user'}</strong>
                  <small>{chat.last_message || 'Start a conversation'}</small>
                </span>
                <span className="messages-chat-meta">
                  {chat.unread_count > 0 && <b>{chat.unread_count}</b>}
                  <small>{chat.last_message_at ? formatTime(chat.last_message_at) : ''}</small>
                </span>
              </button>
            ))}
          </div>
        </aside>

        <main className="messages-conversation">
          {!selected ? (
            <div className="messages-welcome">
              <div className="messages-welcome-icon">💬</div>
              <h2>Your conversations, all in one place.</h2>
              <p>Choose a chat or search for someone to start a private conversation.</p>
            </div>
          ) : (
            <>
              <header className="messages-chat-header">
                <button
                  className="messages-back"
                  onClick={() => setMobileChatOpen(false)}
                  aria-label="Back to chats"
                >←</button>
                <div className="messages-avatar large">
                  {avatarUrls[selected.other_user_id]
                    ? <img src={avatarUrls[selected.other_user_id]} alt="" />
                    : (selected.other_full_name || selected.other_username || 'U').charAt(0).toUpperCase()}
                  {otherOnline && <i className="messages-online-dot" />}
                </div>
                <div className="messages-header-user">
                  <strong>{selected.other_full_name || selected.other_username || 'HelpLoop user'}</strong>
                  <small>{otherOnline ? 'Online' : `@${selected.other_username || 'user'}`}</small>
                </div>
                <button className="messages-block-button" onClick={toggleBlock}>
                  {blocked.includes(selected.other_user_id) ? 'Unblock' : 'Block'}
                </button>
              </header>

              <div className="messages-thread">
                {messages.length === 0 ? (
                  <div className="messages-first">
                    <span>👋</span>
                    <strong>Say hello!</strong>
                    <p>This is the beginning of your conversation.</p>
                  </div>
                ) : messages.map(message => {
                  const mine = message.sender_id === userId
                  const parent = message.reply_to_id
                    ? messages.find(item => item.id === message.reply_to_id)
                    : null
                  const ownReaction = reactions.find(item =>
                    item.message_id === message.id && item.user_id === userId
                  )

                  return (
                    <div key={message.id} className={`messages-row ${mine ? 'mine' : 'theirs'}`}>
                      <div className="messages-bubble-wrap">
                        {parent && (
                          <div className="messages-reply-preview">
                            Replying to: {parent.deleted_at ? 'Deleted message' : parent.body || 'Photo'}
                          </div>
                        )}
                        <article className={`messages-bubble ${mine ? 'mine' : ''}`}>
                          {message.deleted_at ? (
                            <em className="messages-deleted">This message was deleted</em>
                          ) : (
                            <>
                              {message.body && <p>{message.body}</p>}
                              {message.image_path && imageUrls[message.id] && (
                                <a href={imageUrls[message.id]} target="_blank" rel="noreferrer">
                                  <img className="messages-photo" src={imageUrls[message.id]} alt="Shared attachment" />
                                </a>
                              )}
                            </>
                          )}
                          <div className="messages-time">
                            {formatTime(message.created_at)}
                            {message.edited_at && !message.deleted_at ? ' · edited' : ''}
                          </div>
                        </article>

                        {!message.deleted_at && (
                          <div className="messages-tools">
                            <button onClick={() => startReply(message)} title="Reply">↩</button>
                            <button onClick={() => setReactionMenu(reactionMenu === message.id ? '' : message.id)} title="React">☺</button>
                            {mine && <>
                              <button onClick={() => startEdit(message)} title="Edit">✎</button>
                              <button onClick={() => deleteMessage(message)} title="Delete">⌫</button>
                            </>}
                          </div>
                        )}

                        {reactionMenu === message.id && (
                          <div className="messages-reaction-picker">
                            {EMOJIS.map(emoji => (
                              <button key={emoji} onClick={() => toggleReaction(message.id, emoji)}>{emoji}</button>
                            ))}
                          </div>
                        )}

                        {reactions.filter(item => item.message_id === message.id).length > 0 && (
                          <div className="messages-reactions">
                            {EMOJIS.map(emoji => {
                              const count = reactions.filter(item =>
                                item.message_id === message.id && item.reaction === emoji
                              ).length
                              return count ? (
                                <button
                                  key={emoji}
                                  className={ownReaction?.reaction === emoji ? 'active' : ''}
                                  onClick={() => toggleReaction(message.id, emoji)}
                                >{emoji} {count}</button>
                              ) : null
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                <div ref={bottomRef} />
              </div>

              {(reply || editing) && (
                <div className="messages-compose-context">
                  <span>{editing ? 'Editing message' : `Replying to: ${reply?.body || 'Photo'}`}</span>
                  <button onClick={() => { setReply(null); setEditing(null); setDraft('') }}>×</button>
                </div>
              )}

              {photoPreview && (
                <div className="messages-photo-preview">
                  <img src={photoPreview} alt="Preview" />
                  <button onClick={clearPhoto}>×</button>
                </div>
              )}

              <form className="messages-compose" onSubmit={sendMessage}>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={handlePhoto}
                />
                <button
                  type="button"
                  className="messages-attach"
                  onClick={() => fileRef.current?.click()}
                  title="Attach photo"
                  disabled={!!editing}
                >＋</button>
                <textarea
                  value={draft}
                  onChange={event => setDraft(event.target.value)}
                  placeholder={editing ? 'Edit your message...' : 'Write a message...'}
                  rows={1}
                  maxLength={5000}
                />
                <button className="messages-send" type="submit" disabled={sending || (!draft.trim() && !photo)}>
                  {sending ? '...' : editing ? 'Save' : 'Send'}
                </button>
              </form>
            </>
          )}
        </main>
      </div>

      {error && (
        <div className="messages-error">
          <span>{error}</span>
          <button onClick={() => setError('')}>×</button>
        </div>
      )}
    </section>
  )
}
