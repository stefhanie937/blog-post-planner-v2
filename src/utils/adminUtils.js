// Shared look + helpers for the admin side.
// The class strings mirror the ones in Account.vue so both sides match.

// ---------------------------------------------------------------------------
// Look
// ---------------------------------------------------------------------------
export const cardClass =
  'bg-white rounded-2xl shadow-[0_14px_32px_-14px_rgba(35,43,77,0.4)] animate-card-in'
export const sectionHeadClass = 'flex items-center gap-3 px-4 py-3.5 border-b border-gray-100'
export const iconBubbleClass =
  'w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-brand-navy/5 text-brand-navy'
export const labelClass =
  'block font-body text-[11px] font-semibold uppercase tracking-wider text-brand-navy/50 mb-1.5'
export const inputClass =
  'w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-body text-brand-navy placeholder-brand-navy/35 outline-none focus:ring-2 focus:ring-brand-indigo/25 disabled:opacity-60 disabled:cursor-not-allowed'
export const primaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full bg-button-gradient text-white font-heading font-semibold tracking-tight px-6 py-3 text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_30px_-10px_rgba(78,99,176,0.6)] transition duration-200 hover:brightness-110 active:scale-[0.985] disabled:opacity-60 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40'
export const outlineButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white text-brand-navy/80 font-body font-semibold text-sm px-4 py-2.5 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40'
export const lightButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full border border-white/40 text-white font-body font-semibold text-sm px-4 py-2.5 transition-colors hover:bg-white/10 disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
export const dangerButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full bg-rose-500 text-white font-heading font-semibold tracking-tight px-6 py-3 text-[15px] shadow-[0_12px_26px_-10px_rgba(244,63,94,0.55)] transition duration-200 hover:bg-rose-600 active:scale-[0.985] disabled:opacity-60 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/50'
export const noticeClass = {
  success: 'font-body text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2',
  error: 'font-body text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2'
}
export const chipBase = 'inline-flex items-center rounded-full text-[11px] font-semibold px-2.5 py-1'

export function statusChipClass(isActive) {
  return isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'
}
export function roleChipClass(role) {
  return role === 'admin' ? 'bg-brand-navy text-white' : 'bg-brand-navy/5 text-brand-navy/70'
}

// Same palette the user side uses for post statuses (see Account.vue).
export const POST_STATUSES = [
  { key: 'draft', label: 'Drafts', singular: 'Draft', classes: 'bg-gray-100 text-gray-600', bar: 'bg-gray-400' },
  { key: 'scheduled', label: 'Scheduled', singular: 'Scheduled', classes: 'bg-amber-50 text-amber-700', bar: 'bg-amber-400' },
  { key: 'published', label: 'Published', singular: 'Published', classes: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500' },
  { key: 'archived', label: 'Archived', singular: 'Archived', classes: 'bg-slate-100 text-slate-500', bar: 'bg-slate-400' },
  { key: 'failed', label: 'Failed', singular: 'Failed', classes: 'bg-rose-50 text-rose-600', bar: 'bg-rose-500' }
]

export function postStatusChipClass(status) {
  return POST_STATUSES.find((s) => s.key === status)?.classes ?? 'bg-gray-100 text-gray-600'
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------
export function fullName(person) {
  if (!person) return 'Unknown user'
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ')
  return name || String(person.email || '').split('@')[0] || 'Unknown user'
}

export function initialsOf(person) {
  if (!person) return '?'
  const letters = (
    String(person.firstName || '').charAt(0) + String(person.lastName || '').charAt(0)
  ).toUpperCase()
  return letters || String(person.email || '').charAt(0).toUpperCase() || '?'
}

export function plural(count, word) {
  return `${count} ${word}${Number(count) === 1 ? '' : 's'}`
}

// ---------------------------------------------------------------------------
// Dates (same formats as Account.vue)
// ---------------------------------------------------------------------------
export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${formatDate(iso)} | ${hours}:${minutes}${ampm}`
}

export function formatShortDateTime(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

export function localDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// "YYYY-MM-DD" strings (from <input type="date">) -> local-time Date bounds.
// `end` is exclusive (the start of the day after `to`).
export function rangeBounds(from, to) {
  const start = from ? new Date(`${from}T00:00:00`) : null
  let end = null
  if (to) {
    end = new Date(`${to}T00:00:00`)
    end.setDate(end.getDate() + 1)
  }
  return { start, end }
}

export function inRange(iso, start, end) {
  if (!start && !end) return true
  if (!iso) return false
  const time = new Date(iso).getTime()
  if (start && time < start.getTime()) return false
  if (end && time >= end.getTime()) return false
  return true
}

export function presetRange(preset) {
  const today = new Date()
  const to = localDateStr(today)
  if (preset === '7d') {
    const d = new Date(today)
    d.setDate(d.getDate() - 6)
    return { from: localDateStr(d), to }
  }
  if (preset === '30d') {
    const d = new Date(today)
    d.setDate(d.getDate() - 29)
    return { from: localDateStr(d), to }
  }
  if (preset === 'month') {
    return { from: localDateStr(new Date(today.getFullYear(), today.getMonth(), 1)), to }
  }
  return { from: '', to: '' } // all time
}

// ---------------------------------------------------------------------------
// Activity log wording
// ---------------------------------------------------------------------------
export const ACTIONS = {
  login: { label: 'Logged in', tone: 'bg-sky-50 text-sky-700' },
  signup: { label: 'Signed up', tone: 'bg-violet-50 text-violet-700' },
  post_created: { label: 'Created post', tone: 'bg-emerald-50 text-emerald-700' },
  post_updated: { label: 'Edited post', tone: 'bg-amber-50 text-amber-700' },
  post_status_changed: { label: 'Changed post status', tone: 'bg-indigo-50 text-indigo-700' },
  post_deleted: { label: 'Deleted post', tone: 'bg-rose-50 text-rose-600' },
  user_activated: { label: 'Activated user', tone: 'bg-emerald-50 text-emerald-700' },
  user_deactivated: { label: 'Deactivated user', tone: 'bg-rose-50 text-rose-600' }
}

export function actionLabel(action) {
  return ACTIONS[action]?.label ?? String(action || '')
}

export function actionTone(action) {
  return ACTIONS[action]?.tone ?? 'bg-gray-100 text-gray-600'
}

export function describeDetails(log) {
  const d = log?.details || {}
  switch (log?.action) {
    case 'post_created':
    case 'post_updated':
    case 'post_deleted':
      return d.title ? `“${d.title}”` : ''
    case 'post_status_changed':
      return `${d.title ? `“${d.title}”: ` : ''}${d.from ?? '?'} to ${d.to ?? '?'}`
    case 'user_activated':
    case 'user_deactivated':
      return d.name || d.email || ''
    default:
      return ''
  }
}
