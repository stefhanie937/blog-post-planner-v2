<script setup>
import PostsList from '../components/PostsList.vue'
</script>

<template>
  <PostsList
    title="Drafts"
    :statuses="['draft']"
    empty-title="No drafts yet"
    empty-body="Posts you save as drafts will show up here."
    primary-action-label="Archive"
    primary-action-status="archived"
  />
</template>