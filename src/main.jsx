import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import RootEntry from './RootEntry.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RootEntry />
  </StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    })
  })
}
