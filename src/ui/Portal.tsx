import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Draws pop-ups (sheets, menus, the camera, shopping mode) at the top of the
 * page, outside the animated and scrolling page, so nothing shifts them or
 * shows through them.
 */
export function Portal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body)
}
