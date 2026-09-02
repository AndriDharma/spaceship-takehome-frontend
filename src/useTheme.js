import { useCallback, useEffect, useState } from 'react'

/**
 * Light or dark, following the operating system until the user says otherwise.
 *
 * The choice is stamped on <html data-theme> so app.css can react to it, and
 * returned as a plain string so the chart components can pick the matching
 * colour steps - Recharts takes colour strings, not CSS variables.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light'

    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })

  const [followSystem, setFollowSystem] = useState(true)

  useEffect(() => {
    if (!followSystem) return undefined

    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event) => setTheme(event.matches ? 'dark' : 'light')

    query.addEventListener('change', onChange)

    return () => query.removeEventListener('change', onChange)
  }, [followSystem])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggle = useCallback(() => {
    // Toggling is an explicit choice, so it stops tracking the OS - otherwise
    // the next system change would silently undo it.
    setFollowSystem(false)
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle }
}
