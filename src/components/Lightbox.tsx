import { useEffect, type ReactNode } from 'react'

/**
 * Full-screen overlay for looking at something up close (a chat screenshot,
 * a bill preview). Closes on the ✕ button, a tap on the backdrop, or Escape.
 * The content scrolls, so tall phone screenshots stay readable at full width
 * instead of being shrunk to fit the screen.
 */
export default function Lightbox({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    // Stop the page behind from scrolling while the overlay is open.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div className="no-print fixed inset-0 z-50 overflow-y-auto bg-black/80" onClick={onClose}>
      <button
        type="button"
        onClick={onClose}
        aria-label="ปิด"
        className="fixed right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full bg-white/90 text-lg font-semibold text-ink shadow"
      >
        ✕
      </button>
      <div className="mx-auto w-full max-w-xl px-3 py-14" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
