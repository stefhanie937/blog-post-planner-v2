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
  }
  // Account page still pending
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const { user, sessionLoaded, initAuth } = useAuth()

  if (!sessionLoaded.value) {
    await initAuth()
  }

  if (to.meta.requiresAuth && !user.value) {
    return { name: 'login' }
  }

  if (to.meta.guestOnly && user.value) {
    return { name: 'dashboard' }
  }

  return true
})

export default router
