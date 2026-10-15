<script setup>
import PostsList from '../components/PostsList.vue'
</script>

<template>
  <PostsList
    title="Archived Posts"
    :statuses="['archived']"
    empty-title="No archived posts"
    empty-body="Posts you archive will show up here."
    primary-action-label="Restore to Draft"
    primary-action-status="draft"
  />
</template>