<script setup>
import { ref, computed, onMounted } from 'vue'
import { FileText, LayoutGrid, Globe, Activity, Clock, RefreshCw } from 'lucide-vue-next'
import AdminShell from '../../layouts/AdminShell.vue'
import { useAdmin } from '../../composables/useAdmin'
import {
  cardClass,
  sectionHeadClass,
  iconBubbleClass,
  primaryButtonClass,
  outlineButtonClass,
  chipBase,
  POST_STATUSES,
  fullName,
  initialsOf,
  plural,
  actionLabel,
  actionTone,
  describeDetails,
  formatShortDateTime
} from '../../utils/adminUtils'

const { userMap, loadUsers, fetchSummary, fetchRecentActivity } = useAdmin()

const summary = ref(null)
const recent = ref([])
const loading = ref(true)
const failed = ref('')

async function load() {
  loading.value = true
  failed.value = ''
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
    const [data, logs] = await Promise.all([
      fetchSummary(timeZone),
      fetchRecentActivity(8),
      loadUsers({ force: true })
    ])
    summary.value = data
    recent.value = logs
  } catch (err) {
    failed.value = err.message || "Couldn't load the dashboard."
  } finally {
    loading.value = false
  }
}

onMounted(load)

const num = (value) => Number(value ?? 0)

const days = computed(() =>
  (summary.value?.activity_by_day ?? []).map((d) => ({
    count: num(d.count),
    label: new Date(`${d.day}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short' })
  }))
)
const daysMax = computed(() => Math.max(1, ...days.value.map((d) => d.count)))
const weekTotal = computed(() => days.value.reduce((sum, d) => sum + d.count, 0))

const tiles = computed(() => {
  const s = summary.value
  if (!s) return []
  return [
    {
      label: 'Total users',
      value: num(s.users_total),
      note: `${num(s.new_users)} new in the last 7 days`,
      classes: 'bg-brand-navy text-white'
    },
    {
      label: 'Active users',
      value: num(s.users_active),
      note: `${num(s.users_total) - num(s.users_active)} deactivated`,
      classes: 'bg-emerald-50 text-emerald-700'
    },
    {
      label: 'Total posts',
      value: num(s.posts_total),
      note: `${num(s.posts_this_month)} created this month`,
      classes: 'bg-brand-indigo/10 text-brand-indigo'
    },
    {
      label: 'Activity this week',
      value: weekTotal.value,
      note: 'Logins, sign-ups and post changes',
      classes: 'bg-amber-50 text-amber-700'
    }
  ]
})

const statusRows = computed(() =>
  POST_STATUSES.map((s) => ({ ...s, count: num(summary.value?.posts_by_status?.[s.key]) }))
)
const statusMax = computed(() => Math.max(1, ...statusRows.value.map((r) => r.count)))

const platformRows = computed(() =>
  Object.entries(summary.value?.posts_by_platform ?? {})
    .map(([name, count]) => ({ name, count: num(count) }))
    .sort((a, b) => b.count - a.count)
)
const platformMax = computed(() => Math.max(1, ...platformRows.value.map((r) => r.count)))

function actorOf(log) {
  return userMap.value.get(log.user_id)
}
</script>

<template>
  <AdminShell title="Dashboard" subtitle="A quick look at users, posts and recent activity.">
    <template #actions>
      <button type="button" :disabled="loading" :class="outlineButtonClass" @click="load">
        <RefreshCw :size="16" :class="loading ? 'animate-spin' : ''" />
        Refresh
      </button>
      <router-link :to="{ name: 'admin-reports' }" :class="primaryButtonClass">
        <FileText :size="16" />
        Request report
      </router-link>
    </template>

    <!-- Loading -->
    <div v-if="loading && !summary" class="space-y-4">
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div v-for="n in 4" :key="n" class="h-28 rounded-2xl bg-white/20 animate-pulse" />
      </div>
      <div class="grid lg:grid-cols-3 gap-4">
        <div v-for="n in 3" :key="n" class="h-56 rounded-2xl bg-white/20 animate-pulse" />
      </div>
    </div>

    <!-- Error -->
    <section v-else-if="failed && !summary" :class="[cardClass, 'p-6 text-center max-w-md mx-auto']">
      <p class="font-body text-sm text-brand-navy/70">{{ failed }}</p>
      <button type="button" :class="[outlineButtonClass, 'mt-4']" @click="load">Retry</button>
    </section>

    <div v-else class="space-y-4">
      <!-- Headline numbers -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          v-for="(tile, index) in tiles"
          :key="tile.label"
          class="rounded-2xl p-4 shadow-[0_14px_32px_-14px_rgba(35,43,77,0.4)] animate-card-in"
          :class="tile.classes"
          :style="{ animationDelay: `${index * 50}ms` }"
        >
          <p class="font-heading font-bold text-3xl leading-none">{{ tile.value }}</p>
          <p class="font-body text-sm font-semibold mt-2">{{ tile.label }}</p>
          <p class="font-body text-xs mt-1 opacity-70">{{ tile.note }}</p>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-4">
        <!-- Posts by status -->
        <section :class="cardClass" :style="{ animationDelay: '120ms' }">
          <div :class="sectionHeadClass">
            <span :class="iconBubbleClass"><LayoutGrid :size="16" /></span>
            <h3 class="font-heading font-bold text-brand-navy text-sm flex-1">Posts by status</h3>
          </div>
          <ul class="p-4 space-y-3">
            <li v-for="row in statusRows" :key="row.key">
              <div class="flex items-center justify-between mb-1">
                <span class="font-body text-sm text-brand-navy/70">{{ row.singular }}</span>
                <span class="font-body text-sm font-semibold text-brand-navy">{{ row.count }}</span>
              </div>
              <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="row.bar"
                  :style="{ width: `${(row.count / statusMax) * 100}%` }"
                />
              </div>
            </li>
          </ul>
        </section>

        <!-- Top platforms -->
        <section :class="cardClass" :style="{ animationDelay: '180ms' }">
          <div :class="sectionHeadClass">
            <span :class="iconBubbleClass"><Globe :size="16" /></span>
            <h3 class="font-heading font-bold text-brand-navy text-sm flex-1">Most used platforms</h3>
          </div>
          <div class="p-4">
            <p v-if="!platformRows.length" class="font-body text-sm text-brand-navy/60">
              No posts have a platform yet.
            </p>
            <ul v-else class="space-y-3">
              <li v-for="row in platformRows" :key="row.name">
                <div class="flex items-center justify-between mb-1 gap-3">
                  <span class="font-body text-sm text-brand-navy/70 truncate">{{ row.name }}</span>
                  <span class="font-body text-sm font-semibold text-brand-navy">{{ row.count }}</span>
                </div>
                <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    class="h-full rounded-full bg-button-gradient transition-all duration-500"
                    :style="{ width: `${(row.count / platformMax) * 100}%` }"
                  />
                </div>
              </li>
            </ul>
          </div>
        </section>

        <!-- Activity, last 7 days -->
        <section :class="cardClass" :style="{ animationDelay: '240ms' }">
          <div :class="sectionHeadClass">
            <span :class="iconBubbleClass"><Activity :size="16" /></span>
            <h3 class="font-heading font-bold text-brand-navy text-sm flex-1">Activity, last 7 days</h3>
            <span class="font-body text-xs text-brand-navy/50">{{ plural(weekTotal, 'event') }}</span>
          </div>
          <div class="p-4">
            <div class="h-36 flex items-end gap-2">
              <div v-for="(day, index) in days" :key="index" class="flex-1 h-full flex flex-col justify-end items-center gap-1">
                <span class="font-body text-[11px] font-semibold text-brand-navy/60">{{ day.count }}</span>
                <div
                  class="w-full rounded-t-lg bg-button-gradient transition-all duration-500"
                  :style="{ height: day.count ? `${Math.max((day.count / daysMax) * 100, 6)}%` : '2px', opacity: day.count ? 1 : 0.25 }"
                />
              </div>
            </div>
            <div class="flex gap-2 mt-2">
              <span
                v-for="(day, index) in days"
                :key="index"
                class="flex-1 text-center font-body text-[11px] text-brand-navy/50"
              >
                {{ day.label }}
              </span>
            </div>
          </div>
        </section>
      </div>

      <!-- Recent activity -->
      <section :class="cardClass" :style="{ animationDelay: '300ms' }">
        <div :class="sectionHeadClass">
          <span :class="iconBubbleClass"><Clock :size="16" /></span>
          <h3 class="font-heading font-bold text-brand-navy text-sm flex-1">Recent activity</h3>
          <router-link
            :to="{ name: 'admin-reports' }"
            class="font-body text-xs font-semibold text-brand-indigo hover:underline underline-offset-2"
          >
            Full activity report
          </router-link>
        </div>

        <p v-if="!recent.length" class="p-4 font-body text-sm text-brand-navy/60">
          Nothing has happened yet. Logins, sign-ups and post changes will show up here.
        </p>
        <ul v-else class="divide-y divide-gray-100">
          <li v-for="log in recent" :key="log.id" class="flex items-center gap-3 px-4 py-3">
            <span
              class="w-9 h-9 shrink-0 rounded-full bg-brand-navy text-white font-heading font-bold text-xs flex items-center justify-center select-none"
            >
              {{ initialsOf(actorOf(log)) }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="font-body text-sm text-brand-navy truncate">
                <span class="font-semibold">{{ fullName(actorOf(log)) }}</span>
                <span v-if="describeDetails(log)" class="text-brand-navy/60"> {{ describeDetails(log) }}</span>
              </p>
              <p class="font-body text-xs text-brand-navy/50">{{ formatShortDateTime(log.created_at) }}</p>
            </div>
            <span :class="[chipBase, actionTone(log.action), 'shrink-0']">{{ actionLabel(log.action) }}</span>
          </li>
        </ul>
      </section>
    </div>
  </AdminShell>
</template>
