<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { LayoutDashboard, Users, FileText, LogOut } from 'lucide-vue-next'
import logoMark from '../assets/logo-mark.png'
import { useAuth } from '../composables/useAuth'
import { useAdmin } from '../composables/useAdmin'
import { fullName } from '../utils/adminUtils'

defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' }
})

const route = useRoute()
const router = useRouter()
const { user, profile, signOut } = useAuth()
const { resetAdminData } = useAdmin()

const NAV = [
  { name: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { name: 'admin-users', label: 'Users', icon: Users },
  { name: 'admin-reports', label: 'Reports', icon: FileText }
]

const adminName = computed(() => {
  const p = profile.value
  if (p) return fullName({ firstName: p.first_name, lastName: p.last_name, email: p.email })
  return user.value?.email ?? 'Admin'
})

const loggingOut = ref(false)
const logoutError = ref('')

async function handleLogout() {
  loggingOut.value = true
  logoutError.value = ''
  try {
    await signOut()
    resetAdminData()
    router.push({ name: 'admin-login' })
  } catch (err) {
    logoutError.value = err.message || "Couldn't log out. Please try again."
  } finally {
    loggingOut.value = false
  }
}

const navLinkBase =
  'flex items-center justify-center gap-2 font-body font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50'
</script>

<template>
  <div class="min-h-screen bg-brand-bg">
    <header class="sticky top-0 z-30 bg-brand-navy/95 backdrop-blur ring-1 ring-white/10">
      <div class="max-w-6xl mx-auto w-full px-4 sm:px-6 h-14 sm:h-16 flex items-center gap-3">
        <img :src="logoMark" alt="" class="h-7 sm:h-8 drop-shadow" />
        <span class="font-heading font-bold text-white text-lg sm:text-xl tracking-tight">Post Planner</span>
        <span
          class="rounded-full bg-button-gradient text-white font-heading font-semibold text-[11px] px-2.5 py-0.5"
        >
          Admin
        </span>

        <nav class="hidden md:flex items-center gap-1 ml-6" aria-label="Admin">
          <router-link
            v-for="item in NAV"
            :key="item.name"
            :to="{ name: item.name }"
            :class="[
              navLinkBase,
              'rounded-full px-4 py-2',
              route.name === item.name ? 'bg-white/15 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
            ]"
          >
            <component :is="item.icon" :size="16" />
            {{ item.label }}
          </router-link>
        </nav>

        <div class="ml-auto flex items-center gap-3 min-w-0">
          <span class="hidden sm:block font-body text-sm text-white/75 truncate max-w-[14rem]">
            {{ adminName }}
          </span>
          <button
            type="button"
            :disabled="loggingOut"
            class="flex items-center justify-center gap-2 rounded-full border border-white/40 text-white font-body font-semibold text-sm px-3.5 py-2 transition-colors hover:bg-white/10 disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            aria-label="Log out"
            @click="handleLogout"
          >
            <span
              v-if="loggingOut"
              class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
            />
            <LogOut v-else :size="16" />
            <span class="hidden sm:inline">{{ loggingOut ? 'Logging out...' : 'Log Out' }}</span>
          </button>
        </div>
      </div>

      <!-- Phone / tablet navigation -->
      <nav class="md:hidden grid grid-cols-3 border-t border-white/10" aria-label="Admin">
        <router-link
          v-for="item in NAV"
          :key="item.name"
          :to="{ name: item.name }"
          :class="[
            navLinkBase,
            'py-3 border-b-2',
            route.name === item.name ? 'text-white border-brand-coral' : 'text-white/60 border-transparent'
          ]"
        >
          <component :is="item.icon" :size="16" />
          {{ item.label }}
        </router-link>
      </nav>
    </header>

    <main class="max-w-6xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8">
      <p
        v-if="logoutError"
        role="alert"
        class="mb-4 font-body text-sm text-rose-50 bg-rose-500/15 border border-rose-400/30 rounded-lg px-3 py-2 text-center"
      >
        {{ logoutError }}
      </p>

      <div class="flex flex-wrap items-end justify-between gap-3 mb-5 sm:mb-6">
        <div class="min-w-0">
          <h1 class="font-heading font-bold text-white text-2xl sm:text-[28px] tracking-tight">{{ title }}</h1>
          <p v-if="subtitle" class="font-body text-sm text-white/75 mt-1">{{ subtitle }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <slot name="actions" />
        </div>
      </div>

      <slot />
    </main>
  </div>
</template>
