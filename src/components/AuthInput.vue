<script setup>
import { ref, computed } from 'vue'
import { Eye, EyeOff } from 'lucide-vue-next'

const props = defineProps({
  modelValue: { type: String, default: '' },
  type: { type: String, default: 'text' },
  placeholder: { type: String, default: '' },
  icon: { type: [Object, Function], default: null },
  togglePassword: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  minlength: { type: [String, Number], default: null },
  autocomplete: { type: String, default: 'off' }
})

defineEmits(['update:modelValue'])

const revealed = ref(false)
const resolvedType = computed(() => {
  if (!props.togglePassword) return props.type
  return revealed.value ? 'text' : 'password'
})
</script>

<template>
  <div
    class="w-full flex items-center gap-2.5 rounded-full border border-white/10 bg-brand-navy/30 px-4 sm:px-5 py-3 sm:py-3.5 backdrop-blur-md transition-colors focus-within:border-white/30 focus-within:bg-brand-navy/40 focus-within:ring-2 focus-within:ring-white/15"
  >
    <component :is="icon" v-if="icon" :size="18" class="text-white/70 shrink-0" />

    <input
      :value="modelValue"
      :type="resolvedType"
      :placeholder="placeholder"
      :aria-label="placeholder"
      :required="required"
      :minlength="minlength ?? undefined"
      :autocomplete="autocomplete"
      class="auth-field w-full min-w-0 bg-transparent outline-none text-base font-body text-white placeholder-white/55"      @input="$emit('update:modelValue', $event.target.value)"
    />

    <button
      v-if="togglePassword"
      type="button"
      class="shrink-0 rounded-full p-0.5 text-white/60 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
      tabindex="-1"
      :aria-label="revealed ? 'Hide password' : 'Show password'"
      @click="revealed = !revealed"
    >
      <EyeOff v-if="revealed" :size="18" />
      <Eye v-else :size="18" />
    </button>
  </div>
</template>

<style scoped>
input[type="password"]::-ms-reveal,
input[type="password"]::-ms-clear {
  display: none;
}
</style>