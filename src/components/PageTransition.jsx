import { motion } from 'framer-motion'

const PageTransition = ({ children }) => (
  <motion.main
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -24 }}
    transition={{ duration: 0.4, ease: 'easeOut' }}
    className="mx-auto w-full max-w-6xl px-6 py-12"
  >
    {children}
  </motion.main>
)

export default PageTransition
