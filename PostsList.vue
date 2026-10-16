<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Search,
  SlidersHorizontal,
  PenSquare,
  MoreVertical,
  Pencil,
  Copy,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-vue-next'
import AppShell from '../layouts/AppShell.vue'
import { usePosts } from '../composables/usePosts'

const props = defineProps({
  title: { type: String, required: true },
  statuses: { type: Array, default: () => [] }, // empty = all statuses
  countLabel: { type: String, default: 'Total Posts' },
  emptyTitle: { type: String, default: 'No posts yet' },
  emptyBody: { type: String, default: 'Tap the pen button above to create your first post.' }
})

const router = useRouter()
const { posts, loading, refreshing, fetchPosts, updatePostStatus } = usePosts()

// ---------------------------------------------------------------------------
// Status metadata
// ---------------------------------------------------------------------------
const STATUS_ORDER = ['draft', 'scheduled', 'published', 'archived', 'failed']

const STATUS_META = {
  draft: { label: 'Draft', badge: 'bg-gray-100 text-gray-600' },
  scheduled: { label: 'Scheduled', badge: 'bg-amber-50 text-amber-700' },
  published: { label: 'Published', badge: 'bg-emerald-50 text-emerald-700' },
  archived: { label: 'Archived', badge: 'bg-slate-100 text-slate-500' },
  failed: { label: 'Failed', badge: 'bg-rose-50 text-rose-600' }
}

// Quick actions shown on each card, depending on its current status.
const STATUS_ACTIONS = {
  draft: [
    { label: 'Mark Published', status: 'published' },
    { label: 'Archive', status: 'archived' }
  ],
  scheduled: [
    { label: 'Mark Published', status: 'published' },
    { label: 'Move to Draft', status: 'draft' },
    { label: 'Archive', status: 'archived' }
  ],
  published: [{ label: 'Archive', status: 'archived' }],
  archived: [{ label: 'Restore to Draft', status: 'draft' }],
  failed: [
    { label: 'Retry as Draft', status: 'draft' },
    { label: 'Archive', status: 'archived' }
  ]
}

const chipBase = 'px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors'
const chipOn = 'bg-brand-navy text-white border-brand-navy'
const chipOff = 'bg-white text-brand-navy/70 border-gray-200 hover:bg-gray-50'

// ---------------------------------------------------------------------------
// Lifecycle + loading
// ---------------------------------------------------------------------------
const loadFailed = ref(false)

onMounted(async () => {
  document.addEventListener('click', closeMenu)
  document.addEventListener('keydown', onKeydown)
  const ok = await fetchPosts()
  loadFailed.value = ok === false
})

onUnmounted(() => {
  document.removeEventListener('click', closeMenu)
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
  clearTimeout(toastTimer)
})

async function retryLoad() {
  loadFailed.value = false
  const ok = await fetchPosts()
  loadFailed.value = ok === false
}

async function refreshPosts() {
  const ok = await fetchPosts({ force: true })
  loadFailed.value = ok === false
  showToast(ok ? 'Posts refreshed' : "Couldn't refresh. Check your connection.")
}

// ---------------------------------------------------------------------------
// Scope + search + filters + sort
// ---------------------------------------------------------------------------
const showFilters = ref(false)
const searchQuery = ref('')
const statusFilter = ref('all')
const platformFilter = ref('all')
const sortOrder = ref('newest')

const scopeStatuses = computed(() => (props.statuses.length ? props.statuses : STATUS_ORDER))

const scopedPosts = computed(() => posts.value.filter((post) => scopeStatuses.value.includes(post.status)))

const availablePlatforms = computed(() =>
  [...new Set(scopedPosts.value.flatMap((post) => post.platforms))].sort()
)

const activeFilterCount = computed(
  () =>
    [statusFilter.value !== 'all', platformFilter.value !== 'all', sortOrder.value !== 'newest'].filter(Boolean)
      .length
)

const visiblePosts = computed(() => {
  // Hashtags are stored without "#", so strip it from the query too.
  const query = searchQuery.value.trim().toLowerCase().replace(/^#/, '')
  let list = scopedPosts.value

  if (statusFilter.value !== 'all') list = list.filter((post) => post.status === statusFilter.value)
  if (platformFilter.value !== 'all') list = list.filter((post) => post.platforms.includes(platformFilter.value))
  if (query) {
    list = list.filter((post) =>
      [post.title, post.body, ...post.hashtags, ...post.platforms].join(' ').toLowerCase().includes(query)
    )
  }

  return [...list].sort((a, b) => {
    const diff = new Date(a.createdAt) - new Date(b.createdAt)
    return sortOrder.value === 'newest' ? -diff : diff
  })
})

const isNarrowed = computed(() => visiblePosts.value.length !== scopedPosts.value.length)

function clearFilters() {
  searchQuery.value = ''
  statusFilter.value = 'all'
  platformFilter.value = 'all'
  sortOrder.value = 'newest'
}

// ---------------------------------------------------------------------------
// Toast (with optional undo)
// ---------------------------------------------------------------------------
const toast = ref(null)
let toastTimer = null

function showToast(message, undo = null) {
  clearTimeout(toastTimer)
  toast.value = { message, undo }
  toastTimer = setTimeout(() => {
    toast.value = null
  }, 5000)
}

function dismissToast() {
  clearTimeout(toastTimer)
  toast.value = null
}

function runUndo() {
  const undo = toast.value?.undo
  dismissToast()
  if (undo) undo()
}

// ---------------------------------------------------------------------------
// Card actions
// ---------------------------------------------------------------------------
const openMenuId = ref(null)

function toggleMenu(id) {
  openMenuId.value = openMenuId.value === id ? null : id
}

function closeMenu() {
  openMenuId.value = null
}

function editPost(post) {
  openMenuId.value = null
  router.push({ name: 'composer-edit', params: { id: post.id } })
}

async function changeStatus(post, status) {
  const previous = post.status
  const ok = await updatePostStatus(post.id, status)
  if (!ok) {
    showToast("Couldn't update that post. Please try again.")
    return
  }
  const message = status === 'archived' ? 'Post archived' : `Moved to ${STATUS_META[status].label}`
  showToast(message, () => undoStatus(post.id, previous))
}

async function undoStatus(id, previous) {
  const ok = await updatePostStatus(id, previous)
  showToast(ok ? 'Change undone' : "Couldn't undo that change. Please try again.")
}

async function copyPost(post) {
  openMenuId.value = null
  const tags = post.hashtags.length ? '\n\n' + post.hashtags.map((tag) => '#' + tag).join(' ') : ''
  try {
    await navigator.clipboard.writeText(`${post.body}${tags}`)
    showToast('Post text copied')
  } catch {
    showToast("Couldn't copy to clipboard")
  }
}

// ---------------------------------------------------------------------------
// Image viewer
// ---------------------------------------------------------------------------
const lightbox = ref(null) // { images: string[], index: number }

function openLightbox(images, index) {
  lightbox.value = { images: [...images], index }
}

function closeLightbox() {
  lightbox.value = null
}

function stepLightbox(delta) {
  if (!lightbox.value) return
  const total = lightbox.value.images.length
  lightbox.value = { ...lightbox.value, index: (lightbox.value.index + delta + total) % total }
}

// Stop the page behind the viewer from scrolling.
watch(lightbox, (value) => {
  document.body.style.overflow = value ? 'hidden' : ''
})

function onKeydown(event) {
  if (lightbox.value) {
    if (event.key === 'Escape') closeLightbox()
    else if (event.key === 'ArrowRight') stepLightbox(1)
    else if (event.key === 'ArrowLeft') stepLightbox(-1)
    return
  }
  if (event.key === 'Escape') openMenuId.value = null
}

// ---------------------------------------------------------------------------
// Long post text: clamp with "Show more"
// ---------------------------------------------------------------------------
const expandedIds = ref([])
const clampStyle = {
  display: '-webkit-box',
  WebkitLineClamp: 4,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden'
}

function isLong(post) {
  return post.body.length > 180
}

function isExpanded(id) {
  return expandedIds.value.includes(id)
}

function toggleExpanded(id) {
  expandedIds.value = isExpanded(id)
    ? expandedIds.value.filter((item) => item !== id)
    : [...expandedIds.value, id]
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
function formatDate(iso) {
  const date = new Date(iso)
  const datePart = date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  })
  let hours = date.getHours()
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${datePart} | ${hours}:${minutes}${ampm}`
}
</script>

<template>
  <AppShell :title="title">
    <!-- Search + filter toggle -->
    <div
      class="flex items-center gap-2.5 bg-white rounded-full shadow-[0_10px_28px_-10px_rgba(35,43,77,0.35)] px-4 py-3 transition-shadow focus-within:shadow-[0_10px_28px_-6px_rgba(35,43,77,0.45)]"
    >
      <Search :size="18" class="text-brand-navy/35 shrink-0" />
      <input
        v-model="searchQuery"
        type="search"
        :placeholder="`Search ${title}`"
        :aria-label="`Search ${title}`"
        class="w-full min-w-0 bg-transparent outline-none text-base font-body text-brand-navy placeholder-brand-navy/35"
      />
      <button
        type="button"
        aria-label="Filter and sort"
        :aria-expanded="showFilters"
        class="relative shrink-0 rounded-full p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40"
        :class="showFilters || activeFilterCount ? 'text-brand-navy' : 'text-brand-navy/35 hover:text-brand-navy'"
        @click="showFilters = !showFilters"
      >
        <SlidersHorizontal :size="18" />
        <span
          v-if="activeFilterCount"
          class="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-1 flex items-center justify-center rounded-full bg-button-gradient text-white text-[9px] font-bold leading-none"
        >
          {{ activeFilterCount }}
        </span>
      </button>
    </div>

    <!-- Filter panel -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showFilters"
        class="mt-3 bg-white rounded-2xl shadow-[0_14px_32px_-14px_rgba(35,43,77,0.4)] p-4 space-y-4"
      >
        <div v-if="scopeStatuses.length > 1">
          <p class="font-body text-[11px] font-semibold uppercase tracking-wider text-brand-navy/50 mb-2">Status</p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :class="[chipBase, statusFilter === 'all' ? chipOn : chipOff]"
              @click="statusFilter = 'all'"
            >
              All
            </button>
            <button
              v-for="status in scopeStatuses"
              :key="status"
              type="button"
              :class="[chipBase, statusFilter === status ? chipOn : chipOff]"
              @click="statusFilter = status"
            >
              {{ STATUS_META[status].label }}
            </button>
          </div>
        </div>

        <div v-if="availablePlatforms.length">
          <p class="font-body text-[11px] font-semibold uppercase tracking-wider text-brand-navy/50 mb-2">Platform</p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              :class="[chipBase, platformFilter === 'all' ? chipOn : chipOff]"
              @click="platformFilter = 'all'"
            >
              All
            </button>
            <button
              v-for="platform in availablePlatforms"
              :key="platform"
              type="button"
              :class="[chipBase, platformFilter === platform ? chipOn : chipOff]"
              @click="platformFilter = platform"
            >
              {{ platform }}
            </button>
          </div>
        </div>

        <div>
          <p class="font-body text-[11px] font-semibold uppercase tracking-wider text-brand-navy/50 mb-2">Sort by</p>
          <div class="flex gap-2">
            <button
              type="button"
              :class="[chipBase, sortOrder === 'newest' ? chipOn : chipOff]"
              @click="sortOrder = 'newest'"
            >
              Newest first
            </button>
            <button
              type="button"
              :class="[chipBase, sortOrder === 'oldest' ? chipOn : chipOff]"
              @click="sortOrder = 'oldest'"
            >
              Oldest first
            </button>
          </div>
        </div>

        <div class="flex justify-end">
          <button
            type="button"
            :disabled="!activeFilterCount"
            class="font-body text-xs font-semibold text-brand-navy/60 transition-colors hover:text-brand-navy disabled:opacity-40 disabled:pointer-events-none"
            @click="clearFilters"
          >
            Reset filters
          </button>
        </div>
      </div>
    </Transition>

    <!-- Count + refresh + new post -->
    <div class="flex items-center justify-between mt-5">
      <div>
        <p class="font-body font-semibold text-white/95 text-sm sm:text-base">
          {{ countLabel }}: {{ scopedPosts.length }}
        </p>
        <p v-if="isNarrowed" class="font-body text-xs text-white/70 mt-0.5">
          Showing {{ visiblePosts.length }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          aria-label="Refresh posts"
          title="Refresh"
          :disabled="refreshing || loading"
          class="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-white/15 border border-white/30 text-white transition-colors hover:bg-white/25 active:scale-95 disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          @click="refreshPosts"
        >
          <RefreshCw :size="16" :class="refreshing ? 'animate-spin' : ''" />
        </button>
        <router-link
          :to="{ name: 'composer' }"
          aria-label="New post"
          title="New post"
          class="w-11 h-11 shrink-0 flex items-center justify-center rounded-full bg-button-gradient text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_10px_24px_-8px_rgba(78,99,176,0.55)] transition duration-200 hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <PenSquare :size="18" />
        </router-link>
      </div>
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
      <div v-for="n in 2" :key="n" class="h-40 rounded-2xl bg-white/20 animate-pulse" />
    </div>

    <!-- Load error -->
    <div
      v-else-if="loadFailed && posts.length === 0"
      class="mt-8 bg-white/95 rounded-2xl px-6 py-10 text-center shadow-[0_10px_28px_-10px_rgba(35,43,77,0.35)]"
    >
      <p class="font-heading font-bold text-brand-navy text-base">Couldn't load your posts</p>
      <p class="font-body text-sm text-brand-navy/60 mt-1">Check your connection and try again.</p>
      <button
        type="button"
        class="mt-4 px-4 py-1.5 rounded-full text-xs font-semibold border border-gray-200 text-brand-navy/70 transition-colors hover:bg-gray-50"
        @click="retryLoad"
      >
        Retry
      </button>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="visiblePosts.length === 0"
      class="mt-8 bg-white/95 rounded-2xl px-6 py-10 text-center shadow-[0_10px_28px_-10px_rgba(35,43,77,0.35)]"
    >
      <p class="font-heading font-bold text-brand-navy text-base">
        {{ scopedPosts.length === 0 ? emptyTitle : 'No posts match your search or filters' }}
      </p>
      <p class="font-body text-sm text-brand-navy/60 mt-1">
        {{ scopedPosts.length === 0 ? emptyBody : 'Try a different keyword, or reset the filters.' }}
      </p>
      <button
        v-if="scopedPosts.length > 0"
        type="button"
        class="mt-4 px-4 py-1.5 rounded-full text-xs font-semibold border border-gray-200 text-brand-navy/70 transition-colors hover:bg-gray-50"
        @click="clearFilters"
      >
        Clear search &amp; filters
      </button>
    </div>

    <!-- Posts -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5 items-start">
      <article
        v-for="(post, index) in visiblePosts"
        :key="post.id"
        class="relative bg-white rounded-2xl shadow-[0_14px_32px_-14px_rgba(35,43,77,0.4)] flex flex-col animate-card-in"
        :class="openMenuId === post.id ? 'z-20' : ''"
        :style="{ animationDelay: `${Math.min(index, 8) * 60}ms` }"
      >
        <div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <h2 class="font-heading font-bold text-brand-navy text-base truncate">{{ post.title }}</h2>
          <span
            class="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
            :class="STATUS_META[post.status]?.badge ?? 'bg-gray-100 text-gray-600'"
          >
            {{ STATUS_META[post.status]?.label ?? post.status }}
          </span>
        </div>

        <div class="p-4 space-y-3 flex-1">
          <div class="bg-gray-50 rounded-xl p-3">
            <p
              class="font-body text-sm text-brand-navy/90 leading-relaxed whitespace-pre-wrap break-words"
              :style="isLong(post) && !isExpanded(post.id) ? clampStyle : null"
            >
              {{ post.body }}
            </p>
            <button
              v-if="isLong(post)"
              type="button"
              class="font-body text-xs font-semibold text-brand-indigo mt-1 hover:underline underline-offset-2"
              @click="toggleExpanded(post.id)"
            >
              {{ isExpanded(post.id) ? 'Show less' : 'Show more' }}
            </button>
            <p v-if="post.hashtags.length" class="font-body text-sm font-medium text-brand-navy/70 mt-2 break-words">
              {{ post.hashtags.map((tag) => '#' + tag).join(' ') }}
            </p>
          </div>

          <div v-if="post.images.length" class="flex flex-wrap gap-2">
            <button
              v-for="(image, i) in post.images"
              :key="i"
              type="button"
              aria-label="View image"
              class="rounded-xl overflow-hidden transition-transform hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40"
              @click="openLightbox(post.images, i)"
            >
              <img :src="image" alt="" class="w-16 h-16 sm:w-20 sm:h-20 object-cover" />
            </button>
          </div>

          <div v-if="post.platforms.length" class="flex flex-wrap gap-1.5">
            <span
              v-for="platform in post.platforms"
              :key="platform"
              class="px-2.5 py-0.5 rounded-full bg-brand-navy/5 text-brand-navy/70 text-[11px] font-medium"
            >
              {{ platform }}
            </span>
          </div>
        </div>

        <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
          <div class="min-w-0">
            <p class="font-body text-xs text-gray-400">{{ formatDate(post.createdAt) }}</p>
            <p
              v-if="post.status === 'scheduled' && post.scheduledFor"
              class="font-body text-xs font-semibold text-amber-600 mt-0.5"
            >
              Scheduled for {{ formatDate(post.scheduledFor) }}
            </p>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <button
              type="button"
              aria-label="Edit post"
              title="Edit"
              class="p-1.5 rounded-full text-gray-400 transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40"
              @click="editPost(post)"
            >
              <Pencil :size="16" />
            </button>

            <div class="relative">
              <button
                type="button"
                aria-label="Post options"
                title="More"
                class="p-1 rounded-full text-gray-400 transition-colors hover:text-brand-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40"
                @click.stop="toggleMenu(post.id)"
              >
                <MoreVertical :size="18" />
              </button>

              <!-- Opens upward so it never runs off the bottom of the page -->
              <div
                v-if="openMenuId === post.id"
                class="absolute right-0 bottom-full mb-1 w-44 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-10"
                @click.stop
              >
                <button
                  type="button"
                  class="w-full flex items-center gap-2 px-3 py-2 text-left font-body text-sm text-brand-navy transition-colors hover:bg-gray-50"
                  @click="copyPost(post)"
                >
                  <Copy :size="14" />
                  Copy post text
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="STATUS_ACTIONS[post.status]" class="flex flex-wrap gap-2 px-4 pb-4">
          <button
            v-for="action in STATUS_ACTIONS[post.status]"
            :key="action.status"
            type="button"
            class="px-4 py-1.5 rounded-full text-xs font-semibold border border-gray-200 bg-white text-brand-navy/70 transition-colors hover:bg-gray-50"
            @click="changeStatus(post, action.status)"
          >
            {{ action.label }}
          </button>
        </div>
      </article>
    </div>

    <!-- Image viewer -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Image preview"
          class="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4"
          @click="closeLightbox"
        >
          <button
            type="button"
            aria-label="Close preview"
            class="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            @click.stop="closeLightbox"
          >
            <X :size="20" />
          </button>

          <button
            v-if="lightbox.images.length > 1"
            type="button"
            aria-label="Previous image"
            class="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            @click.stop="stepLightbox(-1)"
          >
            <ChevronLeft :size="22" />
          </button>

          <img
            :src="lightbox.images[lightbox.index]"
            alt=""
            class="max-h-[85vh] max-w-full rounded-xl object-contain"
            @click.stop
          />

          <button
            v-if="lightbox.images.length > 1"
            type="button"
            aria-label="Next image"
            class="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            @click.stop="stepLightbox(1)"
          >
            <ChevronRight :size="22" />
          </button>

          <p
            v-if="lightbox.images.length > 1"
            class="absolute bottom-5 left-1/2 -translate-x-1/2 font-body text-xs text-white/80"
          >
            {{ lightbox.index + 1 }} / {{ lightbox.images.length }}
          </p>
        </div>
      </Transition>
    </Teleport>

    <!-- Toast -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="toast"
          role="status"
          class="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-full bg-brand-navy text-white pl-5 pr-3 py-2.5 shadow-[0_14px_32px_-10px_rgba(35,43,77,0.6)] max-w-[calc(100vw-2rem)]"
        >
          <span class="font-body text-sm">{{ toast.message }}</span>
          <button
            v-if="toast.undo"
            type="button"
            class="font-body text-sm font-bold underline underline-offset-2 text-white/90 hover:text-white"
            @click="runUndo"
          >
            Undo
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            class="p-1 rounded-full text-white/60 transition-colors hover:text-white"
            @click="dismissToast"
          >
            <X :size="14" />
          </button>
        </div>
      </Transition>
    </Teleport>
  </AppShell>
</template>