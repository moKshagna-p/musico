import { Link } from 'react-router-dom'

import PageTransition from '../components/ui/PageTransition.jsx'

const NotFound = () => (
  <PageTransition>
    <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center tablet:py-20">
      <div aria-hidden="true" className="vinyl relative w-40 opacity-80 aspect-square">
        <span className="absolute inset-[33%] flex items-center justify-center rounded-full bg-paper font-display text-xl text-black">404</span>
      </div>
      <h1 className="mt-10 font-display text-5xl leading-none text-paper tablet:text-6xl">This pressing is missing.</h1>
      <p className="mt-4 text-muted">The page you asked for isn&rsquo;t in our archive.</p>
      <Link
        to="/"
        className="mt-8 inline-block rounded-full bg-paper px-6 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
      >
        Return Home
      </Link>
    </div>
  </PageTransition>
)

export default NotFound
