import { useCallback, useRef, useState } from 'react'

import { streamChat } from './api'

let counter = 0
const nextId = () => `m${(counter += 1)}`

/**
 * A blank assistant turn.
 *
 * Created the moment the question is sent, before any bytes come back, so the
 * panel can show progress rows immediately rather than sitting empty while the
 * router thinks.
 */
function blankAnswer() {
  return {
    id: nextId(),
    role: 'assistant',
    text: '',
    progress: [],
    chart: null,
    chartSkipped: '',
    rows: [],
    explain: null,
    turnId: null,
    mode: '',
    error: null,
    done: false,
  }
}

export function useChat(sessionId) {
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)

  const abortRef = useRef(null)

  /** Apply a patch to the turn currently streaming, which is always the last one. */
  const patchLast = useCallback((patch) => {
    setMessages((previous) => {
      if (previous.length === 0) return previous

      const next = previous.slice()
      const last = next[next.length - 1]

      next[next.length - 1] =
        typeof patch === 'function' ? patch(last) : { ...last, ...patch }

      return next
    })
  }, [])

  const handleEvent = useCallback(
    ({ event, data }) => {
      switch (event) {
        case 'start':
          patchLast({ turnId: data.turn_id })
          break

        case 'progress':
          // Keyed by step, because a step re-emits as it changes status -
          // running, then completed - and both are the same row.
          patchLast((message) => {
            const rows = message.progress.slice()
            const index = rows.findIndex((row) => row.step === data.step)

            if (index === -1) rows.push(data)
            else rows[index] = data

            return { ...message, progress: rows }
          })
          break

        case 'output':
          patchLast((message) => ({
            ...message,
            text: message.text + (data.content || ''),
          }))
          break

        case 'chart':
          patchLast({ chart: data, chartSkipped: '' })
          break

        case 'chart_skipped':
          patchLast({ chart: null, chartSkipped: data.reason || '' })
          break

        case 'complete':
          // The authoritative payload. The streamed text and this answer
          // should be identical, but this one is what the server saved, so it
          // wins - and it carries the rows and the explain panel, which never
          // came down the stream.
          patchLast((message) => ({
            ...message,
            text: data.answer || message.text,
            rows: data.rows || [],
            explain: data.explain || null,
            // Never clears a chart that already arrived on the stream. The
            // two should agree, but a chart the user can see disappearing at
            // the end of a turn would be the worse failure.
            chart: data.chart || message.chart,
            chartSkipped: data.chart_skipped || message.chartSkipped,
            mode: data.mode || '',
            turnId: data.turn_id,
          }))
          break

        case 'error':
          patchLast({ error: data.message || 'Something went wrong.' })
          break

        case 'done':
          patchLast({ done: true })
          break

        default:
          break
      }
    },
    [patchLast],
  )

  const send = useCallback(
    async (question) => {
      const trimmed = question.trim()

      if (!trimmed || isStreaming) return

      setMessages((previous) => [
        ...previous,
        { id: nextId(), role: 'user', text: trimmed },
        blankAnswer(),
      ])

      setIsStreaming(true)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        await streamChat({
          question: trimmed,
          sessionId,
          onEvent: handleEvent,
          signal: controller.signal,
        })
      } catch (error) {
        patchLast({
          error: `Could not reach the server: ${error.message}`,
          done: true,
        })
      } finally {
        // The stream can end without a done event if the connection drops.
        // Marking it here means the input is never left disabled.
        patchLast({ done: true })
        setIsStreaming(false)
        abortRef.current = null
      }
    },
    [handleEvent, isStreaming, patchLast, sessionId],
  )

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  /** Replace one turn's chart, after a regenerate. */
  const setChartFor = useCallback((messageId, chart, skipped) => {
    setMessages((previous) =>
      previous.map((message) =>
        message.id === messageId
          ? { ...message, chart, chartSkipped: skipped || '' }
          : message,
      ),
    )
  }, [])

  return { messages, isStreaming, send, stop, setChartFor }
}
