import { useEffect, useRef, useState } from 'react'

import Message from './Message'

const SUGGESTIONS = [
  'Which carrier has the highest delay rate?',
  'Show delayed orders by week for the last 3 months',
  'How many orders were delivered late last month?',
  'Predict demand for the CRAYON category for the next 4 months',
]

export default function ChatPanel({
  messages,
  isStreaming,
  onSend,
  onStop,
  activeMessageId,
  onOpenReport,
  dataWindow,
}) {
  const [draft, setDraft] = useState('')
  const endRef = useRef(null)

  // Follow the conversation as it grows. Depending on the streamed text and
  // not just the message count means it also follows tokens as they arrive.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const submit = (event) => {
    event.preventDefault()
    onSend(draft)
    setDraft('')
  }

  const ask = (question) => {
    onSend(question)
    setDraft('')
  }

  return (
    <section className="chat-pane">
      <header className="pane-header">
        <h1>Logistics Analytics</h1>
        {dataWindow && <span className="window">Data: {dataWindow}</span>}
      </header>

      <div className="messages">
        {messages.length === 0 && (
          <div className="welcome">
            <p>
              Ask about orders, deliveries, carriers, regions or product
              categories — or ask for a demand forecast.
            </p>

            <div className="suggestions">
              {SUGGESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="suggestion"
                  onClick={() => ask(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <Message
            key={message.id}
            message={message}
            isActive={message.id === activeMessageId}
            onOpenReport={onOpenReport}
          />
        ))}

        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a question about the logistics data…"
          disabled={isStreaming}
          aria-label="Your question"
        />

        {isStreaming ? (
          <button type="button" className="stop" onClick={onStop}>
            Stop
          </button>
        ) : (
          <button type="submit" className="send" disabled={!draft.trim()}>
            Send
          </button>
        )}
      </form>
    </section>
  )
}
