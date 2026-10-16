<script setup>
import { onMounted } from 'vue'
import { startReminders } from './composables/useReminders'

onMounted(startReminders)
</script>

<template>
  <router-view v-slot="{ Component, route }">
    <component :is="Component" :key="route.path" />
  </router-view>
</template>