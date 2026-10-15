import { ref } from 'vue'
import { supabase } from '../lib/supabaseClient'

// Module-level state so every component sharing this composable sees the
// same list (same singleton pattern as useAuth.js).
const posts = ref([])
const loading = ref(true)
const refreshing = ref(false)
let initialized = false
let inflight = null // the fetch currently running, shared by every caller
let generation = 0 // bumped on reset so a late response can't repopulate the list

// The UI expects camelCase (createdAt, scheduledFor); Postgres/Supabase
// returns snake_case columns. This is the one place that translates.
function mapRow(row) {
  return {
    ...row,
    createdAt: row.created_at,
    scheduledFor: row.scheduled_for
  }
}

// Turns a public image URL back into its storage path inside the bucket.
export function storagePathFromUrl(url) {
  const marker = '/post-images/'
  const index = typeof url === 'string' ? url.indexOf(marker) : -1
  if (index === -1) return null
  return decodeURIComponent(url.slice(index + marker.length).split('?')[0])
}

async function loadPosts(isRefresh) {
  const startedIn = generation
  if (isRefresh) refreshing.value = true
  else loading.value = true

  const { data, error } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })

  loading.value = false
  refreshing.value = false

  if (error) {
    // eslint-disable-next-line no-console
    console.error('[usePosts] fetchPosts failed:', error.message)
    return false
  }

  // The user signed out (or switched accounts) while this request was running.
  if (startedIn !== generation) return false

  posts.value = data.map(mapRow)
  initialized = true
  return true
}

// Safe to call from several places at once: callers share one request.
// Resolves to true on success, false on failure.
function fetchPosts({ force = false } = {}) {
  if (inflight) return inflight
  if (initialized && !force) return Promise.resolve(true)

  const request = loadPosts(initialized).finally(() => {
    if (inflight === request) inflight = null
  })
  inflight = request
  return request
}

function toRow(post) {
  return {
    title: post.title,
    body: post.body,
    hashtags: post.hashtags ?? [],
    images: post.images ?? [],
    platforms: post.platforms ?? [],
    status: post.status ?? 'draft',
    scheduled_for: post.scheduledFor ?? null
  }
}

async function addPost(post) {
  const {
    data: { user }
  } = await supabase.auth.getUser()
  if (!user) throw new Error('You must be logged in to save a post.')

  const { data, error } = await supabase
    .from('posts')
    .insert({ user_id: user.id, ...toRow(post) })
    .select()
    .single()

  if (error) throw error

  posts.value = [mapRow(data), ...posts.value]
  return data
}

async function updatePost(id, post) {
  const { data, error } = await supabase
    .from('posts')
    .update(toRow(post))
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  posts.value = posts.value.map((p) => (p.id === id ? mapRow(data) : p))
  return data
}

async function updatePostStatus(id, status) {
  const post = posts.value.find((p) => p.id === id)
  if (!post) return false
  const previousStatus = post.status
  post.status = status // optimistic

  const { error } = await supabase.from('posts').update({ status }).eq('id', id)
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[usePosts] updatePostStatus failed:', error.message)
    post.status = previousStatus // roll back
    return false
  }
  return true
}

async function removePost(id) {
  const target = posts.value.find((p) => p.id === id)
  const snapshot = posts.value
  posts.value = posts.value.filter((p) => p.id !== id) // optimistic

  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) {
    // eslint-disable-next-line no-console
    console.error('[usePosts] removePost failed:', error.message)
    posts.value = snapshot // roll back
    return false
  }

  // Best-effort: don't leave the deleted post's photos behind in storage.
  const paths = (target?.images ?? []).map(storagePathFromUrl).filter(Boolean)
  if (paths.length) {
    supabase.storage
      .from('post-images')
      .remove(paths)
      .catch(() => {})
  }
  return true
}

function resetPosts() {
  generation += 1
  inflight = null
  initialized = false
  posts.value = []
  // Show the loading skeleton (not a flash of "No posts yet") for the next user.
  loading.value = true
  refreshing.value = false
}

export function usePosts() {
  return {
    posts,
    loading,
    refreshing,
    fetchPosts,
    addPost,
    updatePost,
    updatePostStatus,
    removePost,
    resetPosts
  }
}