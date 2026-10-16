<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Mail, Lock, ShieldCheck } from 'lucide-vue-next'
import { useAuth } from '../../composables/useAuth'
import { useAdmin } from '../../composables/useAdmin'
import AuthShell from '../../layouts/AuthShell.vue'
import AuthInput from '../../components/AuthInput.vue'

const route = useRoute()
const router = useRouter()
const { adminSignIn } = useAuth()
const { resetAdminData } = useAdmin()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMessage = ref(
  route.query.deactivated ? 'This account has been deactivated. Please contact an administrator.' : ''
)

onMounted(resetAdminData)

async function handleSubmit() {
  errorMessage.value = ''
  loading.value = true
  try {
    await adminSignIn({ email: email.value.trim(), password: password.value })
    router.push({ name: 'admin-dashboard' })
  } catch (err) {
    errorMessage.value = err.message || 'Unable to log in. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell subtitle="Admin portal">
    <div
      class="flex items-center justify-center gap-2 mb-5 rounded-full bg-white/10 px-3 py-1.5 mx-auto w-fit font-body text-xs font-medium text-white/85"
    >
      <ShieldCheck :size="14" />
      Authorized administrators only
    </div>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <AuthInput
        v-model="email"
        type="email"
        placeholder="Admin email"
        autocomplete="email"
        :icon="Mail"
        required
      />
      <AuthInput
        v-model="password"
        type="password"
        placeholder="Password"
        autocomplete="current-password"
        toggle-password
        :icon="Lock"
        required
      />

      <p
        v-if="errorMessage"
        role="alert"
        class="font-body text-sm text-rose-50 bg-rose-500/15 border border-rose-400/30 rounded-lg px-3 py-2 text-center"
      >
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        :disabled="loading"
        class="w-full flex items-center justify-center gap-2 rounded-full bg-button-gradient text-white font-heading font-semibold tracking-tight py-3 sm:py-3.5 text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_14px_30px_-10px_rgba(78,99,176,0.6)] transition duration-200 hover:brightness-110 active:scale-[0.985] disabled:opacity-60 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        <span
          v-if="loading"
          class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
        />
        {{ loading ? 'Logging in...' : 'Log In as Admin' }}
      </button>
    </form>

    <p class="text-center font-body text-sm text-white/75 mt-6">
      Not an admin?
      <router-link to="/login" class="font-semibold text-white hover:underline underline-offset-2">
        Go to user login
      </router-link>
    </p>
  </AuthShell>
</template>
