import { lazy, Suspense, useEffect, useState } from 'react'
import { isSignInWithEmailLink, onAuthStateChanged } from 'firebase/auth'
import App from './App.jsx'
import { auth } from './firebase'

const LandingPage = lazy(() => import('./LandingPage.jsx'))

function OpeningFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FFF9F2] text-[#8FA66A]">
      <p className="font-serif text-sm font-black">Opening Root Record...</p>
    </div>
  )
}

const isAppRoute = () => {
  const normalizedPath = window.location.pathname.replace(/\/+$/, '')

  return (
    normalizedPath.endsWith('/app') ||
    window.location.hash === '#app' ||
    isSignInWithEmailLink(auth, window.location.href)
  )
}

export default function RootEntry() {
  const [showApp, setShowApp] = useState(isAppRoute)
  const [hasUser, setHasUser] = useState(false)
  const [isAuthResolved, setIsAuthResolved] = useState(false)

  useEffect(() => {
    const updateRoute = () => setShowApp(isAppRoute())
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setHasUser(Boolean(user))
      setIsAuthResolved(true)
    })

    window.addEventListener('hashchange', updateRoute)
    window.addEventListener('popstate', updateRoute)

    return () => {
      unsubscribeAuth()
      window.removeEventListener('hashchange', updateRoute)
      window.removeEventListener('popstate', updateRoute)
    }
  }, [])

  if (showApp || hasUser) {
    return <App />
  }

  if (!isAuthResolved) {
    return <OpeningFallback />
  }

  return (
    <Suspense fallback={<OpeningFallback />}>
      <LandingPage />
    </Suspense>
  )
}
