<script setup>
import PostsList from '../components/PostsList.vue'
</script>

<template>
  <PostsList
    title="History"
    :statuses="['scheduled', 'published']"
    empty-title="No history yet"
    empty-body="Scheduled and published posts will show up here."
    primary-action-label="Archive"
    primary-action-status="archived"
  />
</template>