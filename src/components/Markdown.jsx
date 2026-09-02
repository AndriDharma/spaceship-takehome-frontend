import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders the model's answer.
 *
 * Two deliberate choices:
 *
 * Raw HTML is NOT enabled. react-markdown ignores HTML in its source unless
 * `rehype-raw` is added, and it is not added here. This text comes from a
 * language model, so anything that would let it emit markup into the page is
 * a door with no reason to be open.
 *
 * Rendering happens on every streamed chunk rather than once at the end. Half
 * a bold marker shows briefly as literal asterisks while the closing pair is
 * still in flight, which reads as normal streaming rather than as a fault -
 * and it avoids the whole answer reflowing in one jump when the turn ends.
 */

const components = {
  // Links open away from the app. noopener is what stops the opened page
  // reaching back through window.opener.
  a: ({ node, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer" />
  ),
}

export default function Markdown({ children }) {
  if (!children) return null

  return (
    <div className="answer markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
