import type { ReactNode } from 'react'
import type { Persistor } from '../types'

export interface PersistGateProps {
  children: ReactNode | ((state: boolean) => ReactNode)
  loading: ReactNode
  persistor: Persistor<any>
}

export const PersistGate = ({ children }: PersistGateProps) => {
  if (typeof children === 'function') {
    return children(true)
  }
  return children
}
