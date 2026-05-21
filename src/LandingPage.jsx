import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Cloud,
  Droplets,
  Smartphone,
  Sparkles,
  Sprout,
} from 'lucide-react'

const BASE_URL = import.meta.env.BASE_URL

const features = [
  {
    icon: Droplets,
    title: 'Watering at a glance',
    copy: 'See the plants that need attention now, mark them refreshed, and let the next care date roll forward.',
  },
  {
    icon: Camera,
    title: 'A record that looks like yours',
    copy: 'Add photos, names, varieties, and care intervals so every plant stays recognizable in the collection.',
  },
  {
    icon: Cloud,
    title: 'Synced garden notes',
    copy: 'Sign in by email link and keep the same plant list available across the devices you already use.',
  },
]

const steps = [
  'Add each plant with its own watering rhythm.',
  'Open Root Record when you want a quick care check.',
  'Refresh thirsty plants in one tap and keep moving.',
]

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-[#FFF9F2] font-sans text-[#5C4D42]">
      <section className="relative min-h-[92svh] overflow-hidden bg-[#233127]">
        <img
          src={`${BASE_URL}root-record-hero.png`}
          alt="A sunlit plant shelf with a watering can and garden journal."
          className="absolute inset-0 h-full w-full object-cover object-[64%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(21,26,23,0.82)_0%,rgba(21,26,23,0.58)_38%,rgba(21,26,23,0.16)_72%,rgba(21,26,23,0.1)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-[#FFF9F2] to-transparent" />

        <div className="relative mx-auto flex min-h-[92svh] w-full max-w-7xl flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-10">
          <nav className="flex min-w-0 items-center justify-between gap-2 rounded-[28px] border border-white/25 bg-white/15 px-3 py-3 text-white shadow-[0_18px_60px_rgba(21,26,23,0.18)] backdrop-blur-md sm:gap-4 sm:px-5">
            <a href="#" className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-white/90 shadow-lg">
                <img src={`${BASE_URL}logo.png`} alt="" className="h-10 w-10 object-contain" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-serif text-sm font-black text-white sm:text-lg">
                  Root Record
                </span>
                <span className="block truncate text-[9px] font-black uppercase tracking-[0.18em] text-white/65 sm:text-[10px] sm:tracking-[0.22em]">
                  Plant care tracker
                </span>
              </span>
            </a>
            <a
              href="#app"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-[#A7C080] px-3 py-2 text-xs font-black text-[#223126] shadow-[0_12px_28px_rgba(21,26,23,0.2)] transition hover:bg-[#B8D194] sm:px-5 sm:text-sm"
            >
              Open app
            </a>
          </nav>

          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] items-center gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_420px] lg:py-16">
            <div className="min-w-0 max-w-2xl text-white">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/14 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-[#EAF2ED] backdrop-blur-md">
                <Sprout size={15} />
                For everyday plant care
              </p>
              <h1 className="font-serif text-5xl font-black leading-[1.06] text-white sm:text-6xl lg:text-7xl">
                Root Record
              </h1>
              <p className="mt-5 max-w-full break-words text-lg font-semibold leading-8 text-[#F4EEE5] [overflow-wrap:anywhere] sm:max-w-xl sm:text-xl">
                A cozy plant tracker for the care you actually repeat: remember watering rhythms,
                notice thirsty plants faster, and keep a living record of the collection around you.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#app"
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[#A7C080] px-7 py-4 font-serif text-base font-black text-[#223126] shadow-[0_20px_44px_rgba(21,26,23,0.25)] transition hover:bg-[#B8D194]"
                >
                  Start your record
                  <ArrowRight size={18} />
                </a>
                <a
                  href="#routine"
                  className="inline-flex min-h-14 items-center justify-center rounded-full border border-white/35 bg-white/12 px-7 py-4 text-base font-black text-white backdrop-blur-md transition hover:bg-white/20"
                >
                  See the routine
                </a>
              </div>
              <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-sm font-bold text-white/82">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#D9C582]" />
                  Email-link sign in
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#F2C6C2]" />
                  Works on the web
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#A7C080]" />
                  Installable on your phone
                </span>
              </div>
            </div>

            <div className="hidden w-full max-w-[420px] rounded-[36px] border border-white/35 bg-[#FFF9F2]/92 p-4 shadow-[0_28px_90px_rgba(21,26,23,0.28)] backdrop-blur sm:block lg:justify-self-end">
              <div className="rounded-[28px] bg-white p-5 shadow-inner">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#A8BDB4]">
                      Today
                    </p>
                    <p className="mt-1 font-serif text-2xl font-black text-[#5C4D42]">
                      Garden check
                    </p>
                  </div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[#EAF2ED] text-[#8FA66A]">
                    <Droplets size={25} strokeWidth={2.6} />
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <PreviewStat label="Plants" value="18" tone="sage" />
                  <PreviewStat label="Thirsty" value="3" tone="rose" />
                </div>

                <div className="mt-4 space-y-3">
                  <PreviewPlant name="Peperomia Hope" status="Due today" tone="gold" />
                  <PreviewPlant name="Monstera" status="Refreshed" tone="sage" />
                  <PreviewPlant name="Pink Aglaonema" status="Tomorrow" tone="rose" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="routine" className="relative z-10 -mt-12 rounded-t-[40px] bg-[#FFF9F2] px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:px-10 lg:pt-20">
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#8FA66A]">
              Care, simplified
            </p>
            <h2 className="mt-4 font-serif text-3xl font-black leading-tight text-[#5C4D42] sm:text-4xl">
              Keep the daily check small and the plant history clear.
            </h2>
            <p className="mt-5 text-base font-semibold leading-8 text-[#7B6B60]">
              Root Record is built around the useful bits of a plant journal: what you have,
              what needs water, and when you last cared for it.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {features.map(({ icon: Icon, title, copy }) => (
              <article
                key={title}
                className="rounded-[30px] border-2 border-white bg-white/78 p-6 shadow-[0_18px_55px_rgba(92,77,66,0.08)]"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-[20px] bg-[#EAF2ED] text-[#8FA66A]">
                  <Icon size={24} strokeWidth={2.6} />
                </span>
                <h3 className="mt-5 font-serif text-xl font-black text-[#5C4D42]">
                  {title}
                </h3>
                <p className="mt-3 text-sm font-semibold leading-7 text-[#7B6B60]">
                  {copy}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#EAF2ED] px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-12 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center">
          <div className="rounded-[38px] border-4 border-white bg-[#FFF9F2] p-5 shadow-[0_24px_80px_rgba(92,77,66,0.12)] sm:p-7">
            <div className="flex flex-col gap-5 rounded-[30px] bg-white p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#A8BDB4]">
                    Plant detail
                  </p>
                  <p className="mt-2 font-serif text-3xl font-black text-[#5C4D42]">
                    Bird of Paradise
                  </p>
                </div>
                <span className="rounded-full bg-[#FEF9E7] px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-[#C5A846]">
                  7 day rhythm
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <div className="rounded-[26px] bg-[#F3E8E3] p-5">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-[#D98E82]">
                    Next sip
                  </p>
                  <p className="mt-3 text-2xl font-black text-[#5C4D42]">
                    Due today
                  </p>
                  <p className="mt-3 text-sm font-bold leading-6 text-[#7B6B60]">
                    A quick refresh updates the care timeline immediately.
                  </p>
                </div>
                <div className="flex min-h-44 items-center justify-center rounded-[26px] bg-[#EDF3EC] text-[#8FA66A]">
                  <Sparkles size={58} strokeWidth={1.9} />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#8FA66A]">
              The routine
            </p>
            <h2 className="mt-4 font-serif text-3xl font-black leading-tight text-[#5C4D42] sm:text-4xl">
              Designed for checking in, not getting lost in settings.
            </h2>
            <div className="mt-7 space-y-4">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#A7C080] font-serif font-black text-[#233127]">
                    {index + 1}
                  </span>
                  <p className="pt-2 text-base font-bold leading-7 text-[#6D5E54]">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 lg:px-10">
        <div className="mx-auto grid w-full max-w-7xl gap-8 rounded-[40px] bg-[#1A211D] px-6 py-10 text-white shadow-[0_28px_90px_rgba(21,26,23,0.2)] sm:px-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-3 text-[#B8D194]">
              <Smartphone size={24} />
              <span className="text-xs font-black uppercase tracking-[0.28em]">
                Web app, home-screen ready
              </span>
            </div>
            <h2 className="mt-4 font-serif text-3xl font-black leading-tight sm:text-4xl">
              Bring your plant list with you.
            </h2>
            <p className="mt-4 max-w-2xl text-base font-semibold leading-8 text-[#D9E3D8]">
              Open Root Record in the browser, sign in with your email, and install it on
              your phone when you want it one tap away.
            </p>
          </div>
          <a
            href="#app"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-[#F2C6C2] px-7 py-4 font-serif text-base font-black text-[#4C332F] transition hover:bg-[#F7D7D4]"
          >
            Open Root Record
            <ArrowRight size={18} />
          </a>
        </div>
      </section>

      <footer className="border-t border-[#F2E8D5] px-5 py-8 text-sm font-bold text-[#8A796D] sm:px-8 lg:px-10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="font-serif text-[#8FA66A]">Root Record</span>
          <span>Plant care that stays close to the routine.</span>
        </div>
      </footer>
    </main>
  )
}

function PreviewStat({ label, value, tone }) {
  const styles = {
    rose: 'bg-[#FFF4F2] text-[#D98E82]',
    sage: 'bg-[#EAF2ED] text-[#8FA66A]',
  }

  return (
    <div className={`${styles[tone]} rounded-[24px] p-4`}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">
        {label}
      </p>
      <p className="mt-2 font-serif text-3xl font-black">{value}</p>
    </div>
  )
}

function PreviewPlant({ name, status, tone }) {
  const styles = {
    gold: 'bg-[#FEF9E7] text-[#C5A846]',
    rose: 'bg-[#FFF4F2] text-[#D98E82]',
    sage: 'bg-[#EAF2ED] text-[#8FA66A]',
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-[22px] border border-[#F2E8D5] px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-[#5C4D42]">{name}</p>
        <p className="mt-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#A8BDB4]">
          Plant record
        </p>
      </div>
      <span className={`${styles[tone]} shrink-0 rounded-full px-3 py-2 text-[10px] font-black uppercase tracking-[0.16em]`}>
        {status}
      </span>
    </div>
  )
}
