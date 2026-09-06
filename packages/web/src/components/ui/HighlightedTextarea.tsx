import { forwardRef } from 'react'
import { tokenizeContent } from '../../utils/anchorParse'

const LINK_COLORS = {
  image: 'text-orange-400',
  twitter: 'text-sky-400',
  youtube: 'text-red-400',
  url: 'text-blue-400',
} as const

interface HighlightedTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'style'> {
  value: string
  /** layout classes applied to the wrapper div (e.g. "flex-1 min-h-0") */
  wrapperClassName?: string
}

const HighlightedTextarea = forwardRef<HTMLTextAreaElement, HighlightedTextareaProps>(
  ({ value, className = '', wrapperClassName = '', ...rest }, ref) => {
    const parts = tokenizeContent(value)

    return (
      <div className={`relative ${wrapperClassName}`}>
        {/* Mirror div — renders colored text behind the transparent textarea */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 pointer-events-none select-none whitespace-pre-wrap break-words overflow-hidden ${className}`}
        >
          {parts.map((part, i) => {
            if (part.type === 'url') {
              return (
                <span key={i} className={LINK_COLORS[part.linkType]}>
                  {part.url}
                </span>
              )
            }
            if (part.type === 'anchor') {
              return (
                <span key={i} className="text-blue-400">
                  {part.raw}
                </span>
              )
            }
            return <span key={i}>{part.text}</span>
          })}
          {/* trailing newline to prevent scroll jump */}
          {'\n'}
        </div>

        {/* Actual textarea — transparent text, visible caret */}
        <textarea
          ref={ref}
          value={value}
          className={`absolute inset-0 w-full h-full bg-transparent resize-none ${className}`}
          style={{ color: 'transparent', caretColor: '#94a3b8' }}
          {...rest}
        />
      </div>
    )
  },
)
HighlightedTextarea.displayName = 'HighlightedTextarea'
export default HighlightedTextarea
