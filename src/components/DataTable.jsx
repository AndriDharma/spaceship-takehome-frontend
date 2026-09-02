/**
 * The rows behind an answer.
 *
 * Required by the assignment - every answer has to offer the underlying data -
 * and it is also the accessibility fallback for the chart: anything colour
 * encodes, this states in text.
 */
export default function DataTable({ rows, headers, columnKinds = {} }) {
  if (!rows || rows.length === 0) {
    return <div className="empty">No rows.</div>
  }

  // The chart's headers are preferred because they carry the intended column
  // order, but they are not always the row's keys - a forecast chart is built
  // from month/actual/forecast while its rows are month/demand/orders. When
  // they disagree, the rows win, or the table would render empty columns.
  const first = rows[0]

  const headersMatch =
    headers?.length && headers.every((header) => header in first)

  const columns = headersMatch ? headers : Object.keys(first)

  const format = (value, kind) => {
    if (value === null || value === undefined) return '—'
    if (kind === 'number' && typeof value === 'number') {
      return Number.isInteger(value) ? value : value.toFixed(2)
    }
    return String(value)
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className={columnKinds[column] === 'number' ? 'numeric' : ''}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <tr key={index}>
              {columns.map((column) => (
                <td
                  key={column}
                  className={columnKinds[column] === 'number' ? 'numeric' : ''}
                >
                  {format(row[column], columnKinds[column])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
