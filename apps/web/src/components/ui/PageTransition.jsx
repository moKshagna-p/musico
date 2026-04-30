import { motion, useReducedMotion } from 'framer-motion'

const PageTransition = ({ children }) => {
  const shouldReduceMotion = useReducedMotion()
  const MotionMain = motion.main

  return (
    <MotionMain
      initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto w-full max-w-6xl px-4 py-8 tablet:px-6 tablet:py-12"
    >
      {children}
    </MotionMain>
  )
}

export default PageTransition
