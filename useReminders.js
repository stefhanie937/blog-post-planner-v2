import { reactive, ref } from 'vue'
import { useAuth } from './useAuth'
import { usePosts } from './usePosts'

// How long before the scheduled time the reminder fires (minutes).
export const LEAD_OPTIONS = [
  { value: 0, label: 'At the scheduled time' },
  { value: 15, label: '15 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 1440, label: '1 day before' }
]

const CHECK_EVERY_MS = 30 * 1000
const REFRESH_EVERY_MS = 10 * 60 * 1000
// A reminder is skipped if the post is already this far past its time.
const GRACE_MS = 15 * 60 * 1000

const supported = typeof window !== 'undefined' && 'Notification' in window

// Shared state, so the Account page and the background checker see the same values.
const settings = reactive({ enabled: false, leadMinutes: 15 })
const permission = ref(supported ? Notification.permission : 'unsupported')

let loadedFor = null
let sent = {} // { "postId|scheduledFor|lead": scheduledTimestamp }
let timer = null
let lastRefresh = 0

const { user } = useAuth()
const { posts, fetchPosts } = usePosts()

const settingsKey = (id) => `pp:reminders:${id}`
const sentKey = (id) => `pp:reminders:sent:${id}`

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage full or blocked: reminders just won't persist */
  }
}

// Settings are stored per user, per device (notification permission is per device too).
function ensureLoaded() {
  const id = user.value?.id
  if (!id || loadedFor === id) return !!id

  const saved = readJson(settingsKey(id), {})
  settings.enabled = !!saved.enabled
  settings.leadMinutes = LEAD_OPTIONS.some((o) => o.value === saved.leadMinutes) ? saved.leadMinutes : 15
  sent = readJson(sentKey(id), {})
  loadedFor = id
  return true
}

function saveSettings() {
  const id = user.value?.id
  if (id) writeJson(settingsKey(id), { enabled: settings.enabled, leadMinutes: settings.leadMinutes })
}

function formatWhen(ms) {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

async function showNotification(title, options) {
  if (!supported || Notification.permission !== 'granted') return false
  try {
    // Mobile Chrome only allows notifications through a service worker, when one exists.
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg) await reg.showNotification(title, options)
    else new Notification(title, options)
    return true
  } catch {
    return false
  }
}

async function tick() {
  if (!ensureLoaded()) return

  // Keep the post list reasonably fresh.
  if (Date.now() - lastRefresh > REFRESH_EVERY_MS) {
    lastRefresh = Date.now()
    await fetchPosts()
  }

  permission.value = supported ? Notification.permission : 'unsupported'
  if (!settings.enabled || permission.value !== 'granted') return

  const now = Date.now()
  const lead = settings.leadMinutes * 60 * 1000
  let changed = false

  for (const post of posts.value) {
    if (post.status !== 'scheduled' || !post.scheduledFor) continue
    const due = new Date(post.scheduledFor).getTime()
    if (Number.isNaN(due)) continue
    if (now < due - lead || now > due + GRACE_MS) continue

    const key = `${post.id}|${post.scheduledFor}|${settings.leadMinutes}`
    if (sent[key]) continue

    sent[key] = due
    changed = true
    showNotification('Post reminder', {
      body: `"${post.title || 'Untitled post'}" is scheduled for ${formatWhen(due)}.`,
      tag: `post-${post.id}`
    })
  }

  if (changed) {
    // Drop entries for posts that were due more than a day ago.
    Object.keys(sent).forEach((key) => {
      if (sent[key] < now - 24 * 60 * 60 * 1000) delete sent[key]
    })
    writeJson(sentKey(user.value.id), sent)
  }
}

// Call once from App.vue. Safe to call more than once.
export function startReminders() {
  if (timer) return
  tick()
  timer = setInterval(tick, CHECK_EVERY_MS)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick()
  })
}

export function useReminders() {
  ensureLoaded()

  // Resolves to 'granted', 'denied', 'default' or 'unsupported'.
  async function enableReminders() {
    if (!supported) return 'unsupported'
    let result = Notification.permission
    if (result === 'default') result = await Notification.requestPermission()
    permission.value = result
    if (result === 'granted') {
      settings.enabled = true
      saveSettings()
      tick()
    }
    return result
  }

  function disableReminders() {
    settings.enabled = false
    saveSettings()
  }

  function setLead(minutes) {
    settings.leadMinutes = Number(minutes)
    saveSettings()
  }

  function sendTest() {
    return showNotification('Post Planner', { body: 'Reminders are working. You will be notified before your posts go out.' })
  }

  return { settings, permission, supported, enableReminders, disableReminders, setLead, sendTest }
}
