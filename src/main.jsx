import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { isSignInWithEmailLink } from 'firebase/auth'
import './index.css'
import App from './App.jsx'
import LandingPage from './LandingPage.jsx'
import { auth } from './firebase'

const isAppRoute = () => {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '')

  return (
    normalizedPath.endsWith('/app') ||
    window.location.hash === '#app' ||
    isSignInWithEmailLink(auth, window.location.href)
  )
}

function RootEntry() {
  const [showApp, setShowApp] = useState(isAppRoute)

  useEffect(() => {
    const updateRoute = () => setShowApp(isAppRoute())

    window.addEventListener('hashchange', updateRoute)
    window.addEventListener('popstate', updateRoute)

    return () => {
      window.removeEventListener('hashchange', updateRoute)
      window.removeEventListener('popstate', updateRoute)
    }
  }, [])

  return showApp ? <App /> : <LandingPage />
}

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
