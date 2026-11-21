
import { useRef, useState } from 'react'
import { GoogleGenAI, Modality } from '@google/genai'
import { supabase } from './supabase'

export default function LiveVoice() {
  const [status, setStatus] = useState('Not connected')
  const [isLive, setIsLive] = useState(false)
  const [transcript, setTranscript] = useState<string[]>([])
  const [error, setError] = useState('')

  const sessionRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const inputContextRef = useRef<AudioContext | null>(null)
  const outputContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const nextPlayTimeRef = useRef(0)
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([])

  function encodeAudio(samples: Float32Array) {
    const bytes = new Int16Array(samples.length)

    for (let i = 0; i < samples.length; i++) {
      const value = Math.max(-1, Math.min(1, samples[i]))
      bytes[i] = value < 0 ? value * 32768 : value * 32767
    }

    const byteArray = new Uint8Array(bytes.buffer)
    let binary = ''

    for (let i = 0; i < byteArray.length; i++) {
      binary += String.fromCharCode(byteArray[i])
    }

    return btoa(binary)
  }

  function stopAudioPlayback() {
    audioSourcesRef.current.forEach(source => {
      try {
        source.stop()
      } catch {
        // Already stopped
      }
    })

    audioSourcesRef.current = []
    nextPlayTimeRef.current = 0
  }

  function playAudio(base64: string) {
    const context = outputContextRef.current
    if (!context) return

    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }

    const samples = new Int16Array(
      bytes.buffer,
      bytes.byteOffset,
      Math.floor(bytes.byteLength / 2)
    )

    const buffer = context.createBuffer(1, samples.length, 24000)
    const channel = buffer.getChannelData(0)

    for (let i = 0; i < samples.length; i++) {
      channel[i] = samples[i] / 32768
    }

    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)

    const startAt = Math.max(context.currentTime, nextPlayTimeRef.current)
    source.start(startAt)

    nextPlayTimeRef.current = startAt + buffer.duration
    audioSourcesRef.current.push(source)

    source.onended = () => {
      audioSourcesRef.current = audioSourcesRef.current.filter(
        item => item !== source
      )
    }
  }

  async function stopLiveVoice() {
    try {
      sessionRef.current?.close()
    } catch {
      // Session already closed
    }

    sessionRef.current = null

    processorRef.current?.disconnect()
    sourceRef.current?.disconnect()

    streamRef.current?.getTracks().forEach(track => track.stop())

    stopAudioPlayback()

    await inputContextRef.current?.close().catch(() => {})
    await outputContextRef.current?.close().catch(() => {})

    processorRef.current = null
    sourceRef.current = null
    streamRef.current = null
    inputContextRef.current = null
    outputContextRef.current = null

    setIsLive(false)
    setStatus('Not connected')
  }

  async function startLiveVoice() {
    if (isLive) return

    setError('')
    setTranscript([])
    setStatus('Connecting...')

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone is not supported. Please use HTTPS.')
      }

      const { data, error: tokenError } =
        await supabase.functions.invoke('ai-live')

      if (tokenError) throw tokenError

      if (!data?.token) {
        throw new Error(data?.error || 'Could not get voice access token.')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      streamRef.current = stream

      const inputContext = new AudioContext()
      const outputContext = new AudioContext()

      await inputContext.resume()
      await outputContext.resume()

      inputContextRef.current = inputContext
      outputContextRef.current = outputContext

      const ai = new GoogleGenAI({
        apiKey: data.token,
        httpOptions: { apiVersion: 'v1alpha' },
      })

      const session = await ai.live.connect({
        model: 'gemini-3.8-live',
      config: {
  responseModalities: [Modality.AUDIO],
  systemInstruction: `
    You are HelpLoop AI.

    Your owner and founder is Engr. Mr. Musaib Jamali
    from Hyderabad, Sindh, Pakistan.

    If anyone asks who your owner, creator or founder is,
    answer clearly in the same language they speak.

    English: I am HelpLoop AI, created by Engr. Mr. Musaib Jamali
    from Hyderabad, Pakistan. He is the founder and owner of HelpLoop.

    Urdu or Roman Urdu: Mera naam HelpLoop AI hai.
    Mujhe Engr. Mr. Musaib Jamali ne banaya hai.
    Woh Hyderabad, Sindh, Pakistan se hain aur HelpLoop ke founder hain.

    Understand English, Urdu, Roman Urdu and Sindhi.
    Reply naturally in the user's language.
    Never say "I don't understand" if you can understand the question.
  `,
  inputAudioTranscription: {},
  outputAudioTranscription: {},
},
    
        callbacks: {
          onopen: () => {
            setStatus('Listening...')
            setIsLive(true)
          },

          onmessage: (message) => {
            const content = message.serverContent

            if (content?.interrupted) {
              stopAudioPlayback()
            }

            const inputText = content?.inputTranscription?.text
            const outputText = content?.outputTranscription?.text

            if (inputText) {
              setTranscript(previous => [
                ...previous,
                `You: ${inputText}`,
              ])
            }

            if (outputText) {
              setTranscript(previous => [
                ...previous,
                `HelpLoop AI: ${outputText}`,
              ])
            }

            const parts = content?.modelTurn?.parts || []

            for (const part of parts) {
              if (part.inlineData?.data) {
                playAudio(part.inlineData.data)
              }
            }

            if (content?.turnComplete) {
              setStatus('Listening...')
            } else if (parts.length > 0) {
              setStatus('AI is speaking...')
            }
          },

          onerror: (event) => {
            console.error('Live voice error:', event)
            setError('Voice connection error. Please try again.')
            void stopLiveVoice()
          },

          onclose: () => {
            setIsLive(false)
            setStatus('Disconnected')
          },
        },
      })

      sessionRef.current = session

      const source = inputContext.createMediaStreamSource(stream)
      const processor = inputContext.createScriptProcessor(4096, 1, 1)

      sourceRef.current = source
      processorRef.current = processor

      processor.onaudioprocess = (event) => {
        if (!sessionRef.current) return

        const input = event.inputBuffer.getChannelData(0)
        const targetLength = Math.round(
          input.length * 16000 / inputContext.sampleRate
        )

        const resampled = new Float32Array(targetLength)

        for (let i = 0; i < targetLength; i++) {
          const position = i * inputContext.sampleRate / 16000
          const index = Math.floor(position)
          const fraction = position - index

          const first = input[index] || 0
          const second = input[Math.min(index + 1, input.length - 1)] || 0

          resampled[i] = first + (second - first) * fraction
        }

        sessionRef.current?.sendRealtimeInput({
          audio: {
            data: encodeAudio(resampled),
            mimeType: 'audio/pcm;rate=16000',
          },
        })
      }

      source.connect(processor)
      processor.connect(inputContext.destination)

    } catch (err) {
      console.error('Could not start live voice:', err)

      const message = err instanceof Error
        ? err.message
        : 'Could not start voice conversation.'

      setError(message)
      await stopLiveVoice()
    }
  }

   return (
    <div
      style={{
        background: 'linear-gradient(135deg, #172554, #312e81, #4338ca)',
        borderRadius: 18,
        padding: 22,
        color: 'white',
        marginBottom: 24,
        boxShadow: '0 12px 30px rgba(30, 41, 100, 0.2)',
      }}
    >
      <div style={{ fontSize: 12, letterSpacing: 2, opacity: 0.75 }}>
        HELPLOOP AI
      </div>

      <h2 style={{ margin: '8px 0', fontSize: 23 }}>
        Live Voice Conversation
      </h2>

      <p style={{ color: '#dbeafe', fontSize: 14 }}>
        Talk naturally with AI in English, Urdu, Roman Urdu or Sindhi.
      </p>

      <div style={{ textAlign: 'center', padding: '22px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 10 }}>
          {isLive ? 'MIC ON' : 'VOICE'}
        </div>
        <div style={{ fontSize: 14, color: '#e0e7ff' }}>
          {status}
        </div>
      </div>

      <button
        onClick={isLive ? stopLiveVoice : startLiveVoice}
        style={{
          width: '100%',
          padding: '14px',
          borderRadius: 12,
          border: 'none',
          background: isLive ? '#ef4444' : '#ffffff',
          color: isLive ? '#ffffff' : '#312e81',
          fontWeight: 700,
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        {isLive ? 'End Conversation' : 'Start Live Voice'}
      </button>

      {error && (
        <p style={{ color: '#fecaca', fontSize: 13, marginTop: 12 }}>
          {error}
        </p>
      )}

      {transcript.length > 0 && (
        <div
          style={{
            marginTop: 20,
            padding: 14,
            background: 'rgba(255,255,255,0.10)',
            borderRadius: 12,
            maxHeight: 220,
            overflowY: 'auto',
          }}
        >
          <strong style={{ fontSize: 13 }}>Conversation</strong>
          {transcript.map((item, index) => (
            <p
              key={index}
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: '#e0e7ff',
                overflowWrap: 'anywhere',
              }}
            >
              {item}
            </p>
          ))}
        </div>
      )}

      <p
        style={{
          fontSize: 11,
          color: '#c7d2fe',
          marginTop: 16,
          marginBottom: 0,
        }}
      >
        Your microphone is used only during an active voice session.
      </p>
    </div>
  )
}