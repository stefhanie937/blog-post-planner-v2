<script setup>
import { watch, onUnmounted } from 'vue'
import { outlineButtonClass, primaryButtonClass, dangerButtonClass, noticeClass } from '../../utils/adminUtils'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  tone: { type: String, default: 'primary' }, // 'primary' | 'danger'
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' }
})
const emit = defineEmits(['confirm', 'cancel'])

function cancel() {
  if (!props.loading) emit('cancel')
}

function onKey(event) {
  if (event.key === 'Escape') cancel()
}

watch(
  () => props.open,
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
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-navy/70 backdrop-blur-sm"
      @click.self="cancel"
    >
      <div
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        class="w-full max-w-sm bg-white rounded-2xl shadow-[0_30px_70px_-20px_rgba(35,43,77,0.55)] p-5 animate-panel-in"
      >
        <h3 class="font-heading font-bold text-brand-navy text-lg">{{ title }}</h3>
        <p class="font-body text-sm text-brand-navy/70 mt-2 leading-relaxed">{{ message }}</p>

        <p v-if="error" role="alert" :class="[noticeClass.error, 'mt-3']">{{ error }}</p>

        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-5">
          <button type="button" :disabled="loading" :class="outlineButtonClass" @click="cancel">
            Cancel
          </button>
          <button
            type="button"
            :disabled="loading"
            :class="tone === 'danger' ? dangerButtonClass : primaryButtonClass"
            @click="emit('confirm')"
          >
            <span
              v-if="loading"
              class="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
            />
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
