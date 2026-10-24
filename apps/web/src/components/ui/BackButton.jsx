import { createPortal } from 'react-dom'
import { FiArrowLeft } from 'react-icons/fi'

import { PAGE_GUTTER } from './Billboard.jsx'

// Pinned in the nav row, on the page's left edge. Portaled: the page transition's transform would otherwise pin it to the page instead of the viewport.
// On phones the nav pill moves right to make room (see Navigation).
const BackButton = ({ onClick, label = 'Back' }) =>
  createPortal(
    <div id="back-button" className="pointer-events-none fixed inset-x-0 top-3 z-40 tablet:top-4">
      <div className={PAGE_GUTTER}>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          title={label}
          className="pointer-events-auto inline-flex h-[46px] w-[46px] items-center justify-center rounded-full border border-white/[0.08] bg-black/55 text-paper shadow-[0_10px_40px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl backdrop-saturate-150 transition-colors hover:bg-black/75"
        >
          <FiArrowLeft aria-hidden="true" className="h-[18px] w-[18px]" />
        </button>
      </div>
    </div>,
    document.body,
  )

export default BackButton
