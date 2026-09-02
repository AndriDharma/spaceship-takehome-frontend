import AnalysisPanel from './AnalysisPanel'
import Markdown from './Markdown'

/**
 * One turn in the conversation.
 *
 * A user turn is a bubble. An assistant turn is the streamed text, the
 * collapsed analysis panel, and - when there is something to show - the button
 * that opens it in the report panel.
 */
export default function Message({ message, isActive, onOpenReport }) {
  if (message.role === 'user') {
    return (
      <div className="turn turn-user">
        <div className="bubble">{message.text}</div>
      </div>
    )
  }

  const waiting = !message.text && !message.error
  const hasReport = Boolean(message.chart) || message.rows?.length > 0

  return (
    <div className="turn turn-assistant">
      {waiting && (
        <div className="thinking" role="status">
          <span className="dot" />
          <span className="dot" />
          <span className="dot" />
        </div>
      )}

      {message.text && <Markdown>{message.text}</Markdown>}

      {message.error && <div className="error-note">{message.error}</div>}

      {/* Only worth saying once the turn is over. While it is still streaming,
          an absent chart just means the chart has not arrived yet. */}
      {message.done && !message.chart && message.chartSkipped && (
        <div className="skip-note">No chart: {message.chartSkipped}</div>
      )}

      <AnalysisPanel progress={message.progress} explain={message.explain} />

      {hasReport && (
        <button
          type="button"
          className={`report-button ${isActive ? 'active' : ''}`}
          onClick={() => onOpenReport(message)}
        >
          Visualization →
        </button>
      )}
    </div>
  )
}
