<script setup>
import { ref } from 'vue'
import { Mail } from 'lucide-vue-next'
import { supabase } from '../../lib/supabaseClient'
import AuthShell from '../../layouts/AuthShell.vue'
import AuthInput from '../../components/AuthInput.vue'

const email = ref('')
const sent = ref(false)
const errorMessage = ref('')
const loading = ref(false)

async function handleSubmit() {
  errorMessage.value = ''
  loading.value = true
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.value)
    if (error) throw error
    sent.value = true
  } catch (err) {
    errorMessage.value = err.message || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell subtitle="Reset Your Password">
    <template v-if="!sent">
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <AuthInput
          v-model="email"
          type="email"
          placeholder="Email"
          autocomplete="email"
          :icon="Mail"
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
          {{ loading ? 'Sending...' : 'Send Reset Link' }}
        </button>
      </form>
    </template>

    <p
      v-else
      role="status"
      class="font-body text-sm text-emerald-50 bg-emerald-500/15 border border-emerald-400/30 rounded-lg px-3 py-3 text-center"
    >
      If that email is registered, a reset link is on its way.
    </p>

    <p class="text-center font-body text-sm text-white/75 mt-6">
      <router-link to="/login" class="font-semibold text-white hover:underline underline-offset-2">
        Back to Log In
      </router-link>
    </p>
  </AuthShell>
</template>