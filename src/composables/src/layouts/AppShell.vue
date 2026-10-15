<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  Menu,
  X,
  LogOut,
  Feather,
  LayoutGrid,
  History,
  Archive,
  AlertCircle,
  Edit3,
  User
} from 'lucide-vue-next'
import { useAuth } from '../composables/useAuth'

defineProps({
  title: { type: String, required: true }
})

const router = useRouter()
const route = useRoute()
const { user, signOut } = useAuth()

const drawerOpen = ref(false)
const drawerNotice = ref('')

const navItems = [
  { label: 'Posts Composer', icon: Feather, routeName: 'composer' },
  { label: 'Posts', icon: LayoutGrid, routeName: 'dashboard' },
  { label: 'History', icon: History, routeName: 'history' },
  { label: 'Archived Posts', icon: Archive, routeName: 'archived' },
  { label: 'Failed Posts', icon: AlertCircle, routeName: 'failed' },
  { label: 'Drafts', icon: Edit3, routeName: 'drafts' },
  { label: 'Account', icon: User, routeName: 'account' }
]

function closeDrawer() {
  drawerOpen.value = false
}

function handleNavClick(item) {
  if (item.routeName) {
    if (item.routeName !== route.name) router.push({ name: item.routeName })
    closeDrawer()
    return
  }
  drawerNotice.value = `${item.label} is coming in a later phase.`
  setTimeout(() => {
    drawerNotice.value = ''
  }, 2200)
}

async function handleLogout() {
  await signOut()
  router.push('/login')
}
</script>

<template>
  <div class="min-h-screen flex flex-col relative overflow-hidden">
    <!-- Top bar -->
    <header class="sticky top-0 z-20 bg-white/90 backdrop-blur-md shadow-sm relative">
      <div class="mx-auto max-w-3xl px-4 sm:px-6 py-3 flex items-center justify-between">
        <button
          type="button"
          aria-label="Open menu"
          class="p-1.5 rounded-lg text-brand-navy transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-indigo/40"
          @click="drawerOpen = true"
        >
          <Menu :size="22" />
        </button>
        <h1 class="font-heading font-bold text-brand-navy text-lg tracking-tight">{{ title }}</h1>
        <div class="w-9 h-9 flex items-center justify-center">
          <slot name="header-action" />
        </div>
      </div>
      <div class="h-[3px] bg-gradient-to-r from-brand-coral via-brand-mauve to-brand-indigo" />
    </header>

    <!-- Sidebar drawer -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="drawerOpen" class="fixed inset-0 z-30 bg-black/40" @click="closeDrawer" />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-250 ease-out"
      enter-from-class="-translate-x-full"
      enter-to-class="translate-x-0"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-x-0"
      leave-to-class="-translate-x-full"
    >
      <div
        v-if="drawerOpen"
        class="fixed inset-y-0 left-0 z-30 w-72 max-w-[80vw] bg-white shadow-2xl flex flex-col p-5"
      >
        <div class="flex items-center justify-between mb-5">
          <span class="font-heading font-bold text-brand-navy text-lg">Post Planner</span>
          <button
            type="button"
            aria-label="Close menu"
            class="p-1.5 rounded-lg text-brand-navy/50 transition-colors hover:bg-gray-100"
            @click="closeDrawer"
          >
            <X :size="20" />
          </button>
        </div>

        <nav class="flex-1 space-y-1 overflow-y-auto">
          <button
            v-for="item in navItems"
            :key="item.label"
            type="button"
            class="w-full flex items-center gap-3 px-3 py-2.5 rounded-full transition-colors text-left"
            :class="item.routeName === route.name
              ? 'bg-gradient-to-r from-brand-coral/40 to-brand-indigo/40'
              : 'hover:bg-gray-50'"
            @click="handleNavClick(item)"
          >
            <span
              class="w-8 h-8 shrink-0 flex items-center justify-center rounded-full"
              :class="item.routeName === route.name ? 'bg-brand-navy text-white' : 'text-brand-navy/70'"
            >
              <component :is="item.icon" :size="16" />
            </span>
            <span
              class="font-body text-sm text-brand-navy"
              :class="item.routeName === route.name ? 'font-bold' : 'font-medium'"
            >
              {{ item.label }}
            </span>
          </button>
        </nav>

        <p
          v-if="drawerNotice"
          class="font-body text-xs text-brand-navy/60 bg-gray-50 rounded-lg px-3 py-2 text-center mb-3"
        >
          {{ drawerNotice }}
        </p>

        <div class="pt-3 border-t border-gray-100">
          <p class="font-body text-xs text-gray-400 mb-3 truncate">{{ user?.email }}</p>
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2 rounded-full bg-button-gradient text-white font-heading font-bold text-sm py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_30px_-10px_rgba(78,99,176,0.6)] transition duration-200 hover:brightness-110 active:scale-[0.985]"
            @click="handleLogout"
          >
            <LogOut :size="16" />
            Logout
          </button>
        </div>
      </div>
    </Transition>

    <!-- Content -->
    <main class="flex-1 relative bg-panel-gradient px-4 sm:px-6 py-6">
      <div class="pointer-events-none absolute -top-16 -left-16 w-64 h-64 rounded-full bg-white/10 blur-[90px]"></div>
      <div class="pointer-events-none absolute bottom-0 -right-16 w-72 h-72 rounded-full bg-brand-navy/15 blur-[100px]"></div>

      <div class="relative mx-auto max-w-3xl">
        <slot />
      </div>
    </main>
  </div>
</template>
