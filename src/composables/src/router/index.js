import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '../composables/useAuth'

const routes = [
  {
    path: '/',
    redirect: '/login'
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/auth/Login.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('../views/auth/Signup.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/forgot-password',
    name: 'forgot-password',
    component: () => import('../views/auth/ForgotPassword.vue'),
    meta: { guestOnly: true }
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/DashboardPlaceholder.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/composer',
    name: 'composer',
    component: () => import('../views/Composer.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/composer/:id',
    name: 'composer-edit',
    component: () => import('../views/Composer.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/account',
    name: 'account',
    component: () => import('../views/Account.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/history',
    name: 'history',
    component: () => import('../views/History.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/drafts',
    name: 'drafts',
    component: () => import('../views/Drafts.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/archived',
    name: 'archived',
    component: () => import('../views/ArchivedPosts.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/failed',
    name: 'failed',
    component: () => import('../views/FailedPosts.vue'),
    meta: { requiresAuth: true }
  },

  // ---------------------------------------------------------------------
  // Admin side
  // ---------------------------------------------------------------------
  {
    path: '/admin/login',
    name: 'admin-login',
    component: () => import('../views/admin/AdminLogin.vue'),
    meta: { adminGuestOnly: true }
  },
  {
    path: '/admin',
    redirect: { name: 'admin-dashboard' }
  },
  {
    path: '/admin/dashboard',
    name: 'admin-dashboard',
    component: () => import('../views/admin/AdminDashboard.vue'),
    meta: { requiresAdmin: true }
  },
  {
    path: '/admin/users',
    name: 'admin-users',
    component: () => import('../views/admin/AdminUsers.vue'),
    meta: { requiresAdmin: true }
  },
  {
    path: '/admin/reports',
    name: 'admin-reports',
    component: () => import('../views/admin/AdminReports.vue'),
    meta: { requiresAdmin: true }
  },
  {
    path: '/admin/:pathMatch(.*)*',
    redirect: { name: 'admin-dashboard' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const { user, profile, sessionLoaded, initAuth, loadProfile, signOut } = useAuth()

  if (!sessionLoaded.value) {
    await initAuth()
  }

  const meta = to.meta
  const needsProfile =
    meta.requiresAuth || meta.requiresAdmin || meta.guestOnly || meta.adminGuestOnly

  if (user.value && needsProfile) {
    await loadProfile()

    // Deactivated accounts are signed out wherever they try to go.
    if (profile.value?.is_active === false) {
      try {
        await signOut()
      } catch {
        // If sign-out fails the guard simply runs again on the next navigation.
      }
      const target = meta.requiresAdmin || meta.adminGuestOnly ? 'admin-login' : 'login'
      if (to.name === target) return true
      return { name: target, query: { deactivated: '1' } }
    }
  }

  // Admin area
  if (meta.requiresAdmin) {
    if (!user.value) return { name: 'admin-login' }
    if (profile.value?.role !== 'admin') return { name: 'dashboard' }
  }

  if (meta.adminGuestOnly && user.value && profile.value?.role === 'admin') {
    return { name: 'admin-dashboard' }
  }

  // User area (unchanged behaviour)
  if (meta.requiresAuth && !user.value) {
    return { name: 'login' }
  }

  if (meta.guestOnly && user.value) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
