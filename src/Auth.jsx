import { useEffect, useState } from 'react'
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
} from 'firebase/auth'
import { Sprout } from 'lucide-react'
import { auth } from './firebase'

const EMAIL_STORAGE_KEY = 'emailForSignIn'

const actionCodeSettings = {
  url: 'https://plants.shayleesmith.com',
  handleCodeInApp: true,
}

export default function Auth() {
  const [email, setEmail] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isCompletingSignIn, setIsCompletingSignIn] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const finishEmailLinkSignIn = async () => {
      if (!isSignInWithEmailLink(auth, window.location.href)) {
        return
      }

      const storedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY)
      if (!storedEmail) {
        setError('Open the sign-in link on the same device where you requested it.')
        return
      }

      setIsCompletingSignIn(true)
      setError('')

      try {
        await signInWithEmailLink(auth, storedEmail, window.location.href)
        window.localStorage.removeItem(EMAIL_STORAGE_KEY)
        window.history.replaceState({}, document.title, window.location.pathname)
      } catch (signInError) {
        console.error('Email link sign-in failed', signInError)
        setError('That sign-in link could not be completed. Request a new link and try again.')
      } finally {
        setIsCompletingSignIn(false)
      }
    }

    finishEmailLinkSignIn()
  }, [])

  const sendLink = async (event) => {
    event.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      return
    }

    setIsSending(true)
    setError('')
    setMessage('')

    try {
      await sendSignInLinkToEmail(auth, trimmedEmail, actionCodeSettings)
      window.localStorage.setItem(EMAIL_STORAGE_KEY, trimmedEmail)
      setMessage('Check your email for a sign-in link.')
    } catch (sendError) {
      console.error('Failed to send sign-in link', sendError)
      setError('The sign-in link could not be sent. Check the email and try again.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FFF9F2] dark:bg-[#151A17] text-[#5C4D42] dark:text-[#CBD5D0] flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-[40px] border-4 border-white dark:border-[#232B26] bg-white/80 dark:bg-[#1A211D]/90 p-8 sm:p-10 shadow-[0_24px_80px_rgba(92,77,66,0.12)]">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#A7C080] text-white shadow-[0_10px_25px_rgba(167,192,128,0.35)]">
            <Sprout size={28} strokeWidth={2.75} />
          </div>
          <div>
            <h1 className="font-serif text-3xl font-black text-[#8FA66A] dark:text-[#B8D194]">
              Root Record
            </h1>
            <p className="text-sm font-bold text-[#A8BDB4] dark:text-[#5B6D65]">
              Sign in to sync your garden
            </p>
          </div>
        </div>

        <form className="space-y-5" onSubmit={sendLink}>
          <label className="block space-y-2">
            <span className="ml-3 text-[10px] font-black uppercase tracking-[0.25em] text-[#A8BDB4] dark:text-[#5B6D65]">
              Email
            </span>
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-[28px] bg-[#FFF9F2] p-5 font-bold text-[#5C4D42] outline-none ring-4 ring-transparent placeholder:text-[#D9E3D8] focus:ring-[#A7C080]/15 dark:bg-[#232B26] dark:text-white dark:placeholder:text-[#415147]"
            />
          </label>

          <button
            type="submit"
            disabled={isSending || isCompletingSignIn}
            className="w-full rounded-[30px] bg-[#A7C080] px-6 py-5 font-serif text-lg font-black text-white shadow-[0_14px_30px_rgba(167,192,128,0.35)] transition hover:bg-[#96AD73] active:scale-95 disabled:cursor-wait disabled:opacity-70 dark:shadow-none"
          >
            {isSending ? 'Sending Link...' : 'Send Sign-In Link'}
          </button>
        </form>

        {isCompletingSignIn && (
          <p className="mt-5 rounded-[24px] bg-[#EAF2ED] px-5 py-4 text-sm font-bold text-[#8FA66A] dark:bg-[#2A332E] dark:text-[#A7C080]">
            Finishing sign-in...
          </p>
        )}

        {message && (
          <p className="mt-5 rounded-[24px] bg-[#EAF2ED] px-5 py-4 text-sm font-bold text-[#8FA66A] dark:bg-[#2A332E] dark:text-[#A7C080]">
            {message}
          </p>
        )}

        {error && (
          <p className="mt-5 rounded-[24px] bg-[#FFF4F2] px-5 py-4 text-sm font-bold text-[#D98E82] dark:bg-[#3D2B29] dark:text-[#F2C6C2]">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
