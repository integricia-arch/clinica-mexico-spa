// src/pwa/components/BottomNav.tsx
import { NavLink } from 'react-router-dom'
import { Home, Tag, CreditCard, User } from 'lucide-react'
import { motion } from 'motion/react'

interface Props { slug: string }

export function BottomNav({ slug }: Props) {
  const base = `/loyalty/${slug}`
  const cls = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 py-2 px-4 text-xs transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground'}`

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t flex justify-around max-w-md mx-auto safe-area-bottom">
      <NavLink to={`${base}/`} end className={cls}>
        {({ isActive }) => (
          <motion.span
            className="flex flex-col items-center gap-0.5"
            whileTap={{ scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 600, damping: 20 }}
          >
            <Home className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <span>Inicio</span>
          </motion.span>
        )}
      </NavLink>
      <NavLink to={`${base}/promos`} className={cls}>
        {({ isActive }) => (
          <motion.span
            className="flex flex-col items-center gap-0.5"
            whileTap={{ scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 600, damping: 20 }}
          >
            <Tag className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <span>Promos</span>
          </motion.span>
        )}
      </NavLink>
      <NavLink to={`${base}/monedero`} className={cls}>
        {({ isActive }) => (
          <motion.span
            className="flex flex-col items-center gap-0.5"
            whileTap={{ scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 600, damping: 20 }}
          >
            <CreditCard className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <span>Monedero</span>
          </motion.span>
        )}
      </NavLink>
      <NavLink to={`${base}/cuenta`} className={cls}>
        {({ isActive }) => (
          <motion.span
            className="flex flex-col items-center gap-0.5"
            whileTap={{ scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 600, damping: 20 }}
          >
            <User className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
            <span>Cuenta</span>
          </motion.span>
        )}
      </NavLink>
    </nav>
  )
}
