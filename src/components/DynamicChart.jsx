import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { SERIES_LIMIT, chrome, seriesColor } from '../palette'

/**
 * Renders whatever chart the backend chose.
 *
 * The backend never sends chart code or an image - it sends a validated
 * config: which type, which column is the x axis, which columns are measures,
 * and the rows. This component is the only thing that knows about Recharts,
 * and the same config shape arrives from the AI path, the forecast tool and
 * the dashboard, so there is exactly one renderer for all three.
 */

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function formatNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return value

  const size = Math.abs(value)

  if (size >= 1e9) return `${(value / 1e9).toFixed(1)}B`
  if (size >= 1e6) return `${(value / 1e6).toFixed(1)}M`
  if (size >= 1e4) return `${(value / 1e3).toFixed(1)}k`

  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/** "2025-03-01" becomes "Mar 2025". Anything else is left alone. */
function formatDate(value) {
  const text = String(value ?? '')
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) return text

  const [, year, month, day] = match
  const label = `${MONTH_LABELS[Number(month) - 1]} ${year}`

  return day === '01' ? label : `${MONTH_LABELS[Number(month) - 1]} ${Number(day)}`
}

/**
 * Turn long data into wide data.
 *
 * A result with one row per (month, carrier) pair cannot be plotted directly -
 * Recharts wants one row per x position with a column per series. seriesKey is
 * the backend saying "the values in this column are the series", and this is
 * where that instruction is carried out.
 *
 * Series are ordered by their total across the whole dataset, not by where
 * they first appear, so a series keeps the same colour no matter which rows
 * happen to be on screen.
 */
function pivot(data, xKey, seriesKey, valueKey) {
  const order = []
  const byX = new Map()
  const totals = new Map()

  for (const row of data) {
    const x = row[xKey]
    const name = String(row[seriesKey] ?? '—')
    const value = Number(row[valueKey]) || 0

    if (!byX.has(x)) {
      byX.set(x, { [xKey]: x })
      order.push(x)
    }

    byX.get(x)[name] = (byX.get(x)[name] ?? 0) + value
    totals.set(name, (totals.get(name) ?? 0) + value)
  }

  const names = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)

  return { rows: order.map((x) => byX.get(x)), names }
}

/**
 * Past eight series a chart is unreadable and there are no more colour slots,
 * so the tail is summed into one "Other" band rather than given a ninth hue.
 */
function foldOther(rows, names) {
  if (names.length <= SERIES_LIMIT) return { rows, names }

  const keep = names.slice(0, SERIES_LIMIT - 1)
  const rest = names.slice(SERIES_LIMIT - 1)

  const folded = rows.map((row) => {
    const next = { ...row }
    let other = 0

    for (const name of rest) {
      other += Number(next[name]) || 0
      delete next[name]
    }

    next.Other = other

    return next
  })

  return { rows: folded, names: [...keep, 'Other'] }
}

function ChartTooltip({ active, payload, label, isDate }) {
  if (!active || !payload?.length) return null

  return (
    <div className="tooltip">
      <div className="tooltip-label">{isDate ? formatDate(label) : label}</div>

      {payload.map((entry) => (
        <div className="tooltip-row" key={entry.dataKey ?? entry.name}>
          <span className="swatch" style={{ background: entry.color }} />
          <span className="tooltip-name">{entry.name}</span>
          <span className="tooltip-value">{formatNumber(entry.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function DynamicChart({ config, theme = 'light', height = 320 }) {
  if (!config || !Array.isArray(config.data) || config.data.length === 0) {
    return <div className="empty">No data to chart.</div>
  }

  const ink = chrome(theme)

  const { chartType, xKey, yKeys, seriesKey, data, columnKinds = {} } = config
  const isDate = columnKinds[xKey] === 'date'

  // ------------------------------------------------------------
  // Pie and doughnut take a different shape entirely: one slice per row,
  // no axes, no grid.
  // ------------------------------------------------------------

  if (chartType === 'pie' || chartType === 'doughnut') {
    const valueKey = yKeys[0]

    const slices = data
      .map((row) => ({
        name: String(row[xKey] ?? '—'),
        value: Number(row[valueKey]) || 0,
      }))
      .filter((slice) => slice.value > 0)

    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius={chartType === 'doughnut' ? '55%' : 0}
            outerRadius="78%"
            paddingAngle={2}
            stroke={ink.surface}
            strokeWidth={2}
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {slices.map((slice, index) => (
              <Cell key={slice.name} fill={seriesColor(theme, index)} />
            ))}
          </Pie>

          <Tooltip content={<ChartTooltip />} />
        </PieChart>
      </ResponsiveContainer>
    )
  }

  // ------------------------------------------------------------
  // Everything else is an x/y chart.
  // ------------------------------------------------------------

  let rows = data
  let series = yKeys

  if (seriesKey && yKeys.length === 1) {
    const pivoted = pivot(data, xKey, seriesKey, yKeys[0])
    const folded = foldOther(pivoted.rows, pivoted.names)

    rows = folded.rows
    series = folded.names
  }

  const stacked = Boolean(config.stacked) || chartType === 'stacked_bar'
  const isBar = chartType === 'bar' || chartType === 'stacked_bar'
  const isArea = chartType === 'area'

  const ChartComponent = isBar ? BarChart : isArea ? AreaChart : LineChart

  const axisStyle = { fill: ink.muted, fontSize: 12 }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ChartComponent data={rows} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        {/* Horizontal only. Vertical gridlines add ink without helping anyone
            read a value off the y axis. */}
        <CartesianGrid stroke={ink.grid} strokeDasharray="0" vertical={false} />

        <XAxis
          dataKey={xKey}
          tick={axisStyle}
          tickLine={false}
          axisLine={{ stroke: ink.axis }}
          tickFormatter={isDate ? formatDate : undefined}
          minTickGap={16}
        />

        <YAxis
          tick={axisStyle}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatNumber}
          width={56}
        />

        <Tooltip
          content={<ChartTooltip isDate={isDate} />}
          cursor={{ stroke: ink.axis, strokeWidth: 1 }}
        />

        {/* One series needs no legend - the chart title already names it. */}
        {series.length > 1 && (
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, color: ink.muted, paddingTop: 8 }}
          />
        )}

        {series.map((name, index) => {
          const color = seriesColor(theme, index)

          if (isBar) {
            return (
              <Bar
                key={name}
                dataKey={name}
                fill={color}
                stackId={stacked ? 'stack' : undefined}
                // A 2px ring in the surface colour is what separates
                // neighbouring segments, since a stack has no gaps of its own.
                stroke={stacked ? ink.surface : undefined}
                strokeWidth={stacked ? 2 : 0}
                // Only the topmost segment gets rounded corners: the top of
                // the stack is the data end, the joins inside it are not.
                radius={
                  !stacked || index === series.length - 1 ? [4, 4, 0, 0] : 0
                }
                maxBarSize={48}
              />
            )
          }

          if (isArea) {
            return (
              <Area
                key={name}
                type="monotone"
                dataKey={name}
                stroke={color}
                strokeWidth={2}
                fill={color}
                fillOpacity={0.15}
                stackId={stacked ? 'stack' : undefined}
                dot={false}
                activeDot={{ r: 5, strokeWidth: 2, stroke: ink.surface }}
              />
            )
          }

          return (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              stroke={color}
              strokeWidth={2}
              // 4px radius is an 8px mark, the smallest that stays visible.
              dot={{ r: 4, strokeWidth: 0, fill: color }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: ink.surface }}
              // Gaps rather than a straight line through missing points. The
              // forecast chart depends on this: its two series are null
              // wherever the other one has values.
              connectNulls={false}
            />
          )
        })}
      </ChartComponent>
    </ResponsiveContainer>
  )
}
