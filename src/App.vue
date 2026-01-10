<script setup lang="ts">
import PlayerBar from './components/PlayerBar.vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useAppStore } from '@/stores/app'
import { onMounted } from 'vue'

const appStore = useAppStore()

// Register Service Worker
useRegisterSW()

// Capture install prompt
onMounted(() => {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    appStore.setInstallPrompt(e)
  })
})
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in">
      <KeepAlive include="HomeView">
        <component :is="Component" />
      </KeepAlive>
    </Transition>
  </RouterView>
  <PlayerBar />
</template>

<style scoped>
</style>
