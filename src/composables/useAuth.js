import { ref } from 'vue'
import { supabase } from '../lib/supabaseClient'
import { usePosts } from './usePosts'

// Module-level state so every component sharing this composable
// sees the same session (simple singleton store).
const user = ref(null)
const sessionLoaded = ref(false)
let initPromise = null

// One place that updates the user, so the posts list can never show another
// account's data (sign-out in another tab, expired session, switching accounts).
function applyUser(nextUser, event = '') {
  const switchedAccount = user.value && nextUser && user.value.id !== nextUser.id
  if (event === 'SIGNED_OUT' || switchedAccount) usePosts().resetPosts()
  user.value = nextUser
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
  if (error) throw error
  applyUser(data.user)
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
    sessionLoaded,
    initAuth,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    updateProfile,
    changePassword
  }
}