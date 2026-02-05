import { Link } from 'react-router-dom'

import PageTransition from '../components/PageTransition.jsx'

const NotFound = () => (
  <PageTransition>
    <div className="mx-auto max-w-xl rounded-3xl border border-outline bg-panel p-8 text-center">
      <p className="text-xs uppercase tracking-[0.4em] text-muted">404</p>
      <h1 className="mt-4 font-display text-4xl">This pressing is missing.</h1>
      <p className="mt-2 text-muted">The album you requested is no longer in our archive.</p>
      <Link
        to="/"
        className="mt-6 inline-block rounded-full border border-outline px-6 py-3 text-xs uppercase tracking-[0.4em] text-muted hover:text-white"
      >
        Return Home
      </Link>
    </div>
  </PageTransition>
)

export default NotFound
