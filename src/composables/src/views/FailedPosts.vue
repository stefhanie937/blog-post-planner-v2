<script setup>
import PostsList from '../components/PostsList.vue'
</script>

<template>
  <PostsList
    title="Failed Posts"
    :statuses="['failed']"
    empty-title="No failed posts"
    empty-body="Posts that failed to publish will show up here."
    primary-action-label="Retry (Move to Draft)"
    primary-action-status="draft"
  />
</template>