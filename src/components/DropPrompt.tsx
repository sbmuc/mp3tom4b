interface Props {
  /** "Drop an M4B, or click to browse" */
  mouse: string
  /** "Tap to choose an M4B" */
  touch: string
}

/**
 * Drop-zone wording for the device: drop or click with a mouse, tap on a
 * phone or tablet, where there's nothing to drag from. Both are rendered and
 * CSS picks one (the `touch:` variant, see tailwind.config.ts), so the server
 * and client markup agree.
 */
export default function DropPrompt({ mouse, touch }: Props) {
  return (
    <>
      <span className="touch:hidden">{mouse}</span>
      <span className="hidden touch:inline">{touch}</span>
    </>
  )
}
