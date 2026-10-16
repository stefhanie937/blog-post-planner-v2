<script setup>
import { ref, watch, computed, onUnmounted } from 'vue'
import { X, UserX, UserCheck } from 'lucide-vue-next'
import { useAuth } from '../../composables/useAuth'
import { useAdmin } from '../../composables/useAdmin'
import {
  fullName,
  initialsOf,
  formatDate,
  formatDateTime,
  formatShortDateTime,
  actionLabel,
  actionTone,
  describeDetails,
  labelClass,
  chipBase,
  statusChipClass,
  roleChipClass,
  outlineButtonClass,
  dangerButtonClass,
  primaryButtonClass
} from '../../utils/adminUtils'

const props = defineProps({
  user: { type: Object, default: null }
})
const emit = defineEmits(['close', 'toggle'])

const { user: me } = useAuth()
const { fetchUserActivity } = useAdmin()

const activity = ref([])
const loading = ref(false)
const failed = ref(false)

const canToggle = computed(
  () => !!props.user && props.user.role !== 'admin' && props.user.id !== me.value?.id
)

watch(
  () => props.user?.id,
  async (id) => {
    activity.value = []
    failed.value = false
    if (!id) return
    loading.value = true
    try {
      const rows = await fetchUserActivity(id, 8)
      if (props.user?.id === id) activity.value = rows
    } catch {
      if (props.user?.id === id) failed.value = true
    } finally {
      if (props.user?.id === id) loading.value = false
    }
  },
  { immediate: true }
)

function onKey(event) {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => !!props.user,
  (isOpen) => {
    if (isOpen) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
  { immediate: true }
)

onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="user"
      class="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-brand-navy/70 backdrop-blur-sm"
      @click.self="emit('close')"
    >
      <div
        role="dialog"
        aria-modal="true"
        :aria-label="`${fullName(user)} details`"
        class="relative w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-2xl shadow-[0_30px_70px_-20px_rgba(35,43,77,0.55)] animate-panel-in"
      >
        <div class="h-20 bg-button-gradient" />
        <button
          type="button"
          class="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/25 text-white transition-colors hover:bg-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          aria-label="Close"
          @click="emit('close')"
        >
          <X :size="16" />
        </button>

        <div class="px-4 pb-4 -mt-10 flex flex-col items-center text-center">
          <div
            class="w-20 h-20 rounded-full ring-4 ring-white shadow-lg flex items-center justify-center bg-brand-navy text-white font-heading font-bold text-2xl select-none"
          >
            {{ initialsOf(user) }}
          </div>
          <h2 class="font-heading font-bold text-brand-navy text-lg mt-3 break-words max-w-full">
            {{ fullName(user) }}
          </h2>
          <p class="font-body text-sm text-brand-navy/60 break-all">{{ user.email }}</p>
          <div class="flex flex-wrap justify-center gap-1.5 mt-3">
            <span :class="[chipBase, roleChipClass(user.role)]">
              {{ user.role === 'admin' ? 'Admin' : 'User' }}
            </span>
            <span :class="[chipBase, statusChipClass(user.isActive)]">
              {{ user.isActive ? 'Active' : 'Deactivated' }}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-3 border-y border-gray-100">
          <div class="px-3 py-3">
            <p :class="labelClass">Posts</p>
            <p class="font-heading font-bold text-brand-navy text-lg leading-none">{{ user.postCount }}</p>
          </div>
          <div class="px-3 py-3 border-l border-gray-100">
            <p :class="labelClass">Joined</p>
            <p class="font-body text-sm text-brand-navy">{{ formatDate(user.createdAt) }}</p>
          </div>
          <div class="px-3 py-3 border-l border-gray-100">
            <p :class="labelClass">Last sign-in</p>
            <p class="font-body text-sm text-brand-navy">{{ formatDateTime(user.lastSignInAt) }}</p>
          </div>
        </div>

        <div class="p-4">
          <h3 class="font-heading font-bold text-brand-navy text-sm mb-3">Recent activity</h3>

          <div v-if="loading" class="space-y-2">
            <div v-for="n in 3" :key="n" class="h-10 rounded-xl bg-gray-100 animate-pulse" />
          </div>
          <p v-else-if="failed" class="font-body text-sm text-rose-600">Couldn't load this user's activity.</p>
          <p v-else-if="!activity.length" class="font-body text-sm text-brand-navy/60">
            No activity recorded for this user yet.
          </p>
          <ul v-else class="space-y-2">
            <li
              v-for="log in activity"
              :key="log.id"
              class="flex items-start gap-3 rounded-xl bg-gray-50 px-3 py-2.5"
            >
              <span :class="[chipBase, actionTone(log.action), 'shrink-0']">{{ actionLabel(log.action) }}</span>
              <div class="min-w-0 flex-1">
                <p v-if="describeDetails(log)" class="font-body text-sm text-brand-navy break-words">
                  {{ describeDetails(log) }}
                </p>
                <p class="font-body text-xs text-brand-navy/50">{{ formatShortDateTime(log.created_at) }}</p>
              </div>
            </li>
          </ul>
        </div>

        <div class="px-4 pb-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" :class="outlineButtonClass" @click="emit('close')">Close</button>
          <button
            v-if="canToggle"
            type="button"
            :class="user.isActive ? dangerButtonClass : primaryButtonClass"
            @click="emit('toggle', user)"
          >
            <UserX v-if="user.isActive" :size="16" />
            <UserCheck v-else :size="16" />
            {{ user.isActive ? 'Deactivate account' : 'Activate account' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
