import Dashboard from './Dashboard'
import DataTable from './DataTable'
import DynamicChart from './DynamicChart'

/**
 * The right-hand panel.
 *
 * Three tabs over one surface. Dashboard is the landing view, so a reviewer
 * sees KPIs before typing anything; asking a question switches to Chart on its
 * own and the tab strip is how you get back.
 *
 * The header carries no controls. The theme toggle floats in that corner, and
 * anything placed beside it collides with it.
 */
export default function ReportPanel({ message, tab, onTabChange, theme }) {
  const chart = message?.chart
  const rows = message?.rows || []

  const hasChart = Boolean(chart)
  const hasRows = rows.length > 0

  return (
    <section className="report-pane">
      <div className="report-head">
        {tab === 'dashboard' ? (
          <div className="report-title">
            <h2>Dashboard</h2>
            <p>Key metrics across the whole dataset.</p>
          </div>
        ) : (
          <div className="report-title">
            <h2>{chart?.title || 'Result'}</h2>
            {chart?.description && <p>{chart.description}</p>}
          </div>
        )}
      </div>

      <div className="report-body">
        {tab === 'dashboard' && <Dashboard theme={theme} />}

        {tab === 'chart' &&
          (hasChart ? (
            <>
              <DynamicChart config={chart} theme={theme} height={360} />

              {/* The model's one-line reading of the data. Kept below the
                  chart so the chart is what gets looked at first. */}
              {chart.insight && <p className="insight">{chart.insight}</p>}
            </>
          ) : (
            <div className="empty">
              {message?.chartSkipped
                ? `No chart: ${message.chartSkipped}`
                : 'Ask a question to see a chart here.'}
            </div>
          ))}

        {tab === 'table' && (
          <DataTable
            rows={rows}
            headers={chart?.headers}
            columnKinds={chart?.columnKinds}
          />
        )}
      </div>

      <nav className="tabs" aria-label="Report views">
        <button
          type="button"
          className={tab === 'dashboard' ? 'tab active' : 'tab'}
          onClick={() => onTabChange('dashboard')}
        >
          Dashboard
        </button>

        <button
          type="button"
          className={tab === 'chart' ? 'tab active' : 'tab'}
          onClick={() => onTabChange('chart')}
          disabled={!hasChart}
        >
          Chart
        </button>

        <button
          type="button"
          className={tab === 'table' ? 'tab active' : 'tab'}
          onClick={() => onTabChange('table')}
          disabled={!hasRows}
        >
          Table
        </button>
      </nav>
    </section>
  )
}
