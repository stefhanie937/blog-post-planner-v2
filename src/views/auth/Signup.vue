<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../composables/useAuth'
import AuthShell from '../../layouts/AuthShell.vue'
import AuthInput from '../../components/AuthInput.vue'

const router = useRouter()
const { signUp, signInWithGoogle } = useAuth()

const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const googleLoading = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const passwordsMatch = computed(
  () => !confirmPassword.value || password.value === confirmPassword.value
)

async function handleSubmit() {
  errorMessage.value = ''
  successMessage.value = ''

  if (password.value !== confirmPassword.value) {
    errorMessage.value = 'Passwords do not match.'
    return
  }

  loading.value = true
  try {
    await signUp({
      firstName: firstName.value,
      lastName: lastName.value,
      email: email.value,
      password: password.value
    })
    successMessage.value = 'Account created. Check your email to confirm, then log in.'
    setTimeout(() => router.push('/login'), 2200)
  } catch (err) {
    errorMessage.value = err.message || 'Unable to create account. Please try again.'
  } finally {
    loading.value = false
  }
}

async function handleGoogleSignIn() {
  errorMessage.value = ''
  googleLoading.value = true
  try {
    await signInWithGoogle()
  } catch (err) {
    errorMessage.value = err.message || 'Unable to sign up with Google. Please try again.'
    googleLoading.value = false
  }
}
</script>

<template>
  <AuthShell subtitle="Let's Get Your Account Set Up">
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div class="flex gap-3">
        <div class="min-w-0 flex-1">
          <AuthInput v-model="firstName" placeholder="First Name" autocomplete="given-name" required />
        </div>
        <div class="min-w-0 flex-1">
          <AuthInput v-model="lastName" placeholder="Last Name" autocomplete="family-name" required />
        </div>
      </div>

      <AuthInput v-model="email" type="email" placeholder="Email" autocomplete="email" required />

      <AuthInput
        v-model="password"
        type="password"
        placeholder="Password"
        autocomplete="new-password"
        toggle-password
        required
        :minlength="6"
      />

      <div>
        <AuthInput
          v-model="confirmPassword"
          type="password"
          placeholder="Confirm Password"
          autocomplete="new-password"
          toggle-password
          required
        />
        <p v-if="!passwordsMatch" class="font-body text-[13px] text-rose-100/90 mt-1.5 pl-1">
          Passwords don't match yet.
        </p>
      </div>

      <p
        v-if="errorMessage"
        role="alert"
        class="font-body text-sm text-rose-50 bg-rose-500/15 border border-rose-400/30 rounded-lg px-3 py-2 text-center"
      >
        {{ errorMessage }}
      </p>
      <p
        v-if="successMessage"
        role="status"
        class="font-body text-sm text-emerald-50 bg-emerald-500/15 border border-emerald-400/30 rounded-lg px-3 py-2 text-center"
      >
        {{ successMessage }}
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
        {{ loading ? 'Creating account...' : 'Create Account' }}
      </button>
    </form>

    <div class="flex items-center gap-3 my-5">
      <div class="h-px flex-1 bg-white/15" />
      <span class="font-body text-xs text-white/50">or</span>
      <div class="h-px flex-1 bg-white/15" />
    </div>

    <button
      type="button"
      :disabled="googleLoading"
      @click="handleGoogleSignIn"
      class="w-full flex items-center justify-center gap-2 rounded-full bg-white text-slate-700 font-heading font-semibold tracking-tight py-3 sm:py-3.5 text-[15px] shadow-[0_10px_24px_-10px_rgba(0,0,0,0.35)] transition duration-200 hover:brightness-95 active:scale-[0.985] disabled:opacity-60 disabled:pointer-events-none"
    >
      <span
        v-if="googleLoading"
        class="w-4 h-4 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin"
      />
      <svg v-else class="w-4 h-4" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.66z"/>
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3a7.41 7.41 0 0 1-4.05 1.13c-3.11 0-5.75-2.1-6.69-4.92H1.3v3.09A12 12 0 0 0 12 24z"/>
        <path fill="#FBBC05" d="M5.31 14.3a7.2 7.2 0 0 1 0-4.6V6.61H1.3a12 12 0 0 0 0 10.78l4.01-3.09z"/>
        <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.3 6.61l4.01 3.09C6.25 6.86 8.89 4.75 12 4.75z"/>
      </svg>
      {{ googleLoading ? 'Redirecting...' : 'Continue with Google' }}
    </button>

    <p class="text-center font-body text-[11px] text-white/60 mt-5">
      By proceeding, you agree to our
      <a href="#" class="font-semibold text-white/90 hover:text-white underline underline-offset-2">Terms of Service</a>
    </p>

    <p class="text-center font-body text-sm text-white/75 mt-4">
      Already have an account?
      <router-link to="/login" class="font-semibold text-white hover:underline underline-offset-2">
        Log in
      </router-link>
    </p>
  </AuthShell>
</template>