import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    // About route removed

    {
      path: '/room',
      name: 'room',
      component: () => import('../views/RoomView.vue')
    },
  ],
})

export default router
