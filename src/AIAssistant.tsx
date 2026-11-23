
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { supabase } from './supabase'
import './AIAssistant.css'
import LiveVoice from './LiveVoice'

type Attachment = {
  name: string
  mimeType: string
  data: string
}

type ChatMessage = {
  id: string
  role: 'user' | 'model'
  content: string
}

type AIConversation = {
  id: string
  title: string
  updated_at: string
}

const suggestions = [
  'Explain a difficult study topic in simple words',
  'Help me write a professional email',
  'Teach me a programming concept',
  'Suggest skills I can learn for my career',
]

const MAX_FILES = 3
const MAX_TOTAL_SIZE = 7 * 1024 * 1024

function detectLanguage(text: string) {
  if (/[ٻڄڏڊڙڳڪ]/.test(text)) return 'sd-PK'
  if (/[\u0600-\u06FF]/.test(text)) return 'ur-PK'

  if (/\b(aur|hai|hain|kya|kaise|mera|mujhe|aap|nahi|kyun|karo|karna|chahiye|mein|main|hy|hay|haan|salam)\b/i.test(text)) {
    return 'ur-PK'
  }

  return 'en-US'
}

async function fileToAttachment(file: File): Promise<Attachment> {
  let uploadBlob: Blob = file
  let mimeType = file.type

  // Resize and compress images before sending them to Gemini.
  if (file.type.startsWith('image/')) {
    const bitmap = await createImageBitmap(file)
    const maxDimension = 1440
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')

    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))

    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      throw new Error(`Could not process ${file.name}`)
    }

    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const compressed = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error(`Could not compress ${file.name}`)),
        'image/jpeg',
        0.78,
      )
    })

    uploadBlob = compressed
    mimeType = 'image/jpeg'
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = reader.result

      if (typeof result !== 'string') {
        reject(new Error(`Could not read ${file.name}`))
        return
      }

      resolve({
        name: file.name,
        mimeType,
        data: result.split(',')[1],
      })
    }

    reader.onerror = () => reject(new Error(`Could not read ${file.name}`))
    reader.readAsDataURL(uploadBlob)
  })
}

let currentVoicelyAudio: HTMLAudioElement | null = null
const urduAudioCache = new Map<string, Blob>()

function AIAssistant() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<AIConversation[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [deletingHistory, setDeletingHistory] = useState(false)
  const [error, setError] = useState('')
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const [recording, setRecording] = useState(false)

  const endRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const recognitionRef = useRef<any>(null)

  async function loadConversations() {
    setHistoryLoading(true)

    try {
      const { data: authData } = await supabase.auth.getUser()

      if (!authData.user) {
        setConversations([])
        return
      }

      const { data, error: queryError } = await supabase
        .from('ai_conversations')
        .select('id, title, updated_at')
        .eq('user_id', authData.user.id)
        .order('updated_at', { ascending: false })

      if (queryError) throw queryError

      setConversations((data ?? []) as AIConversation[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load chat history.')
    } finally {
      setHistoryLoading(false)
    }
  }

  useEffect(() => {
    void loadConversations()
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end',
    })
  }, [messages, loading])

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }

      if (currentVoicelyAudio) {
        currentVoicelyAudio.pause()
        currentVoicelyAudio = null
      }

      recognitionRef.current?.stop()
    }
  }, [])

  async function speakMessage(message: ChatMessage) {
    if (!('speechSynthesis' in window)) {
      setError('Voice playback is not supported in this browser.')
      return
    }

    if (speakingMessageId === message.id) {
      window.speechSynthesis.cancel()

      if (currentVoicelyAudio) {
        currentVoicelyAudio.pause()
        currentVoicelyAudio.currentTime = 0
        URL.revokeObjectURL(currentVoicelyAudio.src)
        currentVoicelyAudio = null
      }

      setSpeakingMessageId(null)
      return
    }

    window.speechSynthesis.cancel()

    if (currentVoicelyAudio) {
      currentVoicelyAudio.pause()
      URL.revokeObjectURL(currentVoicelyAudio.src)
      currentVoicelyAudio = null
    }

    const language = detectLanguage(message.content).toLowerCase()

  
    // Urdu: Voicely female voice with progressive streaming
    if (language.startsWith('ur')) {
      let audioUrl = ''

      try {
        setError('')
        setSpeakingMessageId(message.id)

        const cachedAudio = urduAudioCache.get(message.content)

        // Cached audio: play immediately
        if (cachedAudio) {
          audioUrl = URL.createObjectURL(cachedAudio)
          const audio = new Audio(audioUrl)
          currentVoicelyAudio = audio

          audio.onended = () => {
            URL.revokeObjectURL(audioUrl)
            currentVoicelyAudio = null
            setSpeakingMessageId(null)
          }

          audio.onerror = () => {
            URL.revokeObjectURL(audioUrl)
            currentVoicelyAudio = null
            setSpeakingMessageId(null)
            setError('Urdu voice playback failed.')
          }

          await audio.play()
          return
        }

        console.time('Urdu TTS First Audio')

        const mediaSource = new MediaSource()
        audioUrl = URL.createObjectURL(mediaSource)

        const audio = new Audio()
        audio.src = audioUrl
        currentVoicelyAudio = audio

        audio.onended = () => {
          URL.revokeObjectURL(audioUrl)
          currentVoicelyAudio = null
          setSpeakingMessageId(null)
        }

        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl)
          currentVoicelyAudio = null
          setSpeakingMessageId(null)
          setError('Urdu voice playback failed.')
        }

        await new Promise<void>((resolve, reject) => {
          mediaSource.addEventListener('sourceopen', () => resolve(), { once: true })
          mediaSource.addEventListener('error', () => reject(new Error('MediaSource failed.')), { once: true })
        })

        const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg')

        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession()

        if (sessionError) throw sessionError

        const accessToken =
          sessionData.session?.access_token ||
          import.meta.env.VITE_SUPABASE_ANON_KEY

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-tts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ text: message.content }),
          }
        )

        if (!response.ok || !response.body) {
          throw new Error('Voice service response failed.')
        }

        const reader = response.body.getReader()
        const audioChunks: Uint8Array[] = []
        let firstChunkPlayed = false

        const appendChunk = (chunk: Uint8Array) =>
          new Promise<void>((resolve, reject) => {
            const onUpdate = () => {
              sourceBuffer.removeEventListener('error', onError)
              resolve()
            }

            const onError = () => {
              sourceBuffer.removeEventListener('updateend', onUpdate)
              reject(new Error('Audio streaming failed.'))
            }

            sourceBuffer.addEventListener('updateend', onUpdate, { once: true })
            sourceBuffer.addEventListener('error', onError, { once: true })

            try {
              sourceBuffer.appendBuffer(chunk.slice().buffer as ArrayBuffer)
            } catch (error) {
              sourceBuffer.removeEventListener('updateend', onUpdate)
              sourceBuffer.removeEventListener('error', onError)
              reject(error)
            }
          })

        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          audioChunks.push(value)
          await appendChunk(value)

          if (!firstChunkPlayed) {
            firstChunkPlayed = true
            console.timeEnd('Urdu TTS First Audio')
            await audio.play()
          }
        }

        if (!firstChunkPlayed) {
          throw new Error('No audio received.')
        }

        if (mediaSource.readyState === 'open') {
          mediaSource.endOfStream()
        }

        // Save complete audio for instant replay
        const completeAudio = new Blob(
  audioChunks.map(chunk => chunk.slice().buffer as ArrayBuffer),
  { type: 'audio/mpeg' }
)
        urduAudioCache.set(message.content, completeAudio)

      } catch (error) {
        console.error('Urdu TTS error:', error)

        if (currentVoicelyAudio) {
          currentVoicelyAudio.pause()
          currentVoicelyAudio = null
        }

        if (audioUrl) URL.revokeObjectURL(audioUrl)

        setSpeakingMessageId(null)
        setError('Urdu voice service failed. Please try again.')
      }

      return
    }

    // Other languages: existing browser voice
    const utterance = new SpeechSynthesisUtterance(message.content)
    const voices = window.speechSynthesis.getVoices()

    const femaleVoicePattern = /female|zira|sara|heera|google.*urdu/i

    let matchingVoices = voices.filter(voice =>
      voice.lang.toLowerCase().startsWith(language.split('-')[0])
    )

    if (language.startsWith('sd') && matchingVoices.length === 0) {
      matchingVoices = voices.filter(voice =>
        voice.lang.toLowerCase().startsWith('ur')
      )
    }

    const selectedVoice =
      matchingVoices.find(voice => femaleVoicePattern.test(voice.name)) ||
      matchingVoices[0]

    if (selectedVoice) {
      utterance.voice = selectedVoice
      utterance.lang = selectedVoice.lang
    } else {
      utterance.lang = language
    }

    utterance.rate = 0.92
    utterance.pitch = 1.15

    utterance.onend = () => setSpeakingMessageId(null)
    utterance.onerror = () => setSpeakingMessageId(null)

    setSpeakingMessageId(message.id)
    window.speechSynthesis.speak(utterance)
  }

  function toggleMicrophone() {
    if (recording) {
      recognitionRef.current?.stop()
      setRecording(false)
      return
    }

    const browserWindow = window as any
    const Recognition =
      browserWindow.SpeechRecognition ||
      browserWindow.webkitSpeechRecognition

    if (!Recognition) {
      setError('Voice typing is not supported in this browser.')
      return
    }

    try {
      const recognition = new Recognition()

      recognition.lang = 'ur-PK'
      recognition.interimResults = false
      recognition.continuous = false

      recognition.onstart = () => {
        setRecording(true)
        setError('')
      }

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || ''

        if (transcript) {
          setInput(previous =>
            `${previous}${previous ? ' ' : ''}${transcript}`
          )
        }
      }

      recognition.onerror = () => {
        setError('Microphone could not recognize your voice. Please try again.')
        setRecording(false)
      }

      recognition.onend = () => {
        setRecording(false)
      }

      recognitionRef.current = recognition
      recognition.start()
    } catch {
      setRecording(false)
      setError('Could not start microphone. Please try again.')
    }
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files ?? [])
    event.target.value = ''

    if (incoming.length === 0) return

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ]

    const validFiles = incoming.filter(file =>
      allowedTypes.includes(file.type)
    )

    if (validFiles.length !== incoming.length) {
      setError('Only JPG, PNG, WEBP images and PDF files are supported.')
    } else {
      setError('')
    }

    setSelectedFiles(previous => {
      const combined = [...previous, ...validFiles]

      if (combined.length > MAX_FILES) {
        setError('You can attach a maximum of 3 files.')
        return previous
      }

      const totalSize = combined.reduce(
        (total, file) => total + file.size,
        0
      )

      if (totalSize > MAX_TOTAL_SIZE) {
        setError('Total attachment size must be under 7 MB.')
        return previous
      }

      return combined
    })
  }

  function removeFile(index: number) {
    setSelectedFiles(previous =>
      previous.filter((_, fileIndex) => fileIndex !== index)
    )
  }

  async function createConversation(firstMessage: string, userId: string) {
    const { data, error: insertError } = await supabase
      .from('ai_conversations')
      .insert({
        user_id: userId,
        title: firstMessage.slice(0, 60) || 'New chat',
      })
      .select('id, title, updated_at')
      .single()

    if (insertError) throw insertError

    const newConversation = data as AIConversation

    setConversationId(newConversation.id)
    setConversations(current => [newConversation, ...current])

    return newConversation.id
  }

  async function sendMessage(text?: string) {
    const content = (text ?? input).trim()
    const filesToSend = selectedFiles

    if ((!content && filesToSend.length === 0) || loading) return

    setError('')
    setLoading(true)

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    setSpeakingMessageId(null)

    try {
      const attachments = await Promise.all(
        filesToSend.map(fileToAttachment)
      )

      const fileNames = filesToSend.map(file => file.name).join(', ')

      const displayContent = [
        content,
        fileNames ? `Attached files: ${fileNames}` : '',
      ].filter(Boolean).join('\n\n')

      const messageContent =
        content || `Please review these attached files: ${fileNames}`

      const userMessage: ChatMessage = {
        id: `${Date.now()}-user`,
        role: 'user',
        content: displayContent,
      }

      const { data: authData, error: authError } =
        await supabase.auth.getUser()

      if (authError || !authData.user) {
        throw new Error('Please sign in again to use HelpLoop AI.')
      }

      const activeConversationId =
        conversationId ??
        await createConversation(
          content || fileNames || 'New chat',
          authData.user.id
        )

      const { error: saveUserError } = await supabase
        .from('ai_messages')
        .insert({
          conversation_id: activeConversationId,
          user_id: authData.user.id,
          role: 'user',
          content: displayContent || messageContent,
        })

      if (saveUserError) throw saveUserError

      const previousMessages = messages.map(message => ({
        role: message.role,
        content: message.content,
      }))

      const requestMessages = [
        ...previousMessages,
        {
          role: 'user',
          content: messageContent,
          ...(attachments.length > 0 ? { attachments } : {}),
        },
      ]

      setMessages(current => [...current, userMessage])
      setInput('')
      setSelectedFiles([])

      const { data, error: functionError } =
        await supabase.functions.invoke('ai-assistant', {
          body: {
            messages: requestMessages,
          },
        })

      if (functionError) {
        let errorMessage =
          functionError.message || 'Could not connect to AI.'

        try {
          const response =
            (functionError as { context?: Response }).context

          if (response) {
            const body = await response.clone().json()

            if (typeof body?.error === 'string') {
              errorMessage = body.error
            }
          }
        } catch {
          // Keep original error.
        }

        throw new Error(errorMessage)
      }

      if (!data || typeof data.reply !== 'string' || !data.reply.trim()) {
        throw new Error(data?.error || 'AI did not return a response.')
      }

      const reply = data.reply.trim()

      const { data: savedReply, error: saveReplyError } =
        await supabase
          .from('ai_messages')
          .insert({
            conversation_id: activeConversationId,
            user_id: authData.user.id,
            role: 'model',
            content: reply,
          })
          .select('id')
          .single()

      if (saveReplyError) throw saveReplyError

      const modelMessage: ChatMessage = {
        id: savedReply.id,
        role: 'model',
        content: reply,
      }

      setMessages(current => [...current, modelMessage])

      const now = new Date().toISOString()

      await supabase
        .from('ai_conversations')
        .update({ updated_at: now })
        .eq('id', activeConversationId)
        .eq('user_id', authData.user.id)

      setConversations(current =>
        current
          .map(item =>
            item.id === activeConversationId
              ? { ...item, updated_at: now }
              : item
          )
          .sort((a, b) =>
            b.updated_at.localeCompare(a.updated_at)
          )
      )
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong. Please try again.'
      )
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  async function deleteAllHistory() {
    if (loading || deletingHistory || conversations.length === 0) return

    const confirmed = window.confirm(
      'Delete all your HelpLoop AI chat history? This cannot be undone.',
    )
    if (!confirmed) return

    setDeletingHistory(true)
    setError('')

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData.user) {
        throw new Error('Please sign in again to delete your chat history.')
      }

      // Delete only rows owned by the signed-in user.
      const { error: messagesError } = await supabase
        .from('ai_messages')
        .delete()
        .eq('user_id', authData.user.id)

      if (messagesError) throw messagesError

      const { error: conversationsError } = await supabase
        .from('ai_conversations')
        .delete()
        .eq('user_id', authData.user.id)

      if (conversationsError) throw conversationsError

      setConversations([])
      setMessages([])
      setConversationId(null)
      setInput('')
      setSelectedFiles([])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not delete your chat history.',
      )
    } finally {
      setDeletingHistory(false)
    }
  }

  async function openConversation(item: AIConversation) {
    if (loading) return

    setError('')
    setInput('')
    setSelectedFiles([])
    setConversationId(item.id)
    setMessages([])
    setLoading(true)

    try {
      const { data: authData } = await supabase.auth.getUser()

      if (!authData.user) {
        throw new Error('Please sign in again.')
      }

      const { data, error: queryError } = await supabase
        .from('ai_messages')
        .select('id, role, content')
        .eq('conversation_id', item.id)
        .eq('user_id', authData.user.id)
        .order('created_at', { ascending: true })

      if (queryError) throw queryError

      setMessages((data ?? []) as ChatMessage[])
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not open this conversation.'
      )
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void sendMessage()
  }

  function startNewChat() {
    if (loading) return

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }

    recognitionRef.current?.stop()

    setRecording(false)
    setSpeakingMessageId(null)
    setConversationId(null)
    setMessages([])
    setInput('')
    setSelectedFiles([])
    setError('')
    inputRef.current?.focus()
  }

  return (
    <section className="ai-page">
      <LiveVoice />

      <div className="ai-heading-row">
        <div>
          <span className="ai-eyebrow">YOUR HELPFUL COMPANION</span>
          <h2>Meet HelpLoop AI</h2>
          <p>Ask questions, learn something new, or turn an idea into a plan.</p>
        </div>

        <button
          type="button"
          className="ai-new-chat"
          onClick={startNewChat}
          disabled={loading}
        >
          <span>＋</span> New chat
        </button>
      </div>

      <div className="ai-layout">
        <aside className="ai-history">
          <div className="ai-history-heading">
            <strong>Chat history</strong>
            <span>{conversations.length}</span>
            <button
              type="button"
              className="ai-new-chat"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              onClick={() => void deleteAllHistory()}
              disabled={loading || historyLoading || deletingHistory || conversations.length === 0}
              title="Delete all your saved AI chats"
            >
              {deletingHistory ? 'Deleting…' : 'Delete all'}
            </button>
          </div>

          {historyLoading ? (
            <p className="ai-history-empty">Loading chats...</p>
          ) : conversations.length === 0 ? (
            <p className="ai-history-empty">
              Your saved chats will appear here.
            </p>
          ) : (
            <div className="ai-history-list">
              {conversations.map(item => (
                <button
                  type="button"
                  key={item.id}
                  className={`ai-history-item ${
                    conversationId === item.id ? 'active' : ''
                  }`}
                  onClick={() => void openConversation(item)}
                  disabled={loading}
                  title={item.title}
                >
                  <span className="ai-history-icon">▤</span>
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="ai-chat-shell">
          <div className="ai-chat-topline">
            <div className="ai-status">
              <span className="ai-orb">✦</span>
              <span>
                <strong>HelpLoop AI</strong>
                <small><i /> Ready to help</small>
              </span>
            </div>

            <span className="ai-language-note">
              English · اردو · Roman Urdu · سنڌي
            </span>
          </div>

          <div className="ai-conversation" aria-live="polite">
            {messages.length === 0 ? (
              <div className="ai-empty-state">
                <div className="ai-welcome-symbol">✦</div>
                <h3>What would you like help with?</h3>
                <p>
                  I'm here to help you learn, create, solve problems and explore ideas.
                </p>

                <div className="ai-suggestions">
                  {suggestions.map(suggestion => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => void sendMessage(suggestion)}
                      disabled={loading}
                    >
                      <span>↗</span>
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="ai-message-list">
                {messages.map(message => (
                  <article
                    className={`ai-message ai-message-${message.role}`}
                    key={message.id}
                  >
                    {message.role === 'model' && (
                      <span className="ai-message-avatar">✦</span>
                    )}

                    <div className="ai-message-bubble">
                      <span className="ai-message-label">
                        {message.role === 'user' ? 'You' : 'HelpLoop AI'}
                      </span>

                      <p>{message.content}</p>

                      {message.role === 'model' && (
                        <button
                          type="button"
                          className="ai-listen-button"
                          onClick={() => speakMessage(message)}
                        >
                          {speakingMessageId === message.id
                            ? '⏹ Stop'
                            : '🔊 Listen'}
                        </button>
                      )}
                    </div>

                    {message.role === 'user' && (
                      <span className="ai-user-avatar">You</span>
                    )}
                  </article>
                ))}

                {loading && (
                  <div className="ai-message ai-message-model">
                    <span className="ai-message-avatar">✦</span>
                    <div className="ai-message-bubble ai-typing-bubble">
                      <span className="ai-message-label">HelpLoop AI</span>
                      <span className="ai-typing">
                        <i /><i /><i />
                      </span>
                    </div>
                  </div>
                )}

                <div ref={endRef} />
              </div>
            )}
          </div>

          {error && (
            <div className="ai-error" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')}>
                Dismiss
              </button>
            </div>
          )}

          {selectedFiles.length > 0 && (
            <div className="ai-selected-files">
              {selectedFiles.map((file, index) => (
                <div className="ai-file-chip" key={`${file.name}-${index}`}>
                  <span>📎 {file.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    aria-label={`Remove ${file.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          <form className="ai-composer" onSubmit={handleSubmit}>
            <div className="ai-composer-tools">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                multiple
                hidden
                onChange={handleFileSelect}
              />

              <button
                type="button"
                className="ai-tool-button"
                onClick={() => fileRef.current?.click()}
                disabled={loading}
                title="Attach image or PDF"
                aria-label="Attach image or PDF"
              >
                ＋
              </button>

              <button
                type="button"
                className={`ai-tool-button ${recording ? 'recording' : ''}`}
                onClick={toggleMicrophone}
                disabled={loading}
                title="Voice typing"
                aria-label="Voice typing"
              >
                {recording ? '■' : '🎙'}
              </button>
            </div>

            <textarea
              ref={inputRef}
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void sendMessage()
                }
              }}
              placeholder="Message HelpLoop AI..."
              rows={1}
              maxLength={10000}
              disabled={loading}
              aria-label="Write your message"
            />

            <button
              type="submit"
              className="ai-send-button"
              disabled={(!input.trim() && selectedFiles.length === 0) || loading}
              aria-label="Send message"
            >
              {loading ? '…' : '➤'}
            </button>

            <small>AI can make mistakes. Check important information.</small>
          </form>
        </div>
      </div>
    </section>
  )
}

export default AIAssistant
