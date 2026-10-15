<script setup>
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter, onBeforeRouteLeave } from 'vue-router'
import {
  ChevronDown,
  Image as ImageIcon,
  Camera,
  Hash,
  X,
  CheckCircle2
} from 'lucide-vue-next'
import AppShell from '../layouts/AppShell.vue'
import { usePosts, storagePathFromUrl } from '../composables/usePosts'
import { useAuth } from '../composables/useAuth'
import { supabase } from '../lib/supabaseClient'

const route = useRoute()
const router = useRouter()
const { posts, fetchPosts, addPost, updatePost } = usePosts()
const { user } = useAuth()

// ---------------------------------------------------------------------------
// Edit mode (route: /composer/:id)
// ---------------------------------------------------------------------------
const editId = computed(() => route.params.id || null)
const isEditing = computed(() => !!editId.value)
const initializing = ref(isEditing.value)
const editError = ref('')
const originalStatus = ref('')
const originalStatusLabel = computed(() =>
  originalStatus.value ? originalStatus.value.charAt(0).toUpperCase() + originalStatus.value.slice(1) : ''
)

// ---------------------------------------------------------------------------
// Step 1: platforms
// ---------------------------------------------------------------------------
const platformOptions = ['TikTok', 'Instagram', 'Facebook', 'Twitter']
// TikTok: 2,200 is the safe ceiling (some sources say the in-app limit is 4,000).
const platformLimits = { TikTok: 2200, Instagram: 2200, Facebook: 63206, Twitter: 280 }
// Posts saved before the rename used this name.
const LEGACY_PLATFORM_NAMES = { 'X (Twitter)': 'Twitter' }
const platforms = ref([])

function togglePlatform(platform) {
  platforms.value = platforms.value.includes(platform)
    ? platforms.value.filter((p) => p !== platform)
    : [...platforms.value, platform]
}

// ---------------------------------------------------------------------------
// Step 2: content
// ---------------------------------------------------------------------------
const MAX_IMAGES = 4
const MAX_IMAGE_MB = 10

const title = ref('')
const body = ref('')
const images = ref([]) // { url, path, isNew }
const uploading = ref(false)
const uploadingCount = ref(0)
const uploadError = ref('')
const hashtags = ref([])
const hashtagInput = ref('')
const showHashtagInput = ref(false)
const hashtagInputEl = ref(null)
const galleryInput = ref(null)
const cameraInput = ref(null)

// Existing photos removed while editing are only deleted from storage once the
// changes are saved, so cancelling an edit never breaks the original post.
let removedExisting = []

// Platforms count the whole post (text + hashtags), so the counter does too.
// This matches what "Copy post text" produces on the Posts page.
const hashtagText = computed(() => hashtags.value.map((t) => '#' + t).join(' '))
const charCount = computed(() => body.value.length + (hashtagText.value ? 2 + hashtagText.value.length : 0))

const effectiveLimit = computed(() => {
  const limits = platforms.value.map((p) => platformLimits[p]).filter(Number.isFinite)
  return limits.length ? Math.min(...limits) : null
})
const overLimit = computed(() => effectiveLimit.value !== null && charCount.value > effectiveLimit.value)
const nearLimit = computed(
  () => effectiveLimit.value !== null && !overLimit.value && charCount.value >= effectiveLimit.value * 0.9
)

async function uploadOne(file) {
  if (!file.type.startsWith('image/')) return { error: `${file.name} isn't an image.` }
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
    return { error: `${file.name} is larger than ${MAX_IMAGE_MB} MB.` }
  }

  // Storage keys must be plain ASCII, so never reuse the original file name.
  const rawExt = file.name.includes('.') ? file.name.split('.').pop() : file.type.split('/')[1] || 'jpg'
  const ext = rawExt.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const path = `${user.value.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  try {
    const { error } = await supabase.storage.from('post-images').upload(path, file)
    if (error) return { error: `Couldn't upload ${file.name}: ${error.message}` }
  } catch {
    return { error: `Couldn't upload ${file.name}. Check your connection and try again.` }
  }

  const { data } = supabase.storage.from('post-images').getPublicUrl(path)
  return { image: { url: data.publicUrl, path, isNew: true } }
}

async function onFilesSelected(event) {
  const files = Array.from(event.target.files || [])
  event.target.value = ''
  if (!files.length) return

  if (!user.value) {
    uploadError.value = 'Please log in again to upload images.'
    return
  }

  const room = Math.max(0, MAX_IMAGES - images.value.length)
  const toUpload = files.slice(0, room)
  const messages = []
  if (files.length > room) messages.push(`You can add up to ${MAX_IMAGES} images per post.`)

  if (!toUpload.length) {
    uploadError.value = messages.join(' ')
    return
  }

  uploading.value = true
  uploadingCount.value = toUpload.length
  uploadError.value = ''

  try {
    const results = await Promise.all(toUpload.map(uploadOne))
    results.forEach((result) => {
      if (result.image) images.value.push(result.image)
      else messages.push(result.error)
    })
  } finally {
    uploadingCount.value = 0
    uploading.value = false
    uploadError.value = messages.join(' ')
  }
}

async function removeImage(index) {
  const [removed] = images.value.splice(index, 1)
  uploadError.value = ''
  if (!removed?.path) return

  if (!removed.isNew) {
    // Belongs to the saved post: delete only after the edit is saved.
    removedExisting.push(removed.path)
    return
  }

  const { error } = await supabase.storage.from('post-images').remove([removed.path])
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[Composer] failed to delete image from storage:', error.message)
  }
}

// Photos uploaded in this session for a post that never got saved would
// otherwise sit in storage forever. Photos of the saved post are never touched.
function discardUploads() {
  const paths = images.value.filter((image) => image.isNew && image.path).map((image) => image.path)
  if (paths.length) {
    supabase.storage
      .from('post-images')
      .remove(paths)
      .catch(() => {})
  }
}

async function toggleHashtagInput() {
  showHashtagInput.value = !showHashtagInput.value
  if (showHashtagInput.value) {
    await nextTick()
    // Inside the v-for this ref is an array; handle both shapes.
    const el = Array.isArray(hashtagInputEl.value) ? hashtagInputEl.value[0] : hashtagInputEl.value
    el?.focus()
  }
}

function addHashtagsFromInput() {
  const parts = hashtagInput.value
    .split(/[\s,#]+/)
    .map((tag) => tag.replace(/[^\p{L}\p{N}_]/gu, ''))
    .filter(Boolean)

  for (const tag of parts) {
    const exists = hashtags.value.some((existing) => existing.toLowerCase() === tag.toLowerCase())
    if (!exists) hashtags.value.push(tag)
  }
  hashtagInput.value = ''
}

function onHashtagKeydown(event) {
  if (event.isComposing) return
  if (event.key === 'Enter' || event.key === ',' || event.key === ' ') {
    event.preventDefault()
    addHashtagsFromInput()
  }
}

function removeHashtag(tag) {
  hashtags.value = hashtags.value.filter((t) => t !== tag)
}

// ---------------------------------------------------------------------------
// Step 3: schedule
// ---------------------------------------------------------------------------
const scheduleMode = ref('now')
const scheduleDate = ref('')
const scheduleTime = ref('')

// Local date (not UTC) so "today" is correct for the user's timezone.
function localDateStr(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
const todayStr = localDateStr()

const scheduledAt = computed(() => {
  if (!scheduleDate.value || !scheduleTime.value) return null
  return new Date(`${scheduleDate.value}T${scheduleTime.value}`)
})

const scheduleSummary = computed(() => {
  if (!scheduledAt.value) return 'Pick a date and time above.'
  const dt = scheduledAt.value
  return `Scheduled for ${dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} at ${dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
})

// ---------------------------------------------------------------------------
// Steps / accordion
// ---------------------------------------------------------------------------
const steps = [
  { id: 1, title: 'Choose Platforms' },
  { id: 2, title: 'Add Post Content' },
  { id: 3, title: 'Schedule' },
  { id: 4, title: 'Review & Save' }
]
const openStep = ref(2)

function toggleStep(id) {
  openStep.value = openStep.value === id ? null : id
}

const step1Complete = computed(() => platforms.value.length > 0)
const step2Complete = computed(() => !!title.value.trim() && !!body.value.trim())
const step3Complete = computed(
  () => scheduleMode.value === 'now' || (!!scheduleDate.value && !!scheduleTime.value)
)

function isStepComplete(id) {
  if (id === 1) return step1Complete.value
  if (id === 2) return step2Complete.value
  if (id === 3) return step3Complete.value
  return false
}

// ---------------------------------------------------------------------------
// Unsaved-changes tracking
// ---------------------------------------------------------------------------
function currentSnapshot() {
  return JSON.stringify([
    title.value,
    body.value,
    hashtags.value,
    platforms.value,
    images.value.map((image) => image.url),
    scheduleMode.value,
    scheduleDate.value,
    scheduleTime.value
  ])
}

// For a new post this is the empty form; for an edit it's set after loading.
let initialSnapshot = currentSnapshot()

function isDirty() {
  return !initializing.value && currentSnapshot() !== initialSnapshot
}

// ---------------------------------------------------------------------------
// Load an existing post (edit mode)
// ---------------------------------------------------------------------------
async function loadPostForEditing() {
  initializing.value = true
  const loaded = await fetchPosts()

  const post = posts.value.find((p) => p.id === editId.value)
  if (!post) {
    editError.value =
      loaded === false
        ? "We couldn't load this post. Check your connection and try again."
        : "We couldn't find that post. It may have been deleted."
    initializing.value = false
    return
  }

  title.value = post.title
  body.value = post.body
  hashtags.value = [...post.hashtags]
  platforms.value = post.platforms.map((p) => LEGACY_PLATFORM_NAMES[p] ?? p)
  images.value = post.images.map((url) => ({ url, path: storagePathFromUrl(url), isNew: false }))
  originalStatus.value = post.status

  if (post.status === 'scheduled' && post.scheduledFor) {
    const date = new Date(post.scheduledFor)
    scheduleMode.value = 'later'
    scheduleDate.value = localDateStr(date)
    scheduleTime.value = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }

  initialSnapshot = currentSnapshot()
  initializing.value = false
}

// ---------------------------------------------------------------------------
// Save / cancel
// ---------------------------------------------------------------------------
const saving = ref(false)
const justSaved = ref(false)
const formNotice = ref('')
const successNotice = ref('')

const primaryLabel = computed(() => (scheduleMode.value === 'later' ? 'Schedule Post' : 'Post Now'))

// A warning like "Select at least one platform" should disappear once it's fixed.
watch([title, body, platforms, scheduleMode, scheduleDate, scheduleTime], () => {
  formNotice.value = ''
})

// After editing, go back to the list the user came from (Drafts, History, ...).
function returnToList() {
  const back = window.history.state?.back
  const target =
    typeof back === 'string' && back.startsWith('/') && !back.startsWith('/composer')
      ? back
      : { name: 'dashboard' }
  router.push(target)
}

async function commitPost(status) {
  saving.value = true
  formNotice.value = ''

  const payload = {
    title: title.value.trim(),
    body: body.value.trim(),
    hashtags: [...hashtags.value],
    images: images.value.map((img) => img.url),
    platforms: [...platforms.value],
    status,
    // ISO string carries the timezone, so the saved time matches what the user picked.
    scheduledFor: status === 'scheduled' ? scheduledAt.value.toISOString() : null
  }

  try {
    if (isEditing.value) {
      await updatePost(editId.value, payload)
      if (removedExisting.length) {
        supabase.storage
          .from('post-images')
          .remove(removedExisting)
          .catch(() => {})
        removedExisting = []
      }
    } else {
      await addPost(payload)
    }

    successNotice.value = isEditing.value
      ? 'Changes saved.'
      : status === 'draft'
        ? 'Saved as draft.'
        : status === 'scheduled'
          ? 'Post scheduled.'
          : 'Post marked as published.'
    justSaved.value = true
    setTimeout(() => (isEditing.value ? returnToList() : router.push({ name: 'dashboard' })), 900)
  } catch (err) {
    formNotice.value = err.message || 'Something went wrong saving this post. Please try again.'
  } finally {
    saving.value = false
  }
}

onBeforeRouteLeave(() => {
  if (justSaved.value || !isDirty()) return true
  const leave = window.confirm('Discard your changes? They will be lost.')
  if (leave) discardUploads()
  return leave
})

// Also warn when the whole tab is closed or refreshed with unsaved work.
function onBeforeUnload(event) {
  if (justSaved.value || !isDirty()) return
  event.preventDefault()
  event.returnValue = ''
}

onMounted(() => {
  window.addEventListener('beforeunload', onBeforeUnload)
  if (isEditing.value) loadPostForEditing()
})
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

function handleSaveDraft() {
  if (!title.value.trim() && !body.value.trim()) {
    formNotice.value = 'Add a title or some text before saving.'
    openStep.value = 2
    return
  }
  commitPost('draft')
}

function handlePrimarySave() {
  if (!title.value.trim() || !body.value.trim()) {
    formNotice.value = 'Add both a title and post text to continue.'
    openStep.value = 2
    return
  }
  if (platforms.value.length === 0) {
    formNotice.value = 'Select at least one platform to post to.'
    openStep.value = 1
    return
  }
  if (overLimit.value) {
    formNotice.value = 'Your post (text plus hashtags) is over the limit for a selected platform.'
    openStep.value = 2
    return
  }
  if (scheduleMode.value === 'later') {
    if (!scheduledAt.value) {
      formNotice.value = 'Pick a date and time to schedule this post.'
      openStep.value = 3
      return
    }
    if (scheduledAt.value <= new Date()) {
      formNotice.value = 'Pick a date and time in the future.'
      openStep.value = 3
      return
    }
  }
  commitPost(scheduleMode.value === 'later' ? 'scheduled' : 'published')
}

function handleCancel() {
  if (isEditing.value) returnToList()
  else router.push({ name: 'dashboard' })
}
</script>

<template>
  <AppShell :title="isEditing ? 'Edit Post' : 'Posts Composer'">
    <!-- Loading the post being edited -->
    <div v-if="initializing" class="space-y-4">
      <div v-for="n in 3" :key="n" class="h-14 rounded-2xl bg-white/20 animate-pulse" />
    </div>

    <!-- Post not found -->
    <div
      v-else-if="editError"
      class="bg-white/95 rounded-2xl px-6 py-10 text-center shadow-[0_10px_28px_-10px_rgba(35,43,77,0.35)]"
    >
      <p class="font-heading font-bold text-brand-navy text-base">Post not found</p>
      <p class="font-body text-sm text-brand-navy/60 mt-1">{{ editError }}</p>
      <router-link
        :to="{ name: 'dashboard' }"
        class="inline-block mt-4 px-4 py-1.5 rounded-full text-xs font-semibold border border-gray-200 text-brand-navy/70 transition-colors hover:bg-gray-50"
      >
        Back to Posts
      </router-link>
    </div>

    <template v-else>
      <p
        v-if="isEditing"
        class="inline-block mb-4 rounded-full bg-white/15 border border-white/25 px-3 py-1 font-body text-xs text-white/90"
      >
        Editing this post · currently {{ originalStatusLabel }}
      </p>

      <div class="space-y-4">
        <div
          v-for="step in steps"
          :key="step.id"
          class="bg-white rounded-2xl shadow-[0_14px_32px_-14px_rgba(35,43,77,0.4)] overflow-hidden"
        >
          <button
            type="button"
            class="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            @click="toggleStep(step.id)"
          >
            <span
              class="w-6 h-6 shrink-0 flex items-center justify-center rounded-full text-xs font-bold"
              :class="isStepComplete(step.id) ? 'bg-emerald-500 text-white' : 'bg-brand-navy text-white'"
            >
              <CheckCircle2 v-if="isStepComplete(step.id)" :size="14" />
              <span v-else>{{ step.id }}</span>
            </span>
            <span class="font-heading font-bold text-brand-navy text-sm flex-1">{{ step.title }}</span>
            <ChevronDown
              :size="18"
              class="text-brand-navy/40 transition-transform"
              :class="openStep === step.id ? 'rotate-180' : ''"
            />
          </button>

          <Transition
            enter-active-class="transition-all duration-200 ease-out"
            enter-from-class="opacity-0 -translate-y-1"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition-all duration-150 ease-in"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="openStep === step.id" class="px-4 pb-4 pt-1 border-t border-gray-100">
              <!-- Step 1: platforms -->
              <div v-if="step.id === 1" class="pt-3">
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="platform in platformOptions"
                    :key="platform"
                    type="button"
                    class="px-4 py-2 rounded-full text-sm font-semibold border transition-colors"
                    :class="platforms.includes(platform)
                      ? 'bg-brand-navy text-white border-brand-navy'
                      : 'bg-white text-brand-navy/70 border-gray-200 hover:bg-gray-50'"
                    @click="togglePlatform(platform)"
                  >
                    {{ platform }}
                  </button>
                </div>
                <p class="font-body text-xs text-brand-navy/50 mt-3">
                  {{
                    effectiveLimit
                      ? `Character limit for your selection: ${effectiveLimit.toLocaleString()}`
                      : 'Pick where this post will go. Character limits are checked for you.'
                  }}
                </p>
              </div>

              <!-- Step 2: content -->
              <div v-else-if="step.id === 2" class="space-y-3 pt-3">
                <input
                  v-model="title"
                  type="text"
                  placeholder="add your title..."
                  aria-label="Post title"
                  class="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-body text-brand-navy placeholder-brand-navy/35 outline-none focus:ring-2 focus:ring-brand-indigo/25"
                />
                <textarea
                  v-model="body"
                  rows="4"
                  placeholder="add your text and links..."
                  aria-label="Post text"
                  class="w-full bg-gray-50 rounded-xl px-4 py-3 text-sm font-body text-brand-navy placeholder-brand-navy/35 outline-none resize-none focus:ring-2 focus:ring-brand-indigo/25"
                />

                <div class="flex items-center gap-4">
                  <button
                    type="button"
                    aria-label="Add photos from gallery"
                    title="Add photos"
                    :disabled="uploading || images.length >= MAX_IMAGES"
                    class="text-brand-navy/60 transition-colors hover:text-brand-navy disabled:opacity-40 disabled:pointer-events-none"
                    @click="galleryInput.click()"
                  >
                    <ImageIcon :size="20" />
                  </button>
                  <button
                    type="button"
                    aria-label="Take a photo with camera"
                    title="Take a photo"
                    :disabled="uploading || images.length >= MAX_IMAGES"
                    class="text-brand-navy/60 transition-colors hover:text-brand-navy disabled:opacity-40 disabled:pointer-events-none"
                    @click="cameraInput.click()"
                  >
                    <Camera :size="20" />
                  </button>
                  <button
                    type="button"
                    aria-label="Add hashtags"
                    title="Add hashtags"
                    class="transition-colors"
                    :class="showHashtagInput ? 'text-brand-navy' : 'text-brand-navy/60 hover:text-brand-navy'"
                    @click="toggleHashtagInput"
                  >
                    <Hash :size="20" />
                  </button>
                  <span v-if="images.length" class="font-body text-xs text-brand-navy/40">
                    {{ images.length }}/{{ MAX_IMAGES }}
                  </span>
                  <span
                    class="ml-auto font-body text-xs"
                    :class="overLimit
                      ? 'text-rose-500 font-semibold'
                      : nearLimit
                        ? 'text-amber-600 font-semibold'
                        : 'text-brand-navy/40'"
                    title="Text plus hashtags"
                  >
                    {{ charCount }}<span v-if="effectiveLimit"> / {{ effectiveLimit }}</span>
                  </span>
                </div>

                <p v-if="uploadError" role="alert" class="font-body text-xs text-rose-500">{{ uploadError }}</p>

                <div v-if="showHashtagInput" class="flex items-center gap-2 bg-gray-50 rounded-full px-3 py-2">
                  <Hash :size="14" class="text-brand-navy/40 shrink-0" />
                  <input
                    ref="hashtagInputEl"
                    v-model="hashtagInput"
                    type="text"
                    placeholder="type a hashtag, then space or enter"
                    aria-label="Add a hashtag"
                    class="flex-1 min-w-0 bg-transparent outline-none text-sm font-body text-brand-navy placeholder-brand-navy/35"
                    @keydown="onHashtagKeydown"
                    @blur="addHashtagsFromInput"
                  />
                </div>

                <div v-if="hashtags.length" class="flex flex-wrap gap-1.5">
                  <span
                    v-for="tag in hashtags"
                    :key="tag"
                    class="flex items-center gap-1 bg-brand-navy/5 text-brand-navy text-xs font-medium pl-2.5 pr-1.5 py-1 rounded-full"
                  >
                    #{{ tag }}
                    <button
                      type="button"
                      :aria-label="`Remove hashtag ${tag}`"
                      class="text-brand-navy/40 hover:text-brand-navy"
                      @click="removeHashtag(tag)"
                    >
                      <X :size="12" />
                    </button>
                  </span>
                </div>

                <div v-if="images.length || uploadingCount" class="grid grid-cols-4 gap-2">
                  <div
                    v-for="(image, i) in images"
                    :key="image.path || image.url"
                    class="relative aspect-square rounded-xl overflow-hidden bg-gray-100"
                  >
                    <img :src="image.url" alt="" class="w-full h-full object-cover" />
                    <button
                      type="button"
                      aria-label="Remove image"
                      class="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/75"
                      @click="removeImage(i)"
                    >
                      <X :size="12" />
                    </button>
                  </div>
                  <div
                    v-for="n in uploadingCount"
                    :key="`pending-${n}`"
                    class="aspect-square rounded-xl bg-gray-100 animate-pulse flex items-center justify-center"
                  >
                    <span class="w-5 h-5 rounded-full border-2 border-gray-300 border-t-brand-navy/60 animate-spin" />
                  </div>
                </div>
              </div>

              <!-- Step 3: schedule -->
              <div v-else-if="step.id === 3" class="pt-3">
                <div class="flex bg-gray-50 rounded-full p-1 gap-1">
                  <button
                    type="button"
                    class="flex-1 py-2 rounded-full text-sm font-semibold transition-colors"
                    :class="scheduleMode === 'now' ? 'bg-white shadow text-brand-navy' : 'text-brand-navy/50'"
                    @click="scheduleMode = 'now'"
                  >
                    Post Now
                  </button>
                  <button
                    type="button"
                    class="flex-1 py-2 rounded-full text-sm font-semibold transition-colors"
                    :class="scheduleMode === 'later' ? 'bg-white shadow text-brand-navy' : 'text-brand-navy/50'"
                    @click="scheduleMode = 'later'"
                  >
                    Schedule for Later
                  </button>
                </div>

                <div v-if="scheduleMode === 'later'" class="grid grid-cols-2 gap-3 mt-3">
                  <input
                    v-model="scheduleDate"
                    type="date"
                    :min="todayStr"
                    aria-label="Schedule date"
                    class="bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-body text-brand-navy outline-none focus:ring-2 focus:ring-brand-indigo/25"
                  />
                  <input
                    v-model="scheduleTime"
                    type="time"
                    aria-label="Schedule time"
                    class="bg-gray-50 rounded-xl px-3 py-2.5 text-sm font-body text-brand-navy outline-none focus:ring-2 focus:ring-brand-indigo/25"
                  />
                </div>
              </div>

              <!-- Step 4: review -->
              <div v-else class="pt-3">
                <div class="bg-gray-50 rounded-xl overflow-hidden border border-gray-100">
                  <div class="px-4 py-3 border-b border-gray-100">
                    <h3 class="font-heading font-bold text-brand-navy text-sm">{{ title || 'Untitled post' }}</h3>
                  </div>
                  <div class="p-4 space-y-2">
                    <p class="font-body text-sm text-brand-navy/90 whitespace-pre-wrap break-words">
                      {{ body || 'Nothing written yet.' }}
                    </p>
                    <p v-if="hashtags.length" class="font-body text-sm font-medium text-brand-navy/70 break-words">
                      {{ hashtagText }}
                    </p>
                    <div v-if="images.length" class="flex gap-2 pt-1">
                      <img
                        v-for="image in images"
                        :key="image.path || image.url"
                        :src="image.url"
                        alt=""
                        class="w-14 h-14 rounded-lg object-cover"
                      />
                    </div>
                  </div>
                </div>

                <div class="mt-3 flex flex-wrap items-center gap-1.5">
                  <span class="font-body text-xs text-brand-navy/60">Posting to:</span>
                  <span v-if="!platforms.length" class="font-body text-xs font-semibold text-brand-navy">
                    No platforms selected
                  </span>
                  <span
                    v-for="platform in platforms"
                    :key="platform"
                    class="px-2.5 py-0.5 rounded-full bg-brand-navy/5 text-brand-navy/70 text-[11px] font-medium"
                  >
                    {{ platform }}
                  </span>
                </div>
                <p class="font-body text-xs text-brand-navy/60 mt-1">
                  {{ scheduleMode === 'now' ? 'Marked as published as soon as you save.' : scheduleSummary }}
                </p>
              </div>
            </div>
          </Transition>
        </div>

        <input ref="galleryInput" type="file" accept="image/*" multiple class="hidden" @change="onFilesSelected" />
        <input ref="cameraInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onFilesSelected" />
      </div>

      <p
        v-if="formNotice"
        role="alert"
        class="font-body text-sm text-rose-50 bg-rose-500/15 border border-rose-400/30 rounded-lg px-3 py-2 text-center mt-5"
      >
        {{ formNotice }}
      </p>
      <p
        v-if="successNotice"
        role="status"
        class="font-body text-sm text-emerald-50 bg-emerald-500/15 border border-emerald-400/30 rounded-lg px-3 py-2 text-center mt-5"
      >
        {{ successNotice }}
      </p>

      <div class="flex gap-3 mt-6">
        <button
          type="button"
          class="flex-1 rounded-full border border-white/40 text-white font-body font-semibold text-sm py-3 transition-colors hover:bg-white/10"
          @click="handleCancel"
        >
          Cancel
        </button>
        <button
          type="button"
          :disabled="saving || uploading || justSaved"
          class="flex-1 rounded-full bg-white/15 border border-white/30 text-white font-body font-semibold text-sm py-3 transition-colors hover:bg-white/25 disabled:opacity-60 disabled:pointer-events-none"
          @click="handleSaveDraft"
        >
          Save as Draft
        </button>
      </div>

      <button
        type="button"
        :disabled="saving || uploading || justSaved"
        class="w-full mt-3 flex items-center justify-center gap-2 rounded-full bg-button-gradient text-white font-heading font-bold text-[15px] py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_30px_-10px_rgba(78,99,176,0.6)] transition duration-200 hover:brightness-110 active:scale-[0.985] disabled:opacity-60 disabled:pointer-events-none"
        @click="handlePrimarySave"
      >
        <span
          v-if="saving || uploading"
          class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
        />
        {{ saving ? 'Saving...' : uploading ? 'Uploading images...' : primaryLabel }}
      </button>
    </template>
  </AppShell>
</template>