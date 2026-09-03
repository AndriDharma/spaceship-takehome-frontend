/**
 * Every call to the backend lives here.
 *
 * Empty base means same-origin, which in development is Vite's proxy. In a
 * production build VITE_API_BASE is the backend's Cloud Run URL, baked in at
 * build time.
 */

const API_BASE = import.meta.env.VITE_API_BASE || ''

function url(path) {
  return `${API_BASE}${path}`
}

async function getJson(path) {
  const response = await fetch(url(path))

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  return response.json()
}

export function getHealth() {
  return getJson('/api/health')
}

export function getDashboard() {
  return getJson('/api/dashboard')
}

/**
 * Parse one Server-Sent Events frame.
 *
 *   event: progress
 *   data: {"step":"route", ...}
 *
 * Returns null for anything that is not a complete, parseable frame - comment
 * lines and keep-alives included - so the caller can ignore it.
 */
function parseFrame(frame) {
  let event = 'message'
  const dataLines = []

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }

  if (dataLines.length === 0) {
    return null
  }

  try {
    return { event, data: JSON.parse(dataLines.join('\n')) }
  } catch {
    return null
  }
}

/**
 * Open the chat stream and hand each event to onEvent as it arrives.
 *
 * fetch + ReadableStream rather than EventSource, because EventSource can only
 * issue GET requests and the question travels in a POST body.
 *
 * Resolves when the server closes the stream. Rejects on a transport failure;
 * an aborted request resolves quietly, since the user cancelling is not an
 * error.
 */
export async function streamChat({ question, sessionId, onEvent, signal }) {
  let response

  try {
    response = await fetch(url('/api/chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, session_id: sessionId }),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') return
    throw error
  }

  if (!response.ok || !response.body) {
    throw new Error(`${response.status} ${response.statusText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()

      if (done) break

      // stream: true so a multi-byte character split across two network
      // chunks is held back rather than decoded into a replacement character.
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')

      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        const parsed = parseFrame(frame)

        if (parsed) onEvent(parsed)

        boundary = buffer.indexOf('\n\n')
      }
    }
  } catch (error) {
    if (error.name !== 'AbortError') throw error
  }
}
