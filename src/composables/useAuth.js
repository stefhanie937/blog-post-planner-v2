import { ref, computed } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { usePosts } from './usePosts'

// Module-level state so every component sharing this composable
// sees the same session (simple singleton store).
const user = ref(null)
const profile = ref(null) // row from public.profiles (role, is_active, names)
const sessionLoaded = ref(false)
let initPromise = null
let profilePromise = null
let profileUserId = null

const DEACTIVATED_MESSAGE = 'This account has been deactivated. Please contact an administrator.'
const NOT_ADMIN_MESSAGE = "This account doesn't have admin access."

const isAdmin = computed(() => profile.value?.role === 'admin' && profile.value?.is_active !== false)

// One place that updates the user, so the posts list can never show another
// account's data (sign-out in another tab, expired session, switching accounts).
function applyUser(nextUser, event = '') {
  const switchedAccount = user.value && nextUser && user.value.id !== nextUser.id
  if (event === 'SIGNED_OUT' || switchedAccount) usePosts().resetPosts()
  if (!nextUser || switchedAccount) {
    profile.value = null
    profileUserId = null
    profilePromise = null
  }
  user.value = nextUser
}

// Supabase reports a banned (deactivated) account as "User is banned".
function friendlyAuthError(error) {
  if (/banned/i.test(error?.message || '')) return new Error(DEACTIVATED_MESSAGE)
  return error
}

// Safe to call many times (the router guard can fire it more than once at startup).
function initAuth() {
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        user.value = data.session?.user ?? null
      } catch {
        user.value = null
      }
      sessionLoaded.value = true

      supabase.auth.onAuthStateChange((event, session) => {
        applyUser(session?.user ?? null, event)
      })
    })()
  }
  return initPromise
}

// Loads the signed-in user's row from public.profiles (cached per account).
// Resolves to null when there is no session or the lookup fails.
async function loadProfile({ force = false } = {}) {
  const current = user.value
  if (!current) {
    profile.value = null
    return null
  }
  if (!force && profile.value && profile.value.id === current.id) return profile.value
  if (!force && profilePromise && profileUserId === current.id) return profilePromise

  profileUserId = current.id
  const request = (async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, first_name, last_name, role, is_active')
        .eq('id', current.id)
        .maybeSingle()
      if (error) throw error
      if (user.value?.id === current.id) profile.value = data ?? null
      return data ?? null
    } catch {
      if (user.value?.id === current.id) profile.value = null
      return null
    } finally {
      if (profilePromise === request) profilePromise = null
    }
  })()
  profilePromise = request
  return request
}

async function signUp({ firstName, lastName, email, password }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName
      }
    }
  })
  if (error) throw error
  return data
}

async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw friendlyAuthError(error)
  applyUser(data.user)

  // Deactivated accounts are turned away right here.
  const current = await loadProfile({ force: true })
  if (current && current.is_active === false) {
    await supabase.auth.signOut()
    applyUser(null, 'SIGNED_OUT')
    throw new Error(DEACTIVATED_MESSAGE)
  }
  return data
}

// Separate entry point for /admin/login: same credentials, but the account
// must have role = 'admin' in public.profiles.
async function adminSignIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw friendlyAuthError(error)
  applyUser(data.user)

  const current = await loadProfile({ force: true })
  if (!current || current.role !== 'admin') {
    await supabase.auth.signOut()
    applyUser(null, 'SIGNED_OUT')
    throw new Error(NOT_ADMIN_MESSAGE)
  }
  if (current.is_active === false) {
    await supabase.auth.signOut()
    applyUser(null, 'SIGNED_OUT')
    throw new Error(DEACTIVATED_MESSAGE)
  }
  return data
}

async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/dashboard`
    }
  })
  if (error) throw error
}

async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  applyUser(null, 'SIGNED_OUT')
}

async function updateProfile({ firstName, lastName }) {
  const { data, error } = await supabase.auth.updateUser({
    data: { first_name: firstName, last_name: lastName }
  })
  if (error) throw error
  applyUser(data.user)
  return data.user
}

async function changePassword({ currentPassword, newPassword }) {
  const email = user.value?.email
  if (!email) throw new Error('Your session has expired. Please log in again.')

  // Make sure the person at the keyboard knows the current password.
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword
  })
  if (verifyError) {
    throw new Error(
      verifyError.message === 'Invalid login credentials'
        ? 'Your current password is incorrect.'
        : verifyError.message
    )
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export function useAuth() {
  return {
    user,
    profile,
    isAdmin,
    sessionLoaded,
    initAuth,
    loadProfile,
    signUp,
    signIn,
    adminSignIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    changePassword
  }
}
