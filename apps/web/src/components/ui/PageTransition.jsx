import { m, useReducedMotion } from 'framer-motion'

// `bleed` pages run edge to edge under the floating nav and lay out their own containers.
const PageTransition = ({ children, bleed = false }) => {
  const shouldReduceMotion = useReducedMotion()
  const MotionMain = m.main

  return (
    <MotionMain
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.12, ease: [0.16, 1, 0.3, 1] }}
      className={bleed
        ? 'relative w-full pb-12'
        : 'relative mx-auto w-full max-w-6xl px-4 pb-8 pt-28 tablet:px-6 tablet:pb-12 tablet:pt-32'}
    >
      {children}
    </MotionMain>
  )
}

export default PageTransition
