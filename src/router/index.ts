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
    {
      path: '/playlists',
      name: 'playlists',
      component: () => import('../views/PlaylistListView.vue')
    },
    {
      path: '/playlists/:id',
      name: 'playlist-detail',
      component: () => import('../views/PlaylistDetailView.vue')
    },
  ],
})

export default router
