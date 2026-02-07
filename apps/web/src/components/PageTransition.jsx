import { motion } from 'framer-motion'

const PageTransition = ({ children }) => (
  <motion.main
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.2 }}
    className="mx-auto w-full max-w-6xl px-6 py-12"
  >
    {children}
  </motion.main>
)

export default PageTransition
