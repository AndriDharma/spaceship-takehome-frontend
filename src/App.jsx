import { useEffect, useMemo, useRef, useState } from 'react'

import { getHealth } from './api'
import ChatPanel from './components/ChatPanel'
import ReportPanel from './components/ReportPanel'
import { useChat } from './useChat'
import { useTheme } from './useTheme'

export default function App() {
  // One session for as long as the tab is open. There are no accounts, and the
  // backend only uses this to group a conversation so follow-up questions like
  // "now break that down by region" can be resolved.
  const sessionId = useMemo(() => crypto.randomUUID(), [])

  const { theme, toggle } = useTheme()
  const { messages, isStreaming, send, stop } = useChat(sessionId)

  const [selectedId, setSelectedId] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [dataWindow, setDataWindow] = useState('')

  const autoSelected = useRef(null)

  useEffect(() => {
    getHealth()
      .then((health) => setDataWindow(health.data_window || ''))
      .catch(() => setDataWindow(''))
  }, [])

  // When a chart arrives, show it. Tracked by id so this fires once per chart
  // rather than on every token, which would drag the user back to the Chart
  // tab every time they clicked away mid-answer.
  useEffect(() => {
    const latest = [...messages]
      .reverse()
      .find((message) => message.role === 'assistant' && message.chart)

    if (latest && autoSelected.current !== latest.id) {
      autoSelected.current = latest.id
      setSelectedId(latest.id)
      setTab('chart')
    }
  }, [messages])

  const selected = messages.find((message) => message.id === selectedId) || null

  const openReport = (message) => {
    setSelectedId(message.id)
    setTab(message.chart ? 'chart' : 'table')
  }

  return (
    <div className="app">
      <ChatPanel
        messages={messages}
        isStreaming={isStreaming}
        onSend={send}
        onStop={stop}
        activeMessageId={selectedId}
        onOpenReport={openReport}
        dataWindow={dataWindow}
      />

      <ReportPanel
        message={selected}
        tab={tab}
        onTabChange={setTab}
        theme={theme}
      />

      <button
        type="button"
        className="theme-toggle"
        onClick={toggle}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? '☀' : '☾'}
      </button>
    </div>
  )
}
