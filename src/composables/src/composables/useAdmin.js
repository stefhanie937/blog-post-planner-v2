import { ref, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'

// Data layer for the admin pages. Everything here is read through RLS
// policies / security-definer functions created by supabase/admin-setup.sql,
// so a non-admin who calls any of it simply gets an error back.

const PAGE_SIZE = 1000 // Supabase returns at most 1000 rows per request
const MAX_ROWS = 10000 // safety cap for report downloads

const users = ref([])
const usersLoading = ref(false)
const usersLoaded = ref(false)
let usersPromise = null

const userMap = computed(() => new Map(users.value.map((u) => [u.id, u])))

function normalizeUser(row) {
  return {
    id: row.id,
    email: row.email ?? '',
    firstName: row.first_name ?? '',
    lastName: row.last_name ?? '',
    role: row.role ?? 'user',
    isActive: row.is_active !== false,
    createdAt: row.created_at ?? null,
    lastSignInAt: row.last_sign_in_at ?? null,
    postCount: Number(row.post_count ?? 0)
  }
}

// Pulls every page of a query (1000 rows at a time, up to MAX_ROWS).
async function fetchAll(makeQuery) {
  const rows = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await makeQuery(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return { rows, truncated: false }
  }
  return { rows, truncated: true }
}

async function loadUsers({ force = false } = {}) {
  if (usersLoaded.value && !force) return users.value
  if (usersPromise) return usersPromise

  usersLoading.value = true
  usersPromise = (async () => {
    try {
      const { rows } = await fetchAll((from, to) => supabase.rpc('admin_users').range(from, to))
      users.value = rows.map(normalizeUser)
      usersLoaded.value = true
      return users.value
    } finally {
      usersLoading.value = false
      usersPromise = null
    }
  })()
  return usersPromise
}

async function setUserActive(userId, active) {
  const { error } = await supabase.rpc('admin_set_user_active', {
    p_user_id: userId,
    p_active: active
  })
  if (error) throw error

  const match = users.value.find((u) => u.id === userId)
  if (match) match.isActive = active
}

async function fetchSummary(timeZone = 'UTC') {
  let result = await supabase.rpc('admin_summary', { p_days: 7, p_tz: timeZone })
  if (result.error && /time ?zone/i.test(result.error.message || '')) {
    result = await supabase.rpc('admin_summary', { p_days: 7, p_tz: 'UTC' })
  }
  if (result.error) throw result.error
  return result.data
}

const ACTIVITY_COLUMNS = 'id, user_id, action, entity_type, entity_id, details, created_at'

async function fetchRecentActivity(limit = 8) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select(ACTIVITY_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

async function fetchUserActivity(userId, limit = 8) {
  const { data, error } = await supabase
    .from('activity_logs')
    .select(ACTIVITY_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// range = { from: ISO string | null, to: ISO string | null (exclusive) }
function applyRange(query, range) {
  let next = query
  if (range?.from) next = next.gte('created_at', range.from)
  if (range?.to) next = next.lt('created_at', range.to)
  return next
}

function fetchPostsReport(range) {
  return fetchAll((from, to) =>
    applyRange(
      supabase
        .from('posts')
        .select('id, user_id, title, body, hashtags, images, platforms, status, scheduled_for, created_at')
        .order('created_at', { ascending: false })
        .order('id'),
      range
    ).range(from, to)
  )
}

function fetchActivityReport(range) {
  return fetchAll((from, to) =>
    applyRange(
      supabase
        .from('activity_logs')
        .select(ACTIVITY_COLUMNS)
        .order('created_at', { ascending: false })
        .order('id'),
      range
    ).range(from, to)
  )
}

// Forget everything cached (used when signing in / out of the admin side).
function resetAdminData() {
  users.value = []
  usersLoaded.value = false
  usersPromise = null
}

export function useAdmin() {
  return {
    users,
    userMap,
    usersLoading,
    loadUsers,
    setUserActive,
    fetchSummary,
    fetchRecentActivity,
    fetchUserActivity,
    fetchPostsReport,
    fetchActivityReport,
    resetAdminData
  }
}
