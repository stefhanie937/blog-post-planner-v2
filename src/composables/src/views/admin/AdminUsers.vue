<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Search, UserX, UserCheck, ChevronLeft, ChevronRight, Users } from 'lucide-vue-next'
import AdminShell from '../../layouts/AdminShell.vue'
import ConfirmDialog from '../../components/admin/ConfirmDialog.vue'
import UserDetailModal from '../../components/admin/UserDetailModal.vue'
import { useAdmin } from '../../composables/useAdmin'
import { useAuth } from '../../composables/useAuth'
import {
  cardClass,
  inputClass,
  labelClass,
  outlineButtonClass,
  noticeClass,
  chipBase,
  statusChipClass,
  roleChipClass,
  fullName,
  initialsOf,
  plural,
  formatDate,
  formatShortDateTime
} from '../../utils/adminUtils'

const { users, usersLoading, loadUsers, setUserActive } = useAdmin()
const { user: me } = useAuth()

const PAGE_SIZE = 10
const gridCols = 'md:grid-cols-[minmax(0,2.4fr)_72px_104px_64px_120px_150px_116px]'

const search = ref('')
const status = ref('all')
const role = ref('all')
const sort = ref('newest')
const page = ref(1)

const loadError = ref('')

async function load() {
  loadError.value = ''
  try {
    await loadUsers({ force: true })
  } catch (err) {
    loadError.value = err.message || "Couldn't load users."
  }
}

onMounted(load)

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------
const totals = computed(() => ({
  all: users.value.length,
  active: users.value.filter((u) => u.isActive).length,
  inactive: users.value.filter((u) => !u.isActive).length
}))

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  const list = users.value.filter((u) => {
    if (status.value === 'active' && !u.isActive) return false
    if (status.value === 'inactive' && u.isActive) return false
    if (role.value !== 'all' && u.role !== role.value) return false
    if (q && !(fullName(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q))) return false
    return true
  })

  const byDate = (key, dir) => (a, b) => (new Date(a[key] || 0) - new Date(b[key] || 0)) * dir
  switch (sort.value) {
    case 'oldest':
      return list.sort(byDate('createdAt', 1))
    case 'name':
      return list.sort((a, b) => fullName(a).localeCompare(fullName(b)))
    case 'posts':
      return list.sort((a, b) => b.postCount - a.postCount)
    case 'signin':
      return list.sort(byDate('lastSignInAt', -1))
    default:
      return list.sort(byDate('createdAt', -1))
  }
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const pageRows = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

watch([search, status, role, sort], () => {
  page.value = 1
})

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Deactivated' }
]

function canToggle(u) {
  return u.role !== 'admin' && u.id !== me.value?.id
}

// ---------------------------------------------------------------------------
// Notice (fades on its own)
// ---------------------------------------------------------------------------
const notice = ref(null)
let noticeTimer = null

function setNotice(type, text) {
  clearTimeout(noticeTimer)
  notice.value = { type, text }
  if (type === 'success') {
    noticeTimer = setTimeout(() => {
      notice.value = null
    }, 4000)
  }
}

onUnmounted(() => clearTimeout(noticeTimer))

// ---------------------------------------------------------------------------
// Detail + activate / deactivate
// ---------------------------------------------------------------------------
const detailId = ref(null)
const detailUser = computed(() => users.value.find((u) => u.id === detailId.value) ?? null)

const confirmTarget = ref(null)
const toggling = ref(false)
const toggleError = ref('')

function askToggle(u) {
  toggleError.value = ''
  confirmTarget.value = u
}

async function confirmToggle() {
  const target = confirmTarget.value
  if (!target) return
  const next = !target.isActive

  toggling.value = true
  toggleError.value = ''
  try {
    await setUserActive(target.id, next)
    setNotice('success', `${fullName(target)} was ${next ? 'activated' : 'deactivated'}.`)
    confirmTarget.value = null
  } catch (err) {
    toggleError.value = err.message || "Couldn't update this account. Please try again."
  } finally {
    toggling.value = false
  }
}

const confirmCopy = computed(() => {
  const target = confirmTarget.value
  if (!target) return { title: '', message: '', label: '' }
  if (target.isActive) {
    return {
      title: 'Deactivate this account?',
      message: `${fullName(target)} won't be able to log in or use the app until you activate the account again. Their posts are kept.`,
      label: 'Deactivate'
    }
  }
  return {
    title: 'Activate this account?',
    message: `${fullName(target)} will be able to log in and use the app again.`,
    label: 'Activate'
  }
})
</script>

<template>
  <AdminShell title="Users" subtitle="Find accounts, see how they're used, and activate or deactivate them.">
    <div class="space-y-4">
      <p v-if="notice" :role="notice.type === 'error' ? 'alert' : 'status'" :class="noticeClass[notice.type]">
        {{ notice.text }}
      </p>

      <!-- Totals -->
      <div class="grid grid-cols-3 gap-3">
        <div class="rounded-2xl p-3 sm:p-4 text-center bg-brand-navy text-white shadow-[0_14px_32px_-14px_rgba(35,43,77,0.4)]">
          <p class="font-heading font-bold text-2xl leading-none">{{ totals.all }}</p>
          <p class="font-body text-xs font-semibold mt-1.5 text-white/80">Total</p>
        </div>
        <div class="rounded-2xl p-3 sm:p-4 text-center bg-emerald-50 text-emerald-700 shadow-[0_14px_32px_-14px_rgba(35,43,77,0.4)]">
          <p class="font-heading font-bold text-2xl leading-none">{{ totals.active }}</p>
          <p class="font-body text-xs font-semibold mt-1.5">Active</p>
        </div>
        <div class="rounded-2xl p-3 sm:p-4 text-center bg-rose-50 text-rose-600 shadow-[0_14px_32px_-14px_rgba(35,43,77,0.4)]">
          <p class="font-heading font-bold text-2xl leading-none">{{ totals.inactive }}</p>
          <p class="font-body text-xs font-semibold mt-1.5">Deactivated</p>
        </div>
      </div>

      <!-- Filters -->
      <section :class="[cardClass, 'p-4']">
        <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div class="relative">
            <label for="user-search" class="sr-only">Search users</label>
            <Search :size="16" class="absolute left-4 top-1/2 -translate-y-1/2 text-brand-navy/35" />
            <input
              id="user-search"
              v-model="search"
              type="search"
              placeholder="Search by name or email"
              autocomplete="off"
              :class="[inputClass, 'pl-10']"
            />
          </div>

          <div class="flex rounded-full bg-gray-100 p-1 w-full md:w-auto" role="group" aria-label="Filter by status">
            <button
              v-for="option in STATUS_FILTERS"
              :key="option.key"
              type="button"
              class="flex-1 md:flex-none rounded-full px-3.5 py-1.5 font-body text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40"
              :class="status === option.key ? 'bg-white text-brand-navy shadow-sm' : 'text-brand-navy/60 hover:text-brand-navy'"
              :aria-pressed="status === option.key"
              @click="status = option.key"
            >
              {{ option.label }}
            </button>
          </div>

          <div class="grid grid-cols-2 gap-3 md:flex">
            <div>
              <label for="user-role" class="sr-only">Filter by role</label>
              <select id="user-role" v-model="role" :class="[inputClass, 'md:w-auto']">
                <option value="all">All roles</option>
                <option value="user">Users</option>
                <option value="admin">Admins</option>
              </select>
            </div>
            <div>
              <label for="user-sort" class="sr-only">Sort users</label>
              <select id="user-sort" v-model="sort" :class="[inputClass, 'md:w-auto']">
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name A to Z</option>
                <option value="posts">Most posts</option>
                <option value="signin">Last sign-in</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      <!-- List -->
      <section :class="[cardClass, 'overflow-hidden']">
        <div v-if="usersLoading && !users.length" class="p-4 space-y-2">
          <div v-for="n in 5" :key="n" class="h-14 rounded-xl bg-gray-100 animate-pulse" />
        </div>

        <div v-else-if="loadError && !users.length" class="p-6 text-center">
          <p class="font-body text-sm text-brand-navy/70">{{ loadError }}</p>
          <button type="button" :class="[outlineButtonClass, 'mt-4']" @click="load">Retry</button>
        </div>

        <div v-else-if="!filtered.length" class="p-8 text-center">
          <span class="w-10 h-10 mx-auto flex items-center justify-center rounded-full bg-brand-navy/5 text-brand-navy">
            <Users :size="18" />
          </span>
          <p class="font-heading font-bold text-brand-navy mt-3">No users match</p>
          <p class="font-body text-sm text-brand-navy/60 mt-1">Try a different search or clear a filter.</p>
        </div>

        <template v-else>
          <!-- Column labels (desktop) -->
          <div
            class="hidden md:grid gap-3 px-4 py-2.5 border-b border-gray-100"
            :class="gridCols"
          >
            <span :class="[labelClass, 'mb-0']">User</span>
            <span :class="[labelClass, 'mb-0']">Role</span>
            <span :class="[labelClass, 'mb-0']">Status</span>
            <span :class="[labelClass, 'mb-0']">Posts</span>
            <span :class="[labelClass, 'mb-0']">Joined</span>
            <span :class="[labelClass, 'mb-0']">Last sign-in</span>
            <span :class="[labelClass, 'mb-0 text-right']">Action</span>
          </div>

          <ul>
            <li
              v-for="u in pageRows"
              :key="u.id"
              class="px-4 py-3 border-b border-gray-100 last:border-b-0 md:grid md:items-center md:gap-3"
              :class="gridCols"
            >
              <button
                type="button"
                class="flex items-center gap-3 min-w-0 text-left rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40"
                @click="detailId = u.id"
              >
                <span
                  class="w-10 h-10 shrink-0 rounded-full bg-brand-navy text-white font-heading font-bold text-sm flex items-center justify-center select-none"
                >
                  {{ initialsOf(u) }}
                </span>
                <span class="min-w-0">
                  <span class="block font-body text-sm font-semibold text-brand-navy truncate">{{ fullName(u) }}</span>
                  <span class="block font-body text-xs text-brand-navy/55 truncate">{{ u.email }}</span>
                </span>
              </button>

              <!-- Phone layout: compact summary -->
              <div class="md:hidden mt-2.5 flex flex-wrap items-center gap-1.5">
                <span :class="[chipBase, roleChipClass(u.role)]">{{ u.role === 'admin' ? 'Admin' : 'User' }}</span>
                <span :class="[chipBase, statusChipClass(u.isActive)]">{{ u.isActive ? 'Active' : 'Deactivated' }}</span>
                <span class="font-body text-xs text-brand-navy/60">{{ plural(u.postCount, 'post') }}</span>
              </div>
              <p class="md:hidden font-body text-xs text-brand-navy/50 mt-1.5">
                Joined {{ formatDate(u.createdAt) }} · Last sign-in {{ formatShortDateTime(u.lastSignInAt) }}
              </p>

              <!-- Desktop cells -->
              <div class="hidden md:block">
                <span :class="[chipBase, roleChipClass(u.role)]">{{ u.role === 'admin' ? 'Admin' : 'User' }}</span>
              </div>
              <div class="hidden md:block">
                <span :class="[chipBase, statusChipClass(u.isActive)]">{{ u.isActive ? 'Active' : 'Deactivated' }}</span>
              </div>
              <p class="hidden md:block font-body text-sm text-brand-navy">{{ u.postCount }}</p>
              <p class="hidden md:block font-body text-sm text-brand-navy/70">{{ formatDate(u.createdAt) }}</p>
              <p class="hidden md:block font-body text-sm text-brand-navy/70">{{ formatShortDateTime(u.lastSignInAt) }}</p>

              <div class="mt-3 md:mt-0 md:text-right">
                <button
                  v-if="canToggle(u)"
                  type="button"
                  class="inline-flex items-center justify-center gap-1.5 rounded-full border px-3.5 py-1.5 font-body text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2"
                  :class="
                    u.isActive
                      ? 'border-rose-200 text-rose-600 hover:bg-rose-50 focus-visible:ring-rose-300'
                      : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 focus-visible:ring-emerald-300'
                  "
                  @click="askToggle(u)"
                >
                  <UserX v-if="u.isActive" :size="14" />
                  <UserCheck v-else :size="14" />
                  {{ u.isActive ? 'Deactivate' : 'Activate' }}
                </button>
                <span v-else class="font-body text-xs text-brand-navy/40">
                  {{ u.id === me?.id ? 'You' : 'Protected' }}
                </span>
              </div>
            </li>
          </ul>

          <!-- Pagination -->
          <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
            <p class="font-body text-xs text-brand-navy/60">
              Showing {{ (page - 1) * PAGE_SIZE + 1 }}–{{ Math.min(page * PAGE_SIZE, filtered.length) }}
              of {{ filtered.length }}
            </p>
            <div class="flex items-center gap-2">
              <button
                type="button"
                :disabled="page <= 1"
                :class="[outlineButtonClass, '!px-3 !py-2']"
                aria-label="Previous page"
                @click="page -= 1"
              >
                <ChevronLeft :size="16" />
              </button>
              <span class="font-body text-xs font-semibold text-brand-navy/70">{{ page }} / {{ pageCount }}</span>
              <button
                type="button"
                :disabled="page >= pageCount"
                :class="[outlineButtonClass, '!px-3 !py-2']"
                aria-label="Next page"
                @click="page += 1"
              >
                <ChevronRight :size="16" />
              </button>
            </div>
          </div>
        </template>
      </section>
    </div>

    <UserDetailModal :user="detailUser" @close="detailId = null" @toggle="askToggle" />

    <ConfirmDialog
      :open="!!confirmTarget"
      :title="confirmCopy.title"
      :message="confirmCopy.message"
      :confirm-label="confirmCopy.label"
      :tone="confirmTarget?.isActive ? 'danger' : 'primary'"
      :loading="toggling"
      :error="toggleError"
      @confirm="confirmToggle"
      @cancel="confirmTarget = null"
    />
  </AdminShell>
</template>
