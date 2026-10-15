<script setup>
import logoMark from '../assets/logo-mark.png'

defineProps({
  subtitle: {
    type: String,
    default: ''
  }
})
</script>

<template>
  <div
    class="min-h-screen relative overflow-hidden flex items-center justify-center p-4 sm:p-6 md:p-8 bg-[radial-gradient(130%_130%_at_50%_-10%,_#4467BB_0%,_#232B4D_100%)]"
  >
    <!-- Ambient glow: quieter and softer than a literal decorative blob -->
    <div class="pointer-events-none absolute -top-28 -left-28 w-80 h-80 sm:w-[26rem] sm:h-[26rem] rounded-full bg-brand-coral/20 blur-[100px]"></div>
    <div class="pointer-events-none absolute -bottom-32 -right-24 w-80 h-80 sm:w-[30rem] sm:h-[30rem] rounded-full bg-brand-indigo/25 blur-[110px]"></div>

    <div class="relative z-10 w-full max-w-[380px] sm:max-w-[400px] md:max-w-[420px] animate-panel-in">
      <div class="relative overflow-hidden bg-panel-gradient rounded-3xl ring-1 ring-white/10 shadow-[0_30px_70px_-20px_rgba(35,43,77,0.55)] px-6 py-8 sm:px-9 sm:py-11 md:py-12">
        <!-- Soft glass sheen, purely decorative -->
        <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-transparent"></div>

        <div class="relative flex flex-col items-center mb-2">
          <img :src="logoMark" alt="Post Planner logo" class="h-9 sm:h-10 md:h-11 mb-2 drop-shadow" />
          <h1 class="font-heading font-bold text-white text-2xl sm:text-[28px] tracking-tight text-center">
            Post Planner
          </h1>
          <p
            v-if="subtitle"
            class="font-body font-medium text-white/75 text-sm sm:text-[15px] mt-2 text-center leading-snug"
          >
            {{ subtitle }}
          </p>
        </div>

        <div class="relative mt-7 sm:mt-8">
          <slot />
        </div>
      </div>
    </div>
  </div>
</template>
