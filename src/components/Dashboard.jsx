import { useEffect, useState } from 'react'

import { getDashboard } from '../api'
import DynamicChart from './DynamicChart'

/**
 * The descriptive layer: KPIs and the required charts, straight from SQL with
 * no model involved.
 *
 * Loaded once and kept, because the dataset is read-only and 400 rows - there
 * is nothing to refresh.
 */

const KPI_TILES = [
  { key: 'total_orders', label: 'Total orders' },
  { key: 'delivered_orders', label: 'Delivered' },
  { key: 'delayed_orders', label: 'Delayed' },
  { key: 'on_time_rate_pct', label: 'On-time rate', suffix: '%' },
  { key: 'avg_delivery_days', label: 'Avg delivery', suffix: ' days' },
]

function formatValue(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value !== 'number') return String(value)

  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1)
}

export default function Dashboard({ theme }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    getDashboard()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError.message)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <div className="empty">
        Could not load the dashboard: {error}
      </div>
    )
  }

  if (!data) {
    return <div className="empty">Loading dashboard…</div>
  }

  return (
    <div className="dashboard">
      <div className="kpis">
        {KPI_TILES.map((tile) => (
          <div className="kpi" key={tile.key}>
            <div className="kpi-label">{tile.label}</div>
            <div className="kpi-value">
              {formatValue(data.kpis?.[tile.key])}
              {tile.suffix && data.kpis?.[tile.key] !== null && (
                <span className="kpi-suffix">{tile.suffix}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {data.data_window && (
        <p className="window-note">
          {data.data_window.row_count} orders, {data.data_window.from} to{' '}
          {data.data_window.to}.
        </p>
      )}

      {data.charts?.map((chart) => (
        <figure className="dash-figure" key={chart.title}>
          <figcaption>
            <h3>{chart.title}</h3>
            {chart.description && <p>{chart.description}</p>}
          </figcaption>

          <DynamicChart config={chart} theme={theme} height={260} />
        </figure>
      ))}
    </div>
  )
}
