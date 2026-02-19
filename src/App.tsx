import { useState, useRef, useEffect, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || ''

interface Message {
  role: 'user' | 'assistant'
  content: string
}

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = useCallback(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading, scrollToBottom])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [input])

  const sendMessage = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: newMessages.slice(0, -1),
        }),
      })

      if (!res.ok) throw new Error('API error')

      const data = await res.json()
      const replies: Message[] = (data.replies || []).map((r: string) => ({
        role: 'assistant' as const,
        content: r,
      }))

      setMessages(prev => [...prev, ...replies])
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: "Something went wrong. Try again." },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  // Group consecutive messages by role
  const groupedMessages: Message[][] = []
  for (const msg of messages) {
    const lastGroup = groupedMessages[groupedMessages.length - 1]
    if (lastGroup && lastGroup[0].role === msg.role) {
      lastGroup.push(msg)
    } else {
      groupedMessages.push([msg])
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="avatar">N</div>
        <div className="header-info">
          <div className="header-name">Ning</div>
          <div className="header-status">Active now</div>
        </div>
        <div className="header-dot" />
      </div>

      <div className="messages" ref={messagesRef}>
        {messages.length === 0 && (
          <div className="welcome">
            <div className="welcome-avatar">N</div>
            <h2>Ning</h2>
            <p>An AI that talks like Ning, trained on real WeChat conversations. Say something.</p>
          </div>
        )}

        {groupedMessages.map((group, gi) => (
          <div key={gi} className={`message-group ${group[0].role}`}>
            {group[0].role === 'assistant' && (
              <div className="group-avatar">N</div>
            )}
            <div className="bubbles">
              {group.map((msg, mi) => (
                <div key={mi} className="bubble">
                  {msg.content}
                </div>
              ))}
            </div>
          </div>
        ))}

        {loading && (
          <div className="typing-group">
            <div className="group-avatar">N</div>
            <div className="typing-indicator">
              <div className="typing-dot" />
              <div className="typing-dot" />
              <div className="typing-dot" />
            </div>
          </div>
        )}
      </div>

      <div className="input-area">
        <div className="input-wrapper">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message..."
            rows={1}
          />
        </div>
        <button
          className="send-btn"
          onClick={sendMessage}
          disabled={!input.trim() || loading}
        >
          Send
        </button>
      </div>
    </div>
  )
}

export default App
