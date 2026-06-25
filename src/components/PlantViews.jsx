import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  CloudRain,
  Droplets,
  Heart,
  PencilLine,
  Sparkles,
  Sprout,
  Stars,
  Trash2,
  Wind,
  X,
} from 'lucide-react';
import {
  POPULAR_PLANTS,
  calculateNextDue,
  compressImage,
  dateInputToISOString,
  formatPlantDate,
  getStatus,
  normalizeFrequency,
  toDateInputValue,
} from '../plantUtils';
// --- Cute UI Components ---

export function NavItem({ active, onClick, icon, label, disabled }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[22px] px-4 py-3.5 transition-all sm:gap-5 sm:rounded-[32px] sm:px-6 sm:py-5 ${
        active 
          ? 'bg-[#A7C080] text-white shadow-[0_10px_20px_rgba(167,192,128,0.25)]' 
          : disabled ? 'opacity-30 cursor-not-allowed text-[#D9E3D8] dark:text-[#2A332E]' : 'text-[#A8BDB4] dark:text-[#5B6D65] hover:bg-white dark:hover:bg-[#232B26] hover:text-[#8FA66A] dark:hover:text-[#A7C080]'
      }`}
    >
      <div className={`transition-transform group-hover:scale-110 duration-300`}>{icon}</div>
      <span className="font-bold tracking-tight text-[15px]">{label}</span>
      {active && <div className="absolute right-4 w-2 h-2 bg-white rounded-full animate-pulse" />}
    </button>
  );
}

export function DashboardView({ plants, onPlantClick, onWater }) {
  const overdue = plants.filter(p => getStatus(calculateNextDue(p.lastWatered, p.frequency)) === 'overdue');
  const today = plants.filter(p => getStatus(calculateNextDue(p.lastWatered, p.frequency)) === 'today');

  return (
    <div className="mx-auto max-w-7xl space-y-8 sm:space-y-12 lg:space-y-16">
      {/* Sticker Style Stats */}
      <div className="grid grid-cols-3 gap-2 sm:gap-5 lg:gap-8">
        <StickerCard label="My Garden" value={plants.length} icon={<Sprout />} type="plants" />
        <StickerCard label="Thirsty" value={overdue.length} icon={<CloudRain />} type="water" highlight={overdue.length > 0} />
        <StickerCard label="Due Today" value={today.length} icon={<CheckCircle2 />} type="today" />
      </div>

      <section>
        <div className="mb-5 flex items-center gap-3 sm:mb-10 sm:gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F2C6C2] text-white shadow-lg dark:bg-[#4D3533] dark:text-[#F2C6C2] sm:h-12 sm:w-12">
            <Heart size={21} fill="currentColor" />
          </div>
          <h2 className="font-serif text-2xl font-black text-[#5C4D42] dark:text-white sm:text-3xl">Needs some love</h2>
        </div>
        
        {overdue.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4">
            {overdue.map(p => <PlantCard key={p.id} plant={p} onWater={onWater} onClick={() => onPlantClick(p.id)} />)}
          </div>
        ) : (
          <div className="rounded-[28px] border-2 border-dashed border-[#F2E8D5] bg-white/40 p-10 text-center dark:border-[#2A332E] dark:bg-[#232B26]/40 sm:rounded-[50px] sm:p-24">
            <Sparkles size={44} className="animate-spin-slow mx-auto mb-4 text-[#A7C080] opacity-30 sm:mb-6 sm:size-16" />
            <p className="font-serif text-base italic text-[#A8BDB4] dark:text-[#415147] sm:text-xl">Everyone is perfectly happy right now!</p>
          </div>
        )}
      </section>

      {today.length > 0 && (
        <section>
          <h2 className="mb-5 ml-1 font-serif text-2xl font-black text-[#5C4D42] dark:text-white sm:mb-10 sm:ml-2 sm:text-3xl">Today's Schedule</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4">
            {today.map(p => <PlantCard key={p.id} plant={p} onWater={onWater} onClick={() => onPlantClick(p.id)} />)}
          </div>
        </section>
      )}
    </div>
  );
}

export function ListView({ plants, filter, setFilter, onPlantClick, onWater }) {
  const PAGE_SIZE = 16;

  const [page, setPage] = React.useState(1);

  const showPagination = plants.length > PAGE_SIZE;
  const totalPages = showPagination ? Math.ceil(plants.length / PAGE_SIZE) : 1;

  // Reset to page 1 when the visible list changes (search/filter/add/delete)
  React.useEffect(() => {
    setPage(1);
  }, [plants.length, filter]);

  // Clamp page if it becomes out of range
  React.useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const pagedPlants = React.useMemo(() => {
    if (!showPagination) return plants;
    const start = (page - 1) * PAGE_SIZE;
    return plants.slice(start, start + PAGE_SIZE);
  }, [plants, page, showPagination]);

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  const pageItems = React.useMemo(() => {
    if (!showPagination) return [1];

    // Basic pagination: show first, last, and a window around current page.
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    const items = new Set([1, totalPages, page - 2, page - 1, page, page + 1, page + 2]);
    const nums = Array.from(items)
      .filter((n) => n >= 1 && n <= totalPages)
      .sort((a, b) => a - b);

    const out = [];
    for (let i = 0; i < nums.length; i++) {
      const n = nums[i];
      out.push(n);
      const next = nums[i + 1];
      if (next && next > n + 1) out.push("...");
    }
    return out;
  }, [page, totalPages, showPagination]);

  const renderPagination = (className = "") => {
    if (!showPagination) return null;

    return (
      <div className={`flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${className}`}>
        <div className="text-[11px] font-black uppercase tracking-widest text-[#A8BDB4] dark:text-[#5B6D65]">
          Showing{" "}
          <span className="text-[#5C4D42] dark:text-white">
            {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, plants.length)}
          </span>{" "}
          of <span className="text-[#5C4D42] dark:text-white">{plants.length}</span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={goPrev}
            disabled={page === 1}
            className="rounded-[18px] border-2 border-black bg-white px-4 py-2.5 font-black text-[#5C4D42] transition hover:translate-y-[-1px] active:translate-y-[0px] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#2A332E] dark:bg-[#232B26] dark:text-white sm:rounded-[22px] sm:px-5 sm:py-3"
          >
            Prev
          </button>

          <div className="flex items-center gap-1 rounded-full border border-[#F2E8D5] bg-white/60 p-1.5 shadow-sm backdrop-blur dark:border-[#2A332E] dark:bg-[#1A211D]/80 sm:p-2">
            {pageItems.map((it, idx) => {
              if (it === "...") {
                return (
                  <span
                    key={`dots-${idx}`}
                    className="px-3 py-2 text-xs font-black text-[#A8BDB4] dark:text-[#5B6D65]"
                  >
                    ...
                  </span>
                );
              }

              const n = it;
              const active = n === page;

              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPage(n)}
                  className={`min-w-9 rounded-full px-3 py-2 text-xs font-black uppercase tracking-widest transition-all sm:min-w-[44px] sm:px-4 ${
                    active
                      ? "bg-[#A7C080] text-white shadow-md scale-105"
                      : "text-[#A8BDB4] dark:text-[#5B6D65] hover:text-[#8FA66A] dark:hover:text-[#A7C080]"
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  {n}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={goNext}
            disabled={page === totalPages}
            className="rounded-[18px] border-2 border-black bg-white px-4 py-2.5 font-black text-[#5C4D42] transition hover:translate-y-[-1px] active:translate-y-[0px] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#2A332E] dark:bg-[#232B26] dark:text-white sm:rounded-[22px] sm:px-5 sm:py-3"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center sm:mb-12 sm:gap-8">
        <h2 className="font-serif text-3xl font-black text-[#5C4D42] dark:text-white sm:text-4xl">
          The Full Nursery
        </h2>

        <div className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-[#F2E8D5] bg-white/60 p-1.5 shadow-sm backdrop-blur dark:border-[#2A332E] dark:bg-[#1A211D]/80 sm:p-2">
          {["all", "overdue", "today", "upcoming"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-4 py-2.5 text-[11px] font-black uppercase tracking-widest transition-all sm:px-8 sm:py-3 sm:text-xs ${
                filter === f
                  ? "bg-[#A7C080] text-white shadow-md scale-105"
                  : "text-[#A8BDB4] dark:text-[#5B6D65] hover:text-[#8FA66A] dark:hover:text-[#A7C080]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Top pagination (only when needed) */}
      {showPagination && renderPagination("mb-8")}

      {plants.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4">
            {pagedPlants.map((p) => (
              <PlantCard
                key={p.id}
                plant={p}
                onWater={onWater}
                onClick={() => onPlantClick(p.id)}
              />
            ))}
          </div>

          {/* Bottom pagination (only when needed) */}
          {showPagination && renderPagination("mt-10")}
        </>
      ) : (
        <div className="rounded-[32px] border-2 border-dashed border-[#F2E8D5] bg-white py-20 text-center dark:border-[#2A332E] dark:bg-[#232B26] sm:rounded-[60px] sm:py-32">
          <Wind
            size={64}
            className="mx-auto text-[#D9E3D8] dark:text-[#151A17] mb-8 animate-pulse"
          />
          <h3 className="px-6 font-serif text-xl italic text-[#A8BDB4] dark:text-[#415147] sm:text-2xl">
            So much space for new plant friends...
          </h3>
        </div>
      )}
    </div>
  );
}



export function DetailView({ plant, onBack, onWater, onDelete, onEdit }) {
  const nextDue = calculateNextDue(plant.lastWatered, plant.frequency);
  const status = getStatus(nextDue);

  return (
    <div className="animate-in zoom-in-95 mx-auto max-w-5xl duration-500">
      <button onClick={onBack} className="group mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-[#A8BDB4] transition-all hover:text-[#A7C080] dark:text-[#5B6D65] sm:mb-10 sm:gap-3">
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" /> BACK TO JOURNAL
      </button>

      <div className="overflow-hidden rounded-[32px] border border-[#F2E8D5] bg-white shadow-[0_30px_60px_-15px_rgba(167,192,128,0.15)] dark:border-[#2A332E] dark:bg-[#232B26] dark:shadow-none sm:rounded-[60px]">
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="flex h-[320px] items-center justify-center bg-[#FFF9F2] p-4 dark:bg-[#1A211D] sm:h-[500px] sm:p-8 md:h-auto">
            <div className="relative h-full w-full overflow-hidden rounded-[24px] shadow-2xl sm:rounded-[40px]">
              {plant.photo ? (
                <img src={plant.photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#D9E3D8] dark:text-[#232B26] gap-4">
                  <Camera size={80} strokeWidth={1} />
                  <p className="font-serif italic">No portrait yet</p>
                </div>
              )}
            </div>
          </div>
          
<div className="space-y-6 p-5 sm:space-y-10 sm:p-10 lg:p-16">

  {/* HEADER */}
<div className="flex items-start gap-3 sm:items-center sm:gap-4">
  {/* LEFT: species */}
  <div className="flex min-w-0 items-center gap-2 rounded-full border border-transparent bg-[#EAF2ED] px-4 py-2.5 text-[#8FA66A] dark:border-[#A7C080]/20 dark:bg-[#A7C080]/10 dark:text-[#A7C080] sm:gap-3 sm:px-6 sm:py-3">
    <Stars size={16} />
    <span className="truncate text-xs font-black uppercase tracking-widest sm:text-sm">
      {plant.species || "Nature's Gem"}
    </span>
  </div>

  {/* RIGHT: actions */}
  <div className="flex items-center gap-2 ml-auto shrink-0">
    <button
      onClick={onEdit}
      className="rounded-[18px] p-3 text-[#A7C080] transition-all hover:bg-[#EAF2ED] hover:text-[#8FA66A] dark:hover:bg-[#A7C080]/10 sm:rounded-[24px] sm:p-4"
      title="Edit"
    >
      <span className="sr-only">Edit</span>
      <PencilLine size={24} />
    </button>

    <button
      onClick={() => onDelete(plant.id)}
      className="rounded-[18px] p-3 text-[#F2C6C2] transition-all hover:bg-[#FFF4F2] hover:text-[#D98E82] dark:text-[#B17F7A] dark:hover:bg-[#B17F7A]/10 sm:rounded-[24px] sm:p-4"
      title="Delete"
    >
      <Trash2 size={24} />
    </button>
  </div>
</div>


{/* TITLE */}
<div className="space-y-4">
<h1 className="text-2xl sm:text-3xl lg:text-5xl font-serif font-black text-[#5C4D42] dark:text-white leading-snug break-words [overflow-wrap:anywhere]">
  {plant.name}
</h1>




  </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-8">
              <div className="rounded-[24px] border-2 border-white bg-[#FEF9E7] p-4 shadow-sm transition-colors dark:border-transparent dark:bg-[#2F332A] sm:rounded-[40px] sm:p-8">
                <p className="text-[10px] font-black text-[#D9C582] dark:text-[#E8C06F] uppercase tracking-[0.25em] mb-2 text-center">Interval</p>
                <p className="text-lg sm:text-xl font-black text-[#5C4D42] dark:text-[#E8DCCB] text-center">
{plant.frequency} Days</p>
              </div>
              <div className={`rounded-[24px] border-2 border-white p-4 shadow-sm transition-colors dark:border-transparent sm:rounded-[40px] sm:p-8 ${status === 'overdue' ? 'bg-[#FFF4F2] dark:bg-[#3D2B29]' : 'bg-[#EAF2ED] dark:bg-[#2A332E]'}`}>
                <p className={`text-[10px] font-black uppercase tracking-[0.25em] mb-2 text-center ${status === 'overdue' ? 'text-[#D98E82]' : 'text-[#8FA66A]'}`}>Feeling</p>
                <p className={`text-lg sm:text-xl font-black text-center capitalize ${status === 'overdue' ? 'text-[#D98E82]' : 'text-[#8FA66A]'}`}>
                  {status === 'overdue' ? 'Thirsty' : 'Happy'}
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t-2 border-dotted border-[#F2E8D5] pt-5 dark:border-[#2A332E] sm:space-y-6 sm:border-t-4 sm:pt-6">
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 dark:text-[#5B6D65] font-bold uppercase tracking-widest text-[10px]">Last Hydration</span>
                <span className="font-bold text-sm sm:text-base text-[#5C4D42] dark:text-[#CBD5D0]">
{formatPlantDate(plant.lastWatered)}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-slate-400 dark:text-[#5B6D65] font-bold uppercase tracking-widest text-[10px]">Next Best Time</span>
                <span className="font-black text-[#A7C080]">{formatPlantDate(nextDue)}</span>
              </div>
            </div>

<button
  onClick={() => onWater(plant.id)}
  className="
    w-full
    py-4 sm:py-6
    bg-gradient-to-r from-[#8DA399] to-[#A7C080]
    text-white
    rounded-[24px] sm:rounded-[36px]
    font-black
    shadow-[0_12px_32px_rgba(167,192,128,0.35)]
    dark:shadow-none
    flex items-center justify-center gap-3
    transition-all
    active:scale-95
    text-sm sm:text-base lg:text-lg
  "
>
  <Droplets className="w-5 h-5 sm:w-6 sm:h-6" />
  <span className="tracking-wide">MARK AS REFRESHED</span>
</button>

          </div>
        </div>
      </div>
    </div>
  );
}

// --- Sticker/Card Sub-components ---

function StickerCard({ label, value, icon, type, highlight }) {
  const themes = {
    plants: 'bg-[#EAF2ED] dark:bg-[#2A332E] text-[#8FA66A] dark:text-[#A7C080]',
    water: highlight ? 'bg-[#FFF4F2] dark:bg-[#3D2B29] text-[#D98E82] dark:text-[#F2C6C2]' : 'bg-[#FFF4F2] dark:bg-[#2A332E] text-[#D98E82] dark:text-[#5B6D65]',
    today: 'bg-[#FEF9E7] dark:bg-[#3D3829] text-[#D9C582] dark:text-[#E8C06F]'
  };

  return (
    <div className={`${themes[type]} flex items-center justify-between rounded-[22px] border-2 border-white p-3 shadow-[0_10px_0_rgba(0,0,0,0.03)] transition-transform dark:border-[#2A332E]/30 sm:rounded-[48px] sm:border-4 sm:p-10 sm:hover:-rotate-2`}>
      <div className="min-w-0">
        <p className="mb-1 truncate text-[9px] font-black uppercase tracking-[0.14em] opacity-60 sm:text-[11px] sm:tracking-[0.25em]">{label}</p>
        <p className="font-serif text-2xl font-black sm:text-5xl">{value}</p>
      </div>
      <div className={`flex h-9 w-9 items-center justify-center rounded-full bg-white/80 shadow-lg dark:bg-black/20 sm:h-16 sm:w-16 ${highlight ? 'animate-bounce' : ''}`}>
        {React.cloneElement(icon, { size: 22, strokeWidth: 3 })}
      </div>
    </div>
  );
}

function PlantCard({ plant, onWater, onClick }) {
  const nextDue = calculateNextDue(plant.lastWatered, plant.frequency);
  const status = getStatus(nextDue);

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-[28px] border-2 border-[#F2E8D5] bg-white shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all hover:shadow-[0_25px_60px_-15px_rgba(167,192,128,0.2)] dark:border-[#2A332E] dark:bg-[#232B26] dark:hover:shadow-none sm:rounded-[50px] sm:hover:-translate-y-3">
      <div className="relative m-2 mb-0 h-44 cursor-pointer overflow-hidden rounded-[22px] bg-[#FFF9F2] dark:bg-[#1A211D] sm:m-3 sm:mb-0 sm:h-64 sm:rounded-[40px]" onClick={onClick}>
        {plant.photo ? (
          <img src={plant.photo} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[#D9E3D8] dark:text-[#232B26]">
            <Sprout size={48} />
          </div>
        )}
        <div className={`absolute left-3 top-3 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] shadow-xl backdrop-blur-md sm:left-5 sm:top-5 sm:px-5 sm:py-2 sm:text-[10px] ${
          status === 'overdue' ? 'bg-[#F2C6C2] text-white animate-pulse' : 'bg-white/90 dark:bg-[#2A332E]/90 text-[#A7C080]'
        }`}>
          {status === 'overdue' ? 'Thirsty!' : status === 'today' ? 'Due Today' : 'Comfy'}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5 sm:p-8">
        <div className="mb-4 flex-1 cursor-pointer sm:mb-6" onClick={onClick}>
          <h3 className="mb-1 truncate font-serif text-xl font-black text-[#5C4D42] dark:text-white sm:text-2xl">{plant.name}</h3>
          <p className="text-xs text-[#A8BDB4] dark:text-[#5B6D65] font-bold uppercase tracking-widest truncate">{plant.species || 'Wild Bud'}</p>
        </div>
        <div className="flex items-center justify-between border-t-2 border-dashed border-[#F2E8D5] pt-4 dark:border-[#2A332E] sm:pt-6">
          <div className="space-y-1">
            <p className="text-[9px] font-black text-[#D9E3D8] dark:text-[#415147] uppercase tracking-widest">Next Sip</p>
            <p className="text-xs font-black text-[#A7C080]">{formatPlantDate(nextDue)}</p>
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onWater(plant.id); }}
            className={`rounded-[18px] p-3.5 shadow-lg transition-all active:scale-90 sm:rounded-[24px] sm:p-5 ${
              status === 'overdue' ? 'bg-[#FDF2F2] dark:bg-[#4D3533] text-[#F2C6C2]' : 'bg-[#EAF2ED] dark:bg-[#2F3932] text-[#A7C080]'
            }`}
          >
            <Droplets size={24} fill="currentColor" />
          </button>
        </div>
      </div>
    </div>
  );
}


export function AddPlantModal({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [frequency, setFrequency] = useState(7);
  const [lastWatered, setLastWatered] = useState(toDateInputValue);
  const [photo, setPhoto] = useState(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const filteredSuggestions = useMemo(() => {
    if (!species || species.length < 2) return [];
    return POPULAR_PLANTS.filter(p => p.toLowerCase().includes(species.toLowerCase())).slice(0, 5);
  }, [species]);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setPhoto(await compressImage(file));
    } catch (error) {
      console.error('Failed to compress plant photo', error);
      window.alert('That photo could not be optimized. Choose another image and try again.');
    }
  };

  return (
    <div className="animate-in fade-in fixed inset-0 z-[100] flex items-center justify-center bg-[#151A17]/70 p-3 backdrop-blur-xl duration-500 sm:p-6">
      <div className="animate-in zoom-in-95 flex max-h-[96svh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border-4 border-white bg-white shadow-2xl duration-500 dark:border-[#232B26] dark:bg-[#232B26] sm:max-h-[95vh] sm:rounded-[60px] sm:border-8">
        <div className="flex items-center justify-between p-5 pb-0 sm:p-10 sm:pb-0">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#A7C080] text-white sm:h-10 sm:w-10"><Stars size={20} /></div>
            <h2 className="truncate font-serif text-2xl font-black text-[#5C4D42] dark:text-white sm:text-4xl">New Friend</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2.5 transition-colors hover:bg-[#FFF9F2] dark:text-white dark:hover:bg-[#1A211D] sm:p-3"><X size={24}/></button>
        </div>
        
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsSaving(true);

            try {
              await onSubmit({
                name,
                species,
                frequency: normalizeFrequency(frequency),
                lastWatered: dateInputToISOString(lastWatered),
                photo,
              });
              onClose();
            } catch (error) {
              console.error('Add plant form submit failed', error);
              setIsSaving(false);
            }
          }}
          className="custom-scrollbar space-y-6 overflow-y-auto p-5 sm:space-y-10 sm:p-10"
        >
          <div className="flex flex-col gap-5 md:flex-row md:gap-10">
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="relative flex h-44 w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[24px] border-2 border-dashed border-[#F2E8D5] bg-[#FFF9F2] shadow-inner transition-all hover:border-[#A7C080] dark:border-[#2A332E] dark:bg-[#1A211D] sm:h-60 sm:rounded-[48px] sm:border-4 md:w-60"
            >
              {photo ? (
                <img src={photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-[#D9E3D8] dark:text-[#2A332E] space-y-2">
                  <Camera size={44} strokeWidth={1.5} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Take a Photo</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handlePhoto} className="hidden" accept="image/*" />
            </div>

            <div className="flex-1 space-y-5 sm:space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Nickname</label>
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Blossom" className="w-full rounded-[22px] border-none bg-[#FFF9F2] p-4 font-bold outline-none ring-4 ring-transparent transition-all placeholder-[#D9E3D8] focus:ring-[#A7C080]/10 dark:bg-[#1A211D] dark:text-white dark:placeholder-[#2A332E] sm:rounded-[30px] sm:p-6" />
              </div>

              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Variety</label>
                <input value={species} onChange={e => { setSpecies(e.target.value); setShowSuggestions(true); }} placeholder="e.g. Pothos" className="w-full rounded-[22px] border-none bg-[#FFF9F2] p-4 font-bold outline-none ring-4 ring-transparent transition-all placeholder-[#D9E3D8] focus:ring-[#A7C080]/10 dark:bg-[#1A211D] dark:text-white dark:placeholder-[#2A332E] sm:rounded-[30px] sm:p-6" />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-3 overflow-hidden rounded-[22px] border-2 border-[#F2E8D5] bg-white shadow-2xl dark:border-[#1A211D] dark:bg-[#2A332E] sm:mt-4 sm:rounded-[30px]">
                    {filteredSuggestions.map(s => (
                      <button key={s} type="button" onClick={() => { setSpecies(s); setShowSuggestions(false); }} className="w-full px-6 py-5 text-left hover:bg-[#EAF2ED] dark:hover:bg-[#A7C080]/10 text-sm font-bold dark:text-slate-200 transition-colors">{s}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Sip Frequency (Days)</label>
              <input type="number" min="1" value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full rounded-[22px] border-none bg-[#FFF9F2] p-4 outline-none dark:bg-[#1A211D] dark:text-white sm:rounded-[30px] sm:p-6" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Birth/Join Date</label>
              <input type="date" value={lastWatered} onChange={e => setLastWatered(e.target.value)} className="w-full rounded-[22px] border-none bg-[#FFF9F2] p-4 outline-none [color-scheme:light] dark:bg-[#1A211D] dark:text-white dark:[color-scheme:dark] sm:rounded-[30px] sm:p-6" />
            </div>
          </div>

          <button type="submit" disabled={isSaving} className="mt-3 w-full rounded-[26px] border-b-4 border-[#8FA66A] bg-[#A7C080] py-5 text-lg font-black text-white shadow-[0_20px_40px_rgba(167,192,128,0.3)] transition-all hover:bg-[#96AD73] active:scale-95 disabled:cursor-wait disabled:opacity-70 dark:border-transparent dark:shadow-none sm:mt-6 sm:rounded-[40px] sm:border-b-8 sm:py-8 sm:text-2xl">
            {isSaving ? 'SAVING...' : 'WELCOME TO THE FAMILY'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function EditPlantModal({ plant, onClose, onSubmit }) {
  const [name, setName] = useState(plant?.name || '');
  const [species, setSpecies] = useState(plant?.species || '');
  const [frequency, setFrequency] = useState(plant?.frequency ?? 7);
  const [lastWatered, setLastWatered] = useState(() => toDateInputValue(plant?.lastWatered));
  const [photo, setPhoto] = useState(plant?.photo || null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const filteredSuggestions = useMemo(() => {
    if (!species || species.length < 2) return [];
    return POPULAR_PLANTS.filter(p => p.toLowerCase().includes(species.toLowerCase())).slice(0, 5);
  }, [species]);

  const handlePhoto = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setPhoto(await compressImage(file));
    } catch (error) {
      console.error('Failed to compress plant photo', error);
      window.alert('That photo could not be optimized. Choose another image and try again.');
    }
  };

  return (
    <div className="animate-in fade-in fixed inset-0 z-[110] flex items-center justify-center bg-[#151A17]/70 p-3 backdrop-blur-xl duration-500 sm:p-6">
      <div className="animate-in zoom-in-95 flex max-h-[96svh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border-4 border-white bg-white shadow-2xl duration-500 dark:border-[#232B26] dark:bg-[#232B26] sm:max-h-[95vh] sm:rounded-[60px] sm:border-8">
        <div className="flex items-center justify-between p-5 pb-0 sm:p-10 sm:pb-0">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#A7C080] text-white sm:h-10 sm:w-10"><Sparkles size={20} /></div>
            <h2 className="truncate font-serif text-2xl font-black text-[#5C4D42] dark:text-white sm:text-4xl">Edit Plant</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2.5 transition-colors hover:bg-[#FFF9F2] dark:text-white dark:hover:bg-[#1A211D] sm:p-3"><X size={24}/></button>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setIsSaving(true);

            try {
              await onSubmit({
                name,
                species,
                frequency: normalizeFrequency(frequency),
                lastWatered: dateInputToISOString(lastWatered),
                photo
              });
              onClose();
            } catch (error) {
              console.error('Edit plant form submit failed', error);
              setIsSaving(false);
            }
          }}
          className="custom-scrollbar space-y-6 overflow-y-auto p-5 sm:space-y-10 sm:p-10"
        >
          <div className="flex flex-col gap-5 md:flex-row md:gap-10">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="relative flex h-44 w-full shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[24px] border-2 border-dashed border-[#F2E8D5] bg-[#FFF9F2] shadow-inner transition-all hover:border-[#A7C080] dark:border-[#2A332E] dark:bg-[#1A211D] sm:h-60 sm:rounded-[48px] sm:border-4 md:w-60"
            >
              {photo ? (
                <img src={photo} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-[#D9E3D8] dark:text-[#2A332E] space-y-2">
                  <Camera size={44} strokeWidth={1.5} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Add / Change Photo</p>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handlePhoto} className="hidden" accept="image/*" />
            </div>

            <div className="flex-1 space-y-5 sm:space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Nickname</label>
                <input required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Blossom" className="w-full rounded-[22px] border-none bg-[#FFF9F2] p-4 font-bold outline-none ring-4 ring-transparent transition-all placeholder-[#D9E3D8] focus:ring-[#A7C080]/10 dark:bg-[#1A211D] dark:text-white dark:placeholder-[#2A332E] sm:rounded-[30px] sm:p-6" />
              </div>

              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Variety</label>
                <input value={species} onChange={e => { setSpecies(e.target.value); setShowSuggestions(true); }} placeholder="e.g. Pothos" className="w-full rounded-[22px] border-none bg-[#FFF9F2] p-4 font-bold outline-none ring-4 ring-transparent transition-all placeholder-[#D9E3D8] focus:ring-[#A7C080]/10 dark:bg-[#1A211D] dark:text-white dark:placeholder-[#2A332E] sm:rounded-[30px] sm:p-6" />
                {showSuggestions && filteredSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-3 overflow-hidden rounded-[22px] border-2 border-[#F2E8D5] bg-white shadow-2xl dark:border-[#1A211D] dark:bg-[#2A332E] sm:mt-4 sm:rounded-[30px]">
                    {filteredSuggestions.map(s => (
                      <button key={s} type="button" onClick={() => { setSpecies(s); setShowSuggestions(false); }} className="w-full px-6 py-5 text-left hover:bg-[#EAF2ED] dark:hover:bg-[#A7C080]/10 text-sm font-bold dark:text-slate-200 transition-colors">{s}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-8">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Sip Frequency (Days)</label>
              <input type="number" min="1" value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full rounded-[22px] border-none bg-[#FFF9F2] p-4 outline-none dark:bg-[#1A211D] dark:text-white sm:rounded-[30px] sm:p-6" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-[#A8BDB4] dark:text-[#5B6D65] uppercase tracking-[0.25em] ml-4">Last Watered</label>
              <input type="date" value={lastWatered} onChange={e => setLastWatered(e.target.value)} className="w-full rounded-[22px] border-none bg-[#FFF9F2] p-4 outline-none [color-scheme:light] dark:bg-[#1A211D] dark:text-white dark:[color-scheme:dark] sm:rounded-[30px] sm:p-6" />
            </div>
          </div>

          <button type="submit" disabled={isSaving} className="mt-3 w-full rounded-[26px] border-b-4 border-[#8FA66A] bg-[#A7C080] py-5 text-lg font-black text-white shadow-[0_20px_40px_rgba(167,192,128,0.3)] transition-all hover:bg-[#96AD73] active:scale-95 disabled:cursor-wait disabled:opacity-70 dark:border-transparent dark:shadow-none sm:mt-6 sm:rounded-[40px] sm:border-b-8 sm:py-8 sm:text-2xl">
            {isSaving ? 'SAVING...' : 'SAVE CHANGES'}
          </button>
        </form>
      </div>
    </div>
  );
}

