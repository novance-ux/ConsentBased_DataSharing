import { Buffer } from 'buffer'
// Polyfill Buffer for WalletConnect (used by Pera/Defly wallets)
;(window as unknown as Record<string, unknown>).Buffer = Buffer

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
