import { useState } from 'react'

/**
 * How the answer was produced, collapsed by default.
 *
 * This is the explainability requirement: the filters applied, the metrics and
 * dimensions used, the query plan, and the row count. It is not a debug view -
 * it is the reason a user should believe the number above it, so it stays one
 * click away rather than behind a developer flag.
 */

const STATUS_LABEL = {
  running: 'running',
  completed: 'done',
  failed: 'failed',
  skipped: 'skipped',
}

export default function AnalysisPanel({ progress, explain }) {
  const [open, setOpen] = useState(false)

  const hasContent = (progress && progress.length > 0) || explain

  if (!hasContent) return null

  return (
    <div className="analysis">
      <button
        type="button"
        className="analysis-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className={`chevron ${open ? 'open' : ''}`} aria-hidden="true">
          ›
        </span>
        Analysis process &amp; data
      </button>

      {open && (
        <div className="analysis-body">
          {progress?.length > 0 && (
            <ol className="steps">
              {progress.map((row) => (
                <li key={row.step} className={`step step-${row.status}`}>
                  <span className="step-dot" aria-hidden="true" />
                  <span className="step-message">{row.message}</span>
                  <span className="step-status">
                    {STATUS_LABEL[row.status] || row.status}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {explain && (
            <dl className="explain">
              <dt>Tool selected</dt>
              <dd>
                {explain.mode}
                {explain.reason ? ` — ${explain.reason}` : ''}
              </dd>

              {explain.method && (
                <>
                  <dt>Method</dt>
                  <dd>{explain.method}</dd>
                </>
              )}

              {explain.tables?.length > 0 && (
                <>
                  <dt>Source</dt>
                  <dd>{explain.tables.join(', ')}</dd>
                </>
              )}

              {explain.columns?.length > 0 && (
                <>
                  <dt>Columns used</dt>
                  <dd>{explain.columns.join(', ')}</dd>
                </>
              )}

              {explain.filters && (
                <>
                  <dt>Filters</dt>
                  <dd><code>{explain.filters}</code></dd>
                </>
              )}

              {explain.group_by?.length > 0 && (
                <>
                  <dt>Grouped by</dt>
                  <dd>{explain.group_by.join(', ')}</dd>
                </>
              )}

              <dt>Rows returned</dt>
              <dd>
                {explain.row_count}
                {explain.truncated ? ' (truncated to the row limit)' : ''}
              </dd>

              {explain.anchor_date && (
                <>
                  <dt>Relative dates resolved against</dt>
                  <dd>{explain.anchor_date}</dd>
                </>
              )}

              {explain.retries > 0 && (
                <>
                  <dt>Query retries</dt>
                  <dd>{explain.retries}</dd>
                </>
              )}

              {explain.sql && (
                <>
                  <dt>Query</dt>
                  <dd>
                    <pre className="sql">{explain.sql}</pre>
                  </dd>
                </>
              )}
            </dl>
          )}
        </div>
      )}
    </div>
  )
}
