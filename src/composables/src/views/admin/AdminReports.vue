<script setup>
import { ref, reactive, computed, watch, onMounted, onUnmounted } from 'vue'
import {
  Users,
  FileText,
  Activity,
  SlidersHorizontal,
  Search,
  ListChecks,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from 'lucide-vue-next'
import AdminShell from '../../layouts/AdminShell.vue'
import { useAdmin } from '../../composables/useAdmin'
import { useAuth } from '../../composables/useAuth'
import {
  cardClass,
  sectionHeadClass,
  iconBubbleClass,
  labelClass,
  inputClass,
  primaryButtonClass,
  outlineButtonClass,
  noticeClass,
  chipBase,
  statusChipClass,
  roleChipClass,
  postStatusChipClass,
  POST_STATUSES,
  ACTIONS,
  fullName,
  plural,
  formatDate,
  formatDateTime,
  localDateStr,
  rangeBounds,
  inRange,
  presetRange,
  actionLabel,
  actionTone,
  describeDetails
} from '../../utils/adminUtils'
import { buildCsv, downloadFile, exportPdf } from '../../utils/reportExport'

const { users, userMap, loadUsers, fetchPostsReport, fetchActivityReport } = useAdmin()
const { user: me, profile } = useAuth()

// ---------------------------------------------------------------------------
// What to report on
// ---------------------------------------------------------------------------
const TYPES = [
  { key: 'users', label: 'Users', hint: 'Accounts, roles and status', icon: Users },
  { key: 'posts', label: 'Posts', hint: 'Every post across all users', icon: FileText },
  { key: 'activity', label: 'Activity', hint: 'Logins, sign-ups and post changes', icon: Activity }
]

const PRESETS = [
  { key: '7d', label: 'Last 7 days' },
  { key: '30d', label: 'Last 30 days' },
  { key: 'month', label: 'This month' },
  { key: 'all', label: 'All time' }
]

const type = ref('users')
const preset = ref('30d')
const dateFrom = ref('')
const dateTo = ref('')

function applyPreset(key) {
  preset.value = key
  const range = presetRange(key)
  dateFrom.value = range.from
  dateTo.value = range.to
}

function onDateEdit() {
  preset.value = 'custom'
}

applyPreset('30d')

// ---------------------------------------------------------------------------
// Filters (applied instantly once a report is generated)
// ---------------------------------------------------------------------------
const showFilters = ref(true)
const search = ref('')
const fUserStatus = ref('all')
const fRole = ref('all')
const fPostStatus = ref('all')
const fPlatform = ref('all')
const fAction = ref('all')

function resetFilters() {
  search.value = ''
  fUserStatus.value = 'all'
  fRole.value = 'all'
  fPostStatus.value = 'all'
  fPlatform.value = 'all'
  fAction.value = 'all'
}

const activeFilterCount = computed(() => {
  let count = search.value.trim() ? 1 : 0
  if (type.value === 'users') {
    if (fUserStatus.value !== 'all') count += 1
    if (fRole.value !== 'all') count += 1
  } else if (type.value === 'posts') {
    if (fPostStatus.value !== 'all') count += 1
    if (fPlatform.value !== 'all') count += 1
  } else if (fAction.value !== 'all') {
    count += 1
  }
  return count
})

// ---------------------------------------------------------------------------
// Columns (what shows in the table AND what gets exported)
// ---------------------------------------------------------------------------
const ownerOf = (post) => userMap.value.get(post.user_id)
const iso = (value) => value ?? ''

const COLUMN_DEFS = computed(() => ({
  users: [
    { key: 'name', label: 'Name', get: (u) => fullName(u), wide: true },
    { key: 'email', label: 'Email', get: (u) => u.email },
    { key: 'role', label: 'Role', get: (u) => (u.role === 'admin' ? 'Admin' : 'User'), chip: (u) => roleChipClass(u.role) },
    { key: 'status', label: 'Status', get: (u) => (u.isActive ? 'Active' : 'Deactivated'), chip: (u) => statusChipClass(u.isActive) },
    { key: 'posts', label: 'Posts', get: (u) => String(u.postCount), align: 'right' },
    { key: 'joined', label: 'Joined', get: (u) => formatDate(u.createdAt), csv: (u) => iso(u.createdAt) },
    { key: 'lastSignIn', label: 'Last sign-in', get: (u) => formatDateTime(u.lastSignInAt), csv: (u) => iso(u.lastSignInAt) }
  ],
  posts: [
    { key: 'title', label: 'Title', get: (p) => p.title, wide: true },
    { key: 'author', label: 'Author', get: (p) => fullName(ownerOf(p)) },
    { key: 'authorEmail', label: 'Author email', get: (p) => ownerOf(p)?.email ?? '' },
    { key: 'status', label: 'Status', get: (p) => p.status, chip: (p) => postStatusChipClass(p.status) },
    { key: 'platforms', label: 'Platforms', get: (p) => (p.platforms ?? []).join('; ') },
    { key: 'hashtags', label: 'Hashtags', get: (p) => (p.hashtags ?? []).map((tag) => `#${tag}`).join(' ') },
    { key: 'images', label: 'Images', get: (p) => String((p.images ?? []).length), align: 'right' },
    { key: 'scheduled', label: 'Scheduled for', get: (p) => (p.scheduled_for ? formatDateTime(p.scheduled_for) : ''), csv: (p) => iso(p.scheduled_for) },
    { key: 'created', label: 'Created', get: (p) => formatDateTime(p.created_at), csv: (p) => iso(p.created_at) },
    { key: 'body', label: 'Text', get: (p) => p.body ?? '', wide: true }
  ],
  activity: [
    { key: 'when', label: 'Date & time', get: (a) => formatDateTime(a.created_at), csv: (a) => iso(a.created_at) },
    { key: 'user', label: 'User', get: (a) => fullName(userMap.value.get(a.user_id)) },
    { key: 'email', label: 'Email', get: (a) => userMap.value.get(a.user_id)?.email ?? '' },
    { key: 'action', label: 'Action', get: (a) => actionLabel(a.action), chip: (a) => actionTone(a.action) },
    { key: 'details', label: 'Details', get: (a) => describeDetails(a), wide: true }
  ]
}))

const DEFAULT_COLUMNS = {
  users: ['name', 'email', 'role', 'status', 'posts', 'joined', 'lastSignIn'],
  posts: ['title', 'author', 'status', 'platforms', 'created'],
  activity: ['when', 'user', 'action', 'details']
}

const selectedColumns = reactive({
  users: [...DEFAULT_COLUMNS.users],
  posts: [...DEFAULT_COLUMNS.posts],
  activity: [...DEFAULT_COLUMNS.activity]
})

const columnOptions = computed(() => COLUMN_DEFS.value[type.value])
const visibleColumns = computed(() =>
  columnOptions.value.filter((c) => selectedColumns[type.value].includes(c.key))
)

const showColumns = ref(false)

function toggleColumn(key) {
  const list = selectedColumns[type.value]
  const at = list.indexOf(key)
  if (at >= 0) {
    if (list.length === 1) return // always keep at least one column
    list.splice(at, 1)
  } else {
    list.push(key)
  }
}

// ---------------------------------------------------------------------------
// Notices
// ---------------------------------------------------------------------------
const notice = ref(null)
let noticeTimer = null

function setNotice(kind, text) {
  clearTimeout(noticeTimer)
  notice.value = { type: kind, text }
  if (kind === 'success') {
    noticeTimer = setTimeout(() => {
      notice.value = null
    }, 4000)
  }
}

function clearNotice() {
  clearTimeout(noticeTimer)
  notice.value = null
}

onUnmounted(() => clearTimeout(noticeTimer))

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------
const rows = ref([])
const generated = ref(false)
const generating = ref(false)
const truncated = ref(false)
const stale = ref(false)
const page = ref(1)
const PAGE_SIZE = 10

watch(type, () => {
  rows.value = []
  generated.value = false
  truncated.value = false
  stale.value = false
  showColumns.value = false
  page.value = 1
  resetFilters()
  clearNotice()
})

watch([dateFrom, dateTo], () => {
  if (generated.value) stale.value = true
})

watch(
  [search, fUserStatus, fRole, fPostStatus, fPlatform, fAction],
  () => {
    page.value = 1
  }
)

onMounted(() => {
  // Names in the posts / activity reports come from the users list.
  loadUsers().catch(() => {})
})

async function generate() {
  clearNotice()
  const { start, end } = rangeBounds(dateFrom.value, dateTo.value)
  if (start && end && start >= end) {
    setNotice('error', 'The start date must be on or before the end date.')
    return
  }

  const requested = type.value
  generating.value = true
  try {
    await loadUsers({ force: true })
    const range = { from: start ? start.toISOString() : null, to: end ? end.toISOString() : null }

    let result
    if (requested === 'users') {
      result = { rows: users.value.filter((u) => inRange(u.createdAt, start, end)), truncated: false }
    } else if (requested === 'posts') {
      result = await fetchPostsReport(range)
    } else {
      result = await fetchActivityReport(range)
    }

    if (requested !== type.value) return // the type changed while loading
    rows.value = result.rows
    truncated.value = result.truncated
    generated.value = true
    stale.value = false
    page.value = 1
  } catch (err) {
    setNotice('error', err.message || "Couldn't generate the report. Please try again.")
  } finally {
    generating.value = false
  }
}

// ---------------------------------------------------------------------------
// Filtered rows + summary
// ---------------------------------------------------------------------------
const platformOptions = computed(() =>
  [...new Set(rows.value.flatMap((r) => r.platforms ?? []))].sort((a, b) => a.localeCompare(b))
)

const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  const t = type.value

  return rows.value.filter((row) => {
    if (t === 'users') {
      if (fUserStatus.value === 'active' && !row.isActive) return false
      if (fUserStatus.value === 'inactive' && row.isActive) return false
      if (fRole.value !== 'all' && row.role !== fRole.value) return false
      if (q && !(fullName(row).toLowerCase().includes(q) || row.email.toLowerCase().includes(q))) return false
      return true
    }

    if (t === 'posts') {
      if (fPostStatus.value !== 'all' && row.status !== fPostStatus.value) return false
      if (fPlatform.value !== 'all' && !(row.platforms ?? []).includes(fPlatform.value)) return false
      if (q) {
        const owner = ownerOf(row)
        const haystack = `${row.title} ${fullName(owner)} ${owner?.email ?? ''}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    }

    // activity
    if (fAction.value !== 'all' && row.action !== fAction.value) return false
    if (q) {
      const actor = userMap.value.get(row.user_id)
      const haystack = `${fullName(actor)} ${actor?.email ?? ''} ${describeDetails(row)}`.toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
})

const SUMMARY_TILE = {
  total: 'bg-brand-navy text-white',
  good: 'bg-emerald-50 text-emerald-700',
  bad: 'bg-rose-50 text-rose-600',
  info: 'bg-brand-indigo/10 text-brand-indigo',
  warn: 'bg-amber-50 text-amber-700'
}

const summary = computed(() => {
  const list = filteredRows.value
  const count = (fn) => list.filter(fn).length

  if (type.value === 'users') {
    return [
      { label: 'Users', value: list.length, classes: SUMMARY_TILE.total },
      { label: 'Active', value: count((u) => u.isActive), classes: SUMMARY_TILE.good },
      { label: 'Deactivated', value: count((u) => !u.isActive), classes: SUMMARY_TILE.bad },
      { label: 'Admins', value: count((u) => u.role === 'admin'), classes: SUMMARY_TILE.info }
    ]
  }

  if (type.value === 'posts') {
    return [
      { label: 'Posts', value: list.length, classes: SUMMARY_TILE.total },
      ...POST_STATUSES.map((s) => ({
        label: s.label,
        value: count((p) => p.status === s.key),
        classes: s.classes
      }))
    ]
  }

  const postActions = ['post_created', 'post_updated', 'post_status_changed', 'post_deleted']
  return [
    { label: 'Events', value: list.length, classes: SUMMARY_TILE.total },
    { label: 'Logins', value: count((a) => a.action === 'login'), classes: SUMMARY_TILE.info },
    { label: 'Sign-ups', value: count((a) => a.action === 'signup'), classes: SUMMARY_TILE.good },
    { label: 'Post changes', value: count((a) => postActions.includes(a.action)), classes: SUMMARY_TILE.warn },
    {
      label: 'Admin actions',
      value: count((a) => a.action === 'user_activated' || a.action === 'user_deactivated'),
      classes: SUMMARY_TILE.bad
    }
  ]
})

const pageCount = computed(() => Math.max(1, Math.ceil(filteredRows.value.length / PAGE_SIZE)))
const pageRows = computed(() =>
  filteredRows.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE)
)

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
const exportingPdf = ref(false)

const periodLabel = computed(() => {
  if (!dateFrom.value && !dateTo.value) return 'All time'
  const from = dateFrom.value ? formatDate(`${dateFrom.value}T00:00:00`) : 'the beginning'
  const to = dateTo.value ? formatDate(`${dateTo.value}T00:00:00`) : 'today'
  return `${from} to ${to}`
})

const filterLines = computed(() => {
  const lines = []
  const q = search.value.trim()
  if (q) lines.push(`search "${q}"`)
  if (type.value === 'users') {
    if (fUserStatus.value !== 'all') lines.push(`status ${fUserStatus.value === 'active' ? 'active' : 'deactivated'}`)
    if (fRole.value !== 'all') lines.push(`role ${fRole.value}`)
  } else if (type.value === 'posts') {
    if (fPostStatus.value !== 'all') lines.push(`status ${fPostStatus.value}`)
    if (fPlatform.value !== 'all') lines.push(`platform ${fPlatform.value}`)
  } else if (fAction.value !== 'all') {
    lines.push(`action ${actionLabel(fAction.value).toLowerCase()}`)
  }
  return lines
})

const typeLabel = computed(() => TYPES.find((t) => t.key === type.value)?.label ?? '')

const adminLabel = computed(() => {
  const p = profile.value
  return p
    ? fullName({ firstName: p.first_name, lastName: p.last_name, email: p.email })
    : (me.value?.email ?? 'Admin')
})

function exportBaseName() {
  return `post-planner-${type.value}-report-${localDateStr()}`
}

function canExport() {
  if (!generated.value) {
    setNotice('error', 'Generate a report first.')
    return false
  }
  if (!filteredRows.value.length) {
    setNotice('error', 'There are no rows to export with these filters.')
    return false
  }
  return true
}

function exportCsv() {
  clearNotice()
  if (!canExport()) return
  const csv = buildCsv(visibleColumns.value, filteredRows.value)
  downloadFile(`${exportBaseName()}.csv`, csv, 'text/csv;charset=utf-8')
  setNotice('success', `Exported ${plural(filteredRows.value.length, 'row')} to CSV.`)
}

async function exportPdfFile() {
  clearNotice()
  if (!canExport()) return
  exportingPdf.value = true
  try {
    await exportPdf({
      title: `${typeLabel.value} report`,
      meta: [
        `Period: ${periodLabel.value}`,
        filterLines.value.length ? `Filters: ${filterLines.value.join(', ')}` : 'Filters: none',
        `Rows: ${filteredRows.value.length}`,
        `Generated ${formatDateTime(new Date().toISOString())} by ${adminLabel.value}`
      ],
      columns: visibleColumns.value,
      rows: filteredRows.value,
      filename: `${exportBaseName()}.pdf`
    })
    setNotice('success', `Exported ${plural(filteredRows.value.length, 'row')} to PDF.`)
  } catch (err) {
    setNotice('error', err.message || "Couldn't create the PDF. Please try again.")
  } finally {
    exportingPdf.value = false
  }
}

const filterChipClass = (active) =>
  active
    ? 'bg-brand-navy text-white'
    : 'bg-gray-100 text-brand-navy/70 hover:bg-gray-200'
</script>

<template>
  <AdminShell title="Reports" subtitle="Pick what to report on, narrow it down, then view or export it.">
    <div class="space-y-4">
      <!-- Request a report -->
      <section :class="cardClass">
        <div :class="sectionHeadClass">
          <span :class="iconBubbleClass"><FileText :size="16" /></span>
          <h3 class="font-heading font-bold text-brand-navy text-sm flex-1">Request a report</h3>
        </div>

        <div class="p-4 space-y-5">
          <!-- Type -->
          <div>
            <p :class="labelClass">Report type</p>
            <div class="grid sm:grid-cols-3 gap-2" role="radiogroup" aria-label="Report type">
              <button
                v-for="option in TYPES"
                :key="option.key"
                type="button"
                role="radio"
                :aria-checked="type === option.key"
                class="flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40"
                :class="
                  type === option.key
                    ? 'border-brand-indigo bg-brand-indigo/5'
                    : 'border-gray-200 bg-white hover:bg-gray-50'
                "
                @click="type = option.key"
              >
                <span
                  class="w-9 h-9 shrink-0 flex items-center justify-center rounded-full"
                  :class="type === option.key ? 'bg-brand-navy text-white' : 'bg-brand-navy/5 text-brand-navy'"
                >
                  <component :is="option.icon" :size="16" />
                </span>
                <span class="min-w-0">
                  <span class="block font-heading font-bold text-brand-navy text-sm">{{ option.label }}</span>
                  <span class="block font-body text-xs text-brand-navy/55">{{ option.hint }}</span>
                </span>
              </button>
            </div>
          </div>

          <!-- Date range -->
          <div>
            <p :class="labelClass">
              {{ type === 'users' ? 'Joined between' : 'Created between' }}
            </p>
            <div class="flex flex-wrap gap-2 mb-3">
              <button
                v-for="option in PRESETS"
                :key="option.key"
                type="button"
                class="rounded-full px-3.5 py-1.5 font-body text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40"
                :class="filterChipClass(preset === option.key)"
                :aria-pressed="preset === option.key"
                @click="applyPreset(option.key)"
              >
                {{ option.label }}
              </button>
            </div>
            <div class="grid grid-cols-2 gap-3 max-w-md">
              <div>
                <label for="report-from" class="sr-only">From date</label>
                <input id="report-from" v-model="dateFrom" type="date" :class="inputClass" @input="onDateEdit" />
              </div>
              <div>
                <label for="report-to" class="sr-only">To date</label>
                <input id="report-to" v-model="dateTo" type="date" :class="inputClass" @input="onDateEdit" />
              </div>
            </div>
          </div>

          <p v-if="notice && !generated" :role="notice.type === 'error' ? 'alert' : 'status'" :class="noticeClass[notice.type]">
            {{ notice.text }}
          </p>

          <button type="button" :disabled="generating" :class="primaryButtonClass" @click="generate">
            <span
              v-if="generating"
              class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
            />
            <RefreshCw v-else :size="16" />
            {{ generating ? 'Generating...' : generated ? 'Refresh report' : 'Generate report' }}
          </button>
        </div>
      </section>

      <!-- Empty state -->
      <section v-if="!generated" :class="[cardClass, 'p-8 text-center']">
        <span class="w-10 h-10 mx-auto flex items-center justify-center rounded-full bg-brand-navy/5 text-brand-navy">
          <ListChecks :size="18" />
        </span>
        <p class="font-heading font-bold text-brand-navy mt-3">No report yet</p>
        <p class="font-body text-sm text-brand-navy/60 mt-1 max-w-sm mx-auto">
          Choose a report type and date range, then generate it to see the summary and results here.
        </p>
      </section>

      <!-- Report -->
      <template v-else>
        <!-- Summary -->
        <div
          class="grid gap-3"
          :class="summary.length > 5 ? 'grid-cols-3 lg:grid-cols-6' : summary.length === 5 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4'"
        >
          <div
            v-for="tile in summary"
            :key="tile.label"
            class="rounded-2xl p-3 sm:p-4 text-center shadow-[0_14px_32px_-14px_rgba(35,43,77,0.4)]"
            :class="tile.classes"
          >
            <p class="font-heading font-bold text-2xl leading-none">{{ tile.value }}</p>
            <p class="font-body text-xs font-semibold mt-1.5">{{ tile.label }}</p>
          </div>
        </div>

        <p v-if="stale" role="status" class="font-body text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          The date range changed. Select "Refresh report" to update these results.
        </p>
        <p v-if="truncated" role="status" class="font-body text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
          This report is limited to the most recent 10,000 rows. Narrow the date range to see everything.
        </p>

        <!-- Filters, columns and export -->
        <section :class="cardClass">
          <div :class="sectionHeadClass">
            <span :class="iconBubbleClass"><SlidersHorizontal :size="16" /></span>
            <h3 class="font-heading font-bold text-brand-navy text-sm flex-1">
              {{ typeLabel }} report
              <span class="font-body font-normal text-brand-navy/50">
                · {{ plural(filteredRows.length, 'row') }}
              </span>
            </h3>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 font-body text-xs font-semibold text-brand-navy/70 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40"
              :aria-expanded="showFilters"
              @click="showFilters = !showFilters"
            >
              <SlidersHorizontal :size="14" />
              Filters
              <span
                v-if="activeFilterCount"
                class="min-w-[1.25rem] h-5 px-1 rounded-full bg-brand-navy text-white text-[11px] flex items-center justify-center"
              >
                {{ activeFilterCount }}
              </span>
            </button>
          </div>

          <div v-if="showFilters" class="p-4 border-b border-gray-100 space-y-4">
            <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div class="relative sm:col-span-2 lg:col-span-1">
                <label for="report-search" :class="labelClass">Search</label>
                <Search :size="16" class="absolute left-4 bottom-[0.95rem] text-brand-navy/35" />
                <input
                  id="report-search"
                  v-model="search"
                  type="search"
                  autocomplete="off"
                  :placeholder="type === 'posts' ? 'Title or author' : type === 'activity' ? 'User or details' : 'Name or email'"
                  :class="[inputClass, 'pl-10']"
                />
              </div>

              <template v-if="type === 'users'">
                <div>
                  <label for="f-user-status" :class="labelClass">Status</label>
                  <select id="f-user-status" v-model="fUserStatus" :class="inputClass">
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Deactivated</option>
                  </select>
                </div>
                <div>
                  <label for="f-role" :class="labelClass">Role</label>
                  <select id="f-role" v-model="fRole" :class="inputClass">
                    <option value="all">All</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              </template>

              <template v-else-if="type === 'posts'">
                <div>
                  <label for="f-post-status" :class="labelClass">Status</label>
                  <select id="f-post-status" v-model="fPostStatus" :class="inputClass">
                    <option value="all">All</option>
                    <option v-for="s in POST_STATUSES" :key="s.key" :value="s.key">{{ s.singular }}</option>
                  </select>
                </div>
                <div>
                  <label for="f-platform" :class="labelClass">Platform</label>
                  <select id="f-platform" v-model="fPlatform" :class="inputClass">
                    <option value="all">All</option>
                    <option v-for="name in platformOptions" :key="name" :value="name">{{ name }}</option>
                  </select>
                </div>
              </template>

              <template v-else>
                <div class="sm:col-span-2 lg:col-span-1">
                  <label for="f-action" :class="labelClass">Action</label>
                  <select id="f-action" v-model="fAction" :class="inputClass">
                    <option value="all">All actions</option>
                    <option v-for="(meta, key) in ACTIONS" :key="key" :value="key">{{ meta.label }}</option>
                  </select>
                </div>
              </template>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <div class="relative">
                <button
                  type="button"
                  :class="outlineButtonClass"
                  :aria-expanded="showColumns"
                  @click="showColumns = !showColumns"
                >
                  <ListChecks :size="16" />
                  Columns
                  <span class="font-normal text-brand-navy/50">
                    {{ visibleColumns.length }}/{{ columnOptions.length }}
                  </span>
                </button>

                <div
                  v-if="showColumns"
                  class="absolute left-0 top-full mt-2 z-20 w-64 max-h-72 overflow-y-auto rounded-2xl bg-white p-2 shadow-[0_20px_44px_-14px_rgba(35,43,77,0.5)] ring-1 ring-gray-100"
                >
                  <label
                    v-for="col in columnOptions"
                    :key="col.key"
                    class="flex items-center gap-3 rounded-xl px-3 py-2 font-body text-sm text-brand-navy cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      class="w-4 h-4 rounded border-gray-300 accent-[#4E63B0]"
                      :checked="selectedColumns[type].includes(col.key)"
                      @change="toggleColumn(col.key)"
                    />
                    {{ col.label }}
                  </label>
                </div>
              </div>

              <button
                v-if="activeFilterCount"
                type="button"
                class="rounded-full px-3 py-2 font-body text-sm font-semibold text-brand-indigo hover:underline underline-offset-2"
                @click="resetFilters"
              >
                Clear filters
              </button>
            </div>
          </div>

          <!-- Export -->
          <div class="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <p class="font-body text-sm text-brand-navy/70 flex-1">
              Exports the
              <span class="font-semibold text-brand-navy">{{ plural(filteredRows.length, 'row') }}</span>
              and
              <span class="font-semibold text-brand-navy">{{ plural(visibleColumns.length, 'column') }}</span>
              you see below, with your filters applied.
            </p>
            <div class="flex gap-2">
              <button
                type="button"
                :disabled="!filteredRows.length"
                :class="[outlineButtonClass, 'flex-1 sm:flex-none']"
                @click="exportCsv"
              >
                <FileSpreadsheet :size="16" />
                CSV
              </button>
              <button
                type="button"
                :disabled="!filteredRows.length || exportingPdf"
                :class="[outlineButtonClass, 'flex-1 sm:flex-none']"
                @click="exportPdfFile"
              >
                <span
                  v-if="exportingPdf"
                  class="w-4 h-4 rounded-full border-2 border-brand-navy/20 border-t-brand-navy animate-spin"
                />
                <FileText v-else :size="16" />
                PDF
              </button>
            </div>
          </div>

          <div v-if="notice && generated" class="px-4 pb-4">
            <p :role="notice.type === 'error' ? 'alert' : 'status'" :class="noticeClass[notice.type]">
              {{ notice.text }}
            </p>
          </div>
        </section>

        <!-- Results -->
        <section :class="[cardClass, 'overflow-hidden']">
          <div v-if="!filteredRows.length" class="p-8 text-center">
            <p class="font-heading font-bold text-brand-navy">No results</p>
            <p class="font-body text-sm text-brand-navy/60 mt-1">
              Nothing matches this period and these filters. Try a wider date range or clear a filter.
            </p>
          </div>

          <template v-else>
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="border-b border-gray-100">
                    <th
                      v-for="col in visibleColumns"
                      :key="col.key"
                      scope="col"
                      class="px-4 py-3 whitespace-nowrap font-body text-[11px] font-semibold uppercase tracking-wider text-brand-navy/50"
                      :class="col.align === 'right' ? 'text-right' : ''"
                    >
                      {{ col.label }}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in pageRows" :key="row.id" class="border-b border-gray-100 last:border-b-0 align-top">
                    <td
                      v-for="col in visibleColumns"
                      :key="col.key"
                      class="px-4 py-3 font-body text-sm text-brand-navy"
                      :class="[col.align === 'right' ? 'text-right' : '', col.wide ? 'min-w-[14rem] max-w-xs' : 'whitespace-nowrap']"
                    >
                      <span v-if="col.chip" :class="[chipBase, col.chip(row)]">{{ col.get(row) }}</span>
                      <span v-else :class="col.wide ? 'line-clamp-2 break-words' : ''">{{ col.get(row) || '—' }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-gray-100">
              <p class="font-body text-xs text-brand-navy/60">
                Showing {{ (page - 1) * PAGE_SIZE + 1 }}–{{ Math.min(page * PAGE_SIZE, filteredRows.length) }}
                of {{ filteredRows.length }}
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
      </template>
    </div>
  </AdminShell>
</template>
