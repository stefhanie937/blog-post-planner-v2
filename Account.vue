<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter, onBeforeRouteLeave } from 'vue-router'
import { User, Mail, Lock, Eye, EyeOff, Download, LogOut, LayoutGrid, Camera, Bell } from 'lucide-vue-next'
import AppShell from '../layouts/AppShell.vue'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../composables/useAuth'
import { usePosts } from '../composables/usePosts'
import { useReminders, LEAD_OPTIONS } from '../composables/useReminders'

const router = useRouter()
const { user, updateProfile, changePassword, signOut } = useAuth()
const { posts, loading, fetchPosts } = usePosts()
const { settings: reminderSettings, permission, supported, enableReminders, disableReminders, setLead, sendTest } =
  useReminders()

// ---------------------------------------------------------------------------
// Shared look (matches the rest of the app)
// ---------------------------------------------------------------------------
const cardClass = 'bg-white rounded-2xl shadow-[0_14px_32px_-14px_rgba(35,43,77,0.4)] animate-card-in'
const labelClass = 'block font-body text-[11px] font-semibold uppercase tracking-wider text-brand-navy/50 mb-1.5'
const inputClass =
  'w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-body text-brand-navy placeholder-brand-navy/35 outline-none focus:ring-2 focus:ring-brand-indigo/25 disabled:opacity-60 disabled:cursor-not-allowed'
const primaryButtonClass =
  'w-full flex items-center justify-center gap-2 rounded-full bg-button-gradient text-white font-heading font-semibold tracking-tight py-3 text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_30px_-10px_rgba(78,99,176,0.6)] transition duration-200 hover:brightness-110 active:scale-[0.985] disabled:opacity-60 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40'
const outlineButtonClass =
  'flex-1 flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white text-brand-navy/80 font-body font-semibold text-sm py-2.5 transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40'
const providerChipClass =
  'inline-flex items-center gap-1.5 rounded-full bg-brand-navy/5 text-brand-navy/70 text-[11px] font-medium px-2.5 py-1'
const noticeClass = {
  success: 'font-body text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2',
  error: 'font-body text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2'
}

// ---------------------------------------------------------------------------
// Notices (success ones fade away on their own)
// ---------------------------------------------------------------------------
const notices = reactive({ profile: null, password: null, export: null, avatar: null, reminders: null })
const noticeTimers = {}

function setNotice(key, type, text) {
  clearTimeout(noticeTimers[key])
  notices[key] = { type, text }
  if (type === 'success') {
    noticeTimers[key] = setTimeout(() => {
      notices[key] = null
    }, 4000)
  }
}

function clearNotice(key) {
  clearTimeout(noticeTimers[key])
  notices[key] = null
}

onUnmounted(() => {
  Object.values(noticeTimers).forEach((timer) => clearTimeout(timer))
})

// ---------------------------------------------------------------------------
// Who the user is
// ---------------------------------------------------------------------------
const meta = computed(() => user.value?.user_metadata ?? {})
const email = computed(() => user.value?.email ?? '')

function splitFullName(full) {
  const parts = String(full || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' }
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] }
}

// Email sign-ups store first_name / last_name; Google sign-ins store full_name.
const savedNames = computed(() => {
  const m = meta.value
  if (m.first_name !== undefined || m.last_name !== undefined) {
    return { first: String(m.first_name ?? ''), last: String(m.last_name ?? '') }
  }
  return splitFullName(m.full_name ?? m.name ?? '')
})

const displayName = computed(() => {
  const full = [savedNames.value.first, savedNames.value.last].filter(Boolean).join(' ')
  return full || email.value.split('@')[0] || 'Your account'
})

const initials = computed(() => {
  const letters = (savedNames.value.first.charAt(0) + savedNames.value.last.charAt(0)).toUpperCase()
  return letters || email.value.charAt(0).toUpperCase() || '?'
})

// ---------------------------------------------------------------------------
// Profile picture (upload / remove)
// ---------------------------------------------------------------------------
const AVATAR_BUCKET = 'avatars'
const AVATAR_SIZE = 400 // px, square
const AVATAR_MAX_BYTES = 5 * 1024 * 1024

// Shows the new picture right away, before the auth session catches up.
const avatarOverride = ref(undefined)
const avatarUrl = computed(() =>
  avatarOverride.value !== undefined ? avatarOverride.value : meta.value.avatar_url || meta.value.picture || ''
)
const avatarFailed = ref(false)
const showAvatar = computed(() => !!avatarUrl.value && !avatarFailed.value)
watch(avatarUrl, () => {
  avatarFailed.value = false
})

const avatarInput = ref(null)
const uploadingAvatar = ref(false)

// Returns the storage path if the URL points at our own avatars bucket (not a Google photo).
function ownedAvatarPath(url) {
  const marker = `/storage/v1/object/public/${AVATAR_BUCKET}/`
  const index = url ? url.indexOf(marker) : -1
  return index === -1 ? null : decodeURIComponent(url.slice(index + marker.length).split('?')[0])
}

const hasCustomAvatar = computed(() => !!ownedAvatarPath(avatarUrl.value))

// Center-crops to a square and shrinks it, so uploads stay small and fast.
function resizeToSquare(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = AVATAR_SIZE
      canvas.height = AVATAR_SIZE
      canvas
        .getContext('2d')
        .drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE)
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image."))),
        'image/jpeg',
        0.88
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("That file couldn't be read as an image."))
    }
    img.src = url
  })
}

async function onAvatarPicked(event) {
  const file = event.target.files?.[0]
  event.target.value = '' // lets the same file be picked again
  if (!file) return
  clearNotice('avatar')

  if (!file.type.startsWith('image/')) {
    setNotice('avatar', 'error', 'Please choose an image file (JPG, PNG or WebP).')
    return
  }
  if (file.size > AVATAR_MAX_BYTES) {
    setNotice('avatar', 'error', 'That image is over 5 MB. Please choose a smaller one.')
    return
  }

  uploadingAvatar.value = true
  try {
    const blob = await resizeToSquare(file)
    const path = `${user.value.id}/avatar-${Date.now()}.jpg`

    const { error: uploadError } = await supabase.storage
      .from(AVATAR_BUCKET)
      .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600' })
    if (uploadError) throw uploadError

    const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path)
    const previousPath = ownedAvatarPath(avatarUrl.value)

    const { error: metaError } = await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } })
    if (metaError) {
      await supabase.storage.from(AVATAR_BUCKET).remove([path])
      throw metaError
    }

    avatarOverride.value = data.publicUrl
    if (previousPath) supabase.storage.from(AVATAR_BUCKET).remove([previousPath]) // best-effort cleanup
    setNotice('avatar', 'success', 'Profile picture updated.')
  } catch (err) {
    setNotice('avatar', 'error', err.message || "Couldn't update your picture. Please try again.")
  } finally {
    uploadingAvatar.value = false
  }
}

async function removeAvatar() {
  const previousPath = ownedAvatarPath(avatarUrl.value)
  if (!previousPath) return
  clearNotice('avatar')

  uploadingAvatar.value = true
  try {
    const { error } = await supabase.auth.updateUser({ data: { avatar_url: null } })
    if (error) throw error

    // Google users fall back to their Google photo; everyone else goes back to initials.
    avatarOverride.value = meta.value.picture || ''
    supabase.storage.from(AVATAR_BUCKET).remove([previousPath])
    setNotice('avatar', 'success', 'Profile picture removed.')
  } catch (err) {
    setNotice('avatar', 'error', err.message || "Couldn't remove your picture. Please try again.")
  } finally {
    uploadingAvatar.value = false
  }
}

const providers = computed(() => {
  const list = user.value?.app_metadata?.providers
  if (Array.isArray(list) && list.length) return list
  const single = user.value?.app_metadata?.provider
  return single ? [single] : []
})
const hasPassword = computed(() => providers.value.includes('email'))
const usesGoogle = computed(() => providers.value.includes('google'))

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const date = new Date(iso)
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${formatDate(iso)} | ${hours}:${minutes}${ampm}`
}

function localDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// ---------------------------------------------------------------------------
// Post stats
// ---------------------------------------------------------------------------
const STATUS_TILES = [
  { key: 'draft', label: 'Drafts', classes: 'bg-gray-100 text-gray-600' },
  { key: 'scheduled', label: 'Scheduled', classes: 'bg-amber-50 text-amber-700' },
  { key: 'published', label: 'Published', classes: 'bg-emerald-50 text-emerald-700' },
  { key: 'archived', label: 'Archived', classes: 'bg-slate-100 text-slate-500' },
  { key: 'failed', label: 'Failed', classes: 'bg-rose-50 text-rose-600' }
]

const statsFailed = ref(false)

async function loadStats() {
  statsFailed.value = false
  const ok = await fetchPosts()
  statsFailed.value = ok === false
}

onMounted(loadStats)

const counts = computed(() => {
  const tally = { draft: 0, scheduled: 0, published: 0, archived: 0, failed: 0 }
  posts.value.forEach((post) => {
    if (tally[post.status] !== undefined) tally[post.status] += 1
  })
  return tally
})

const postsThisMonth = computed(() => {
  const now = new Date()
  return posts.value.filter((post) => {
    const created = new Date(post.createdAt)
    return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth()
  }).length
})

const topPlatform = computed(() => {
  const tally = {}
  posts.value.forEach((post) => {
    post.platforms.forEach((name) => {
      tally[name] = (tally[name] || 0) + 1
    })
  })
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1])
  return ranked.length ? { name: ranked[0][0], count: ranked[0][1] } : null
})

// ---------------------------------------------------------------------------
// Profile details (update)
// ---------------------------------------------------------------------------
const firstName = ref(savedNames.value.first)
const lastName = ref(savedNames.value.last)
const savingProfile = ref(false)

const profileDirty = computed(
  () =>
    firstName.value.trim() !== savedNames.value.first || lastName.value.trim() !== savedNames.value.last
)

async function saveProfile() {
  clearNotice('profile')
  const first = firstName.value.trim()
  const last = lastName.value.trim()

  if (!first) {
    setNotice('profile', 'error', 'Please enter your first name.')
    return
  }

  savingProfile.value = true
  try {
    await updateProfile({ firstName: first, lastName: last })
    firstName.value = first
    lastName.value = last
    setNotice('profile', 'success', 'Profile updated.')
  } catch (err) {
    setNotice('profile', 'error', err.message || "Couldn't update your profile. Please try again.")
  } finally {
    savingProfile.value = false
  }
}

// ---------------------------------------------------------------------------
// Password (update)
// ---------------------------------------------------------------------------
const MIN_PASSWORD = 6

const passwordFields = [
  { key: 'current', label: 'Current password', placeholder: 'Enter current password', autocomplete: 'current-password' },
  { key: 'next', label: 'New password', placeholder: 'Enter new password', autocomplete: 'new-password' },
  { key: 'confirm', label: 'Confirm new password', placeholder: 'Re-enter new password', autocomplete: 'new-password' }
]

const passwordForm = reactive({ current: '', next: '', confirm: '' })
const reveal = reactive({ current: false, next: false, confirm: false })
const savingPassword = ref(false)

const STRENGTH_LEVELS = [
  { label: 'Weak', bar: 'bg-rose-500', text: 'text-rose-500' },
  { label: 'Fair', bar: 'bg-amber-500', text: 'text-amber-600' },
  { label: 'Good', bar: 'bg-emerald-400', text: 'text-emerald-600' },
  { label: 'Strong', bar: 'bg-emerald-500', text: 'text-emerald-600' }
]

const strength = computed(() => {
  const value = passwordForm.next
  if (!value) return null

  let points = 0
  if (value.length >= 8) points += 1
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) points += 1
  if (/\d/.test(value)) points += 1
  if (/[^A-Za-z0-9]/.test(value)) points += 1

  const index = value.length < MIN_PASSWORD ? 0 : Math.min(Math.max(points - 1, 0), 3)
  return { ...STRENGTH_LEVELS[index], width: `${(index + 1) * 25}%` }
})

const passwordsMismatch = computed(() => !!passwordForm.confirm && passwordForm.next !== passwordForm.confirm)

const canSavePassword = computed(
  () => !!passwordForm.current && !!passwordForm.next && !!passwordForm.confirm && !savingPassword.value
)

async function savePassword() {
  clearNotice('password')

  if (!passwordForm.current) {
    setNotice('password', 'error', 'Enter your current password.')
    return
  }
  if (passwordForm.next.length < MIN_PASSWORD) {
    setNotice('password', 'error', `Your new password must be at least ${MIN_PASSWORD} characters.`)
    return
  }
  if (passwordForm.next === passwordForm.current) {
    setNotice('password', 'error', 'Your new password must be different from the current one.')
    return
  }
  if (passwordForm.next !== passwordForm.confirm) {
    setNotice('password', 'error', "Your new passwords don't match.")
    return
  }

  savingPassword.value = true
  try {
    await changePassword({ currentPassword: passwordForm.current, newPassword: passwordForm.next })
    passwordForm.current = ''
    passwordForm.next = ''
    passwordForm.confirm = ''
    reveal.current = false
    reveal.next = false
    reveal.confirm = false
    setNotice('password', 'success', 'Password updated.')
  } catch (err) {
    setNotice('password', 'error', err.message || "Couldn't update your password. Please try again.")
  } finally {
    savingPassword.value = false
  }
}

// ---------------------------------------------------------------------------
// Export (read)
// ---------------------------------------------------------------------------
const EXPORT_COLUMNS = [
  ['Title', (post) => post.title],
  ['Status', (post) => post.status],
  ['Platforms', (post) => post.platforms.join('; ')],
  ['Hashtags', (post) => post.hashtags.map((tag) => '#' + tag).join(' ')],
  ['Text', (post) => post.body],
  ['Image URLs', (post) => post.images.join('; ')],
  ['Scheduled for', (post) => post.scheduledFor ?? ''],
  ['Created at', (post) => post.createdAt ?? '']
]

function csvCell(value) {
  const text = String(value ?? '')
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function buildCsv(list) {
  const header = EXPORT_COLUMNS.map(([name]) => csvCell(name)).join(',')
  const rows = list.map((post) => EXPORT_COLUMNS.map(([, get]) => csvCell(get(post))).join(','))
  // The leading BOM makes Excel read the file as UTF-8.
  return '\ufeff' + [header, ...rows].join('\r\n')
}

function buildJson(list) {
  return JSON.stringify(
    list.map((post) => ({
      title: post.title,
      body: post.body,
      status: post.status,
      platforms: post.platforms,
      hashtags: post.hashtags,
      images: post.images,
      scheduledFor: post.scheduledFor ?? null,
      createdAt: post.createdAt ?? null
    })),
    null,
    2
  )
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function exportPosts(format) {
  clearNotice('export')
  if (!posts.value.length) {
    setNotice('export', 'error', 'There are no posts to export yet.')
    return
  }

  const stamp = localDateStr()
  if (format === 'csv') {
    downloadFile(`post-planner-posts-${stamp}.csv`, buildCsv(posts.value), 'text/csv;charset=utf-8')
  } else {
    downloadFile(`post-planner-posts-${stamp}.json`, buildJson(posts.value), 'application/json')
  }

  const total = posts.value.length
  setNotice('export', 'success', `Exported ${total} post${total === 1 ? '' : 's'}.`)
}

// ---------------------------------------------------------------------------
// Reminders for scheduled posts
// ---------------------------------------------------------------------------
const remindersOn = computed(() => reminderSettings.enabled && permission.value === 'granted')
const remindersBlocked = computed(() => permission.value === 'denied')

const upcomingPosts = computed(() => {
  const now = Date.now()
  return posts.value
    .filter((post) => post.status === 'scheduled' && post.scheduledFor && new Date(post.scheduledFor).getTime() >= now)
    .sort((a, b) => new Date(a.scheduledFor) - new Date(b.scheduledFor))
    .slice(0, 3)
})

async function toggleReminders() {
  clearNotice('reminders')

  if (remindersOn.value) {
    disableReminders()
    setNotice('reminders', 'success', 'Reminders turned off.')
    return
  }

  const result = await enableReminders()
  if (result === 'granted') {
    setNotice('reminders', 'success', 'Reminders are on.')
  } else if (result === 'denied') {
    setNotice('reminders', 'error', 'Notifications are blocked for this site. Allow them in your browser settings, then try again.')
  } else if (result === 'unsupported') {
    setNotice('reminders', 'error', "This browser doesn't support notifications.")
  } else {
    setNotice('reminders', 'error', 'Allow notifications when your browser asks, then try again.')
  }
}

async function testReminder() {
  clearNotice('reminders')
  const ok = await sendTest()
  if (!ok) setNotice('reminders', 'error', "Couldn't show a notification. Check your browser's notification settings.")
}

// ---------------------------------------------------------------------------
// Log out + unsaved-changes guard
// ---------------------------------------------------------------------------
const loggingOut = ref(false)
const logoutError = ref('')
let skipLeaveGuard = false

async function handleLogout() {
  loggingOut.value = true
  logoutError.value = ''
  try {
    await signOut()
    skipLeaveGuard = true
    router.push({ name: 'login' })
  } catch (err) {
    skipLeaveGuard = false
    logoutError.value = err.message || "Couldn't log out. Please try again."
  } finally {
    loggingOut.value = false
  }
}

onBeforeRouteLeave(() => {
  if (skipLeaveGuard || !profileDirty.value) return true
  return window.confirm('Discard your changes? They will be lost.')
})
</script>

<template>
  <AppShell title="Account">
    <div class="space-y-4 max-w-xl mx-auto w-full pb-2">
      <!-- Profile hero -->
      <section :class="[cardClass, 'overflow-hidden']">
        <div class="h-20 bg-button-gradient" />

        <div class="px-4 pb-5 -mt-10 flex flex-col items-center text-center">
          <div class="relative">
            <div
              class="w-20 h-20 rounded-full ring-4 ring-white shadow-lg overflow-hidden flex items-center justify-center bg-brand-navy text-white font-heading font-bold text-2xl select-none"
            >
              <img
                v-if="showAvatar"
                :src="avatarUrl"
                alt=""
                referrerpolicy="no-referrer"
                class="w-full h-full object-cover"
                @error="avatarFailed = true"
              />
              <span v-else>{{ initials }}</span>

              <div v-if="uploadingAvatar" class="absolute inset-0 flex items-center justify-center rounded-full bg-brand-navy/60">
                <span class="w-5 h-5 rounded-full border-2 border-white/40 border-t-white animate-spin" />
              </div>
            </div>

            <button
              type="button"
              :disabled="uploadingAvatar"
              aria-label="Change profile picture"
              class="absolute -bottom-0.5 -right-0.5 w-8 h-8 flex items-center justify-center rounded-full bg-white text-brand-navy shadow-md ring-2 ring-white transition hover:bg-gray-50 active:scale-95 disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-brand-indigo/40"
              @click="avatarInput.click()"
            >
              <Camera :size="15" />
            </button>
            <input
              ref="avatarInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="sr-only"
              tabindex="-1"
              @change="onAvatarPicked"
            />
          </div>

          <h2 class="font-heading font-bold text-brand-navy text-lg mt-3 break-words max-w-full">
            {{ displayName }}
          </h2>
          <p class="font-body text-sm text-brand-navy/60 break-all">{{ email }}</p>

          <button
            v-if="hasCustomAvatar"
            type="button"
            :disabled="uploadingAvatar"
            class="mt-2 font-body text-xs font-semibold text-brand-indigo hover:underline underline-offset-2 disabled:opacity-60 disabled:pointer-events-none"
            @click="removeAvatar"
          >
            Remove photo
          </button>

          <p
            v-if="notices.avatar"
            :role="notices.avatar.type === 'error' ? 'alert' : 'status'"
            :class="[noticeClass[notices.avatar.type], 'mt-3 max-w-full']"
          >
            {{ notices.avatar.text }}
          </p>

          <div class="flex flex-wrap justify-center gap-1.5 mt-3">
            <span v-if="usesGoogle" :class="providerChipClass">
              <svg class="w-3 h-3" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.66z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3a7.41 7.41 0 0 1-4.05 1.13c-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09A12 12 0 0 0 12 24z"/>
                <path fill="#FBBC05" d="M5.31 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.3a12 12 0 0 0 0 10.78l4.01-3.09z"/>
                <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.3 6.61l4.01 3.09C6.25 6.86 8.89 4.75 12 4.75z"/>
              </svg>
              Google
            </span>
            <span v-if="hasPassword" :class="providerChipClass">
              <Mail :size="12" />
              Email &amp; password
            </span>
          </div>
        </div>

        <div class="grid grid-cols-2 border-t border-gray-100">
          <div class="px-4 py-3">
            <p :class="labelClass">Member since</p>
            <p class="font-body text-sm text-brand-navy">{{ formatDate(user?.created_at) }}</p>
          </div>
          <div class="px-4 py-3 border-l border-gray-100">
            <p :class="labelClass">Last sign-in</p>
            <p class="font-body text-sm text-brand-navy">{{ formatDateTime(user?.last_sign_in_at) }}</p>
          </div>
        </div>
      </section>

      <!-- Post stats -->
      <section :class="cardClass" :style="{ animationDelay: '60ms' }">
        <div class="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <span class="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-brand-navy/5 text-brand-navy">
            <LayoutGrid :size="16" />
          </span>
          <h3 class="font-heading font-bold text-brand-navy text-sm flex-1">Your posts</h3>
          <router-link
            :to="{ name: 'dashboard' }"
            class="font-body text-xs font-semibold text-brand-indigo hover:underline underline-offset-2"
          >
            View all
          </router-link>
        </div>

        <div class="p-4">
          <div v-if="loading" class="grid grid-cols-3 gap-2">
            <div v-for="n in 6" :key="n" class="h-16 rounded-xl bg-gray-100 animate-pulse" />
          </div>

          <div v-else-if="statsFailed && posts.length === 0" class="text-center py-4">
            <p class="font-body text-sm text-brand-navy/70">Couldn't load your post stats.</p>
            <button
              type="button"
              class="mt-3 px-4 py-1.5 rounded-full text-xs font-semibold border border-gray-200 text-brand-navy/70 transition-colors hover:bg-gray-50"
              @click="loadStats"
            >
              Retry
            </button>
          </div>

          <template v-else>
            <div class="grid grid-cols-3 gap-2">
              <div class="rounded-xl p-3 text-center bg-brand-navy text-white">
                <p class="font-heading font-bold text-xl leading-none">{{ posts.length }}</p>
                <p class="font-body text-[11px] font-semibold mt-1.5 text-white/80">Total</p>
              </div>
              <div
                v-for="tile in STATUS_TILES"
                :key="tile.key"
                class="rounded-xl p-3 text-center"
                :class="tile.classes"
              >
                <p class="font-heading font-bold text-xl leading-none">{{ counts[tile.key] }}</p>
                <p class="font-body text-[11px] font-semibold mt-1.5">{{ tile.label }}</p>
              </div>
            </div>

            <dl class="mt-4 space-y-2">
              <div class="flex items-center justify-between gap-3">
                <dt class="font-body text-sm text-brand-navy/60">Created this month</dt>
                <dd class="font-body text-sm font-semibold text-brand-navy">{{ postsThisMonth }}</dd>
              </div>
              <div class="flex items-center justify-between gap-3">
                <dt class="font-body text-sm text-brand-navy/60">Most used platform</dt>
                <dd class="font-body text-sm font-semibold text-brand-navy text-right">
                  <template v-if="topPlatform">
                    {{ topPlatform.name }}
                    <span class="font-normal text-brand-navy/50">
                      · {{ topPlatform.count }} post{{ topPlatform.count === 1 ? '' : 's' }}
                    </span>
                  </template>
                  <span v-else class="font-normal text-brand-navy/50">None yet</span>
                </dd>
              </div>
            </dl>
          </template>
        </div>
      </section>

      <!-- Profile details -->
      <section :class="cardClass" :style="{ animationDelay: '120ms' }">
        <div class="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <span class="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-brand-navy/5 text-brand-navy">
            <User :size="16" />
          </span>
          <h3 class="font-heading font-bold text-brand-navy text-sm flex-1">Profile details</h3>
        </div>

        <form class="p-4 space-y-4" novalidate @submit.prevent="saveProfile">
          <div class="grid grid-cols-2 gap-3">
            <div class="min-w-0">
              <label for="account-first-name" :class="labelClass">First name</label>
              <input
                id="account-first-name"
                v-model="firstName"
                type="text"
                maxlength="50"
                autocomplete="given-name"
                placeholder="First name"
                :class="inputClass"
              />
            </div>
            <div class="min-w-0">
              <label for="account-last-name" :class="labelClass">Last name</label>
              <input
                id="account-last-name"
                v-model="lastName"
                type="text"
                maxlength="50"
                autocomplete="family-name"
                placeholder="Last name"
                :class="inputClass"
              />
            </div>
          </div>

          <div>
            <label for="account-email" :class="labelClass">Email</label>
            <div class="relative">
              <input
                id="account-email"
                :value="email"
                type="email"
                readonly
                disabled
                autocomplete="email"
                :class="[inputClass, 'pr-10']"
              />
              <Lock :size="14" class="absolute right-4 top-1/2 -translate-y-1/2 text-brand-navy/30" />
            </div>
            <p class="font-body text-xs text-brand-navy/50 mt-1.5">
              Your email is how you sign in, so it can't be changed here.
            </p>
          </div>

          <p
            v-if="notices.profile"
            :role="notices.profile.type === 'error' ? 'alert' : 'status'"
            :class="noticeClass[notices.profile.type]"
          >
            {{ notices.profile.text }}
          </p>

          <button type="submit" :disabled="!profileDirty || savingProfile" :class="primaryButtonClass">
            <span
              v-if="savingProfile"
              class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
            />
            {{ savingProfile ? 'Saving...' : 'Save Changes' }}
          </button>
        </form>
      </section>

      <!-- Reminders -->
      <section :class="cardClass" :style="{ animationDelay: '150ms' }">
        <div class="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <span class="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-brand-navy/5 text-brand-navy">
            <Bell :size="16" />
          </span>
          <h3 class="font-heading font-bold text-brand-navy text-sm flex-1">Reminders</h3>
        </div>

        <div class="p-4 space-y-4">
          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <p class="font-body text-sm font-semibold text-brand-navy">Remind me about scheduled posts</p>
              <p class="font-body text-xs text-brand-navy/50 mt-0.5">
                You'll get a notification while Post Planner is open in your browser.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="remindersOn"
              aria-label="Remind me about scheduled posts"
              :disabled="!supported"
              class="relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40"
              :class="remindersOn ? 'bg-brand-indigo' : 'bg-gray-300'"
              @click="toggleReminders"
            >
              <span
                class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200"
                :class="remindersOn ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>

          <div>
            <label for="account-reminder-lead" :class="labelClass">Remind me</label>
            <select
              id="account-reminder-lead"
              :value="reminderSettings.leadMinutes"
              :disabled="!remindersOn"
              :class="inputClass"
              @change="setLead($event.target.value)"
            >
              <option v-for="option in LEAD_OPTIONS" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>

          <p v-if="remindersBlocked" class="font-body text-xs text-rose-600">
            Notifications are blocked for this site. Allow them in your browser settings to use reminders.
          </p>
          <p v-else-if="!supported" class="font-body text-xs text-brand-navy/60">
            This browser doesn't support notifications.
          </p>

          <div v-if="remindersOn">
            <p :class="labelClass">Up next</p>
            <ul v-if="upcomingPosts.length" class="space-y-2">
              <li
                v-for="post in upcomingPosts"
                :key="post.id"
                class="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-2"
              >
                <span class="font-body text-sm font-semibold text-amber-800 truncate">
                  {{ post.title || 'Untitled post' }}
                </span>
                <span class="font-body text-xs text-amber-700 shrink-0">{{ formatDateTime(post.scheduledFor) }}</span>
              </li>
            </ul>
            <p v-else class="font-body text-sm text-brand-navy/50">No upcoming scheduled posts.</p>
          </div>

          <p
            v-if="notices.reminders"
            :role="notices.reminders.type === 'error' ? 'alert' : 'status'"
            :class="noticeClass[notices.reminders.type]"
          >
            {{ notices.reminders.text }}
          </p>

          <button v-if="remindersOn" type="button" :class="outlineButtonClass" @click="testReminder">
            <Bell :size="16" />
            Send a test notification
          </button>
        </div>
      </section>

      <!-- Password -->
      <section :class="cardClass" :style="{ animationDelay: '180ms' }">
        <div class="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <span class="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-brand-navy/5 text-brand-navy">
            <Lock :size="16" />
          </span>
          <h3 class="font-heading font-bold text-brand-navy text-sm flex-1">Password</h3>
        </div>

        <form v-if="hasPassword" class="p-4 space-y-4" novalidate @submit.prevent="savePassword">
          <!-- Lets password managers attach the new password to the right account -->
          <input
            type="text"
            :value="email"
            autocomplete="username"
            readonly
            tabindex="-1"
            aria-hidden="true"
            class="sr-only"
          />

          <div v-for="field in passwordFields" :key="field.key">
            <label :for="`account-password-${field.key}`" :class="labelClass">{{ field.label }}</label>
            <div class="relative">
              <input
                :id="`account-password-${field.key}`"
                v-model="passwordForm[field.key]"
                :type="reveal[field.key] ? 'text' : 'password'"
                :autocomplete="field.autocomplete"
                :placeholder="field.placeholder"
                :class="[inputClass, 'pr-11']"
              />
              <button
                type="button"
                :aria-label="reveal[field.key] ? `Hide ${field.label.toLowerCase()}` : `Show ${field.label.toLowerCase()}`"
                class="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-brand-navy/40 transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40"
                @click="reveal[field.key] = !reveal[field.key]"
              >
                <EyeOff v-if="reveal[field.key]" :size="18" />
                <Eye v-else :size="18" />
              </button>
            </div>

            <div v-if="field.key === 'next' && strength" class="mt-2">
              <div class="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300"
                  :class="strength.bar"
                  :style="{ width: strength.width }"
                />
              </div>
              <p class="font-body text-xs mt-1" :class="strength.text">
                {{ strength.label }}
                <span class="text-brand-navy/50">· use 8+ characters with upper and lowercase letters, numbers, or symbols</span>
              </p>
            </div>

            <p v-if="field.key === 'confirm' && passwordsMismatch" class="font-body text-xs text-rose-500 mt-1.5">
              Passwords don't match yet.
            </p>
          </div>

          <p
            v-if="notices.password"
            :role="notices.password.type === 'error' ? 'alert' : 'status'"
            :class="noticeClass[notices.password.type]"
          >
            {{ notices.password.text }}
          </p>

          <button type="submit" :disabled="!canSavePassword" :class="primaryButtonClass">
            <span
              v-if="savingPassword"
              class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
            />
            {{ savingPassword ? 'Updating...' : 'Update Password' }}
          </button>
        </form>

        <div v-else class="p-4">
          <div class="flex items-start gap-3 rounded-xl bg-gray-50 p-4">
            <span class="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-white shadow-sm">
              <svg class="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.66z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3a7.41 7.41 0 0 1-4.05 1.13c-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09A12 12 0 0 0 12 24z"/>
                <path fill="#FBBC05" d="M5.31 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.3a12 12 0 0 0 0 10.78l4.01-3.09z"/>
                <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.3 6.61l4.01 3.09C6.25 6.86 8.89 4.75 12 4.75z"/>
              </svg>
            </span>
            <p class="font-body text-sm text-brand-navy/80">
              You signed in with Google, so your password is managed by your Google account. There's nothing to
              change here.
            </p>
          </div>
        </div>
      </section>

      <!-- Your data -->
      <section :class="cardClass" :style="{ animationDelay: '240ms' }">
        <div class="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
          <span class="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-brand-navy/5 text-brand-navy">
            <Download :size="16" />
          </span>
          <h3 class="font-heading font-bold text-brand-navy text-sm flex-1">Your data</h3>
        </div>

        <div class="p-4 space-y-3">
          <p class="font-body text-sm text-brand-navy/70">
            Download a copy of all your posts, including drafts and archived ones.
          </p>

          <div class="flex gap-2">
            <button
              type="button"
              :disabled="loading || posts.length === 0"
              :class="outlineButtonClass"
              @click="exportPosts('csv')"
            >
              <Download :size="16" />
              CSV
            </button>
            <button
              type="button"
              :disabled="loading || posts.length === 0"
              :class="outlineButtonClass"
              @click="exportPosts('json')"
            >
              <Download :size="16" />
              JSON
            </button>
          </div>

          <p
            v-if="notices.export"
            :role="notices.export.type === 'error' ? 'alert' : 'status'"
            :class="noticeClass[notices.export.type]"
          >
            {{ notices.export.text }}
          </p>
        </div>
      </section>

      <!-- Log out -->
      <div class="pt-2 space-y-3">
        <p
          v-if="logoutError"
          role="alert"
          class="font-body text-sm text-rose-50 bg-rose-500/15 border border-rose-400/30 rounded-lg px-3 py-2 text-center"
        >
          {{ logoutError }}
        </p>

        <button
          type="button"
          :disabled="loggingOut"
          class="w-full flex items-center justify-center gap-2 rounded-full border border-white/40 text-white font-body font-semibold text-sm py-3 transition-colors hover:bg-white/10 disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
          @click="handleLogout"
        >
          <span
            v-if="loggingOut"
            class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
          />
          <LogOut v-else :size="16" />
          {{ loggingOut ? 'Logging out...' : 'Log Out' }}
        </button>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
/* Hide Edge's built-in reveal button so only our own eye icon shows. */
input[type='password']::-ms-reveal,
input[type='password']::-ms-clear {
  display: none;
}
</style>