<script setup lang="ts">
import PlayerBar from './components/PlayerBar.vue'
import { useAppStore } from '@/stores/app'
import { onMounted } from 'vue'

const appStore = useAppStore()
const appVersion = __APP_VERSION__

// Capture install prompt
onMounted(() => {
  console.log(`[App] Current Version: ${__APP_VERSION__}`)
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
  
  <!-- Version Watermark -->
  <div class="version-watermark">v{{ appVersion }}</div>
  
  <PlayerBar />
</template>

<style scoped>
.version-watermark {
    position: fixed;
    bottom: 80px; /* Above player bar */
    right: 10px;
    font-size: 10px;
    color: rgba(255, 255, 255, 0.2);
    pointer-events: none;
    z-index: 9999;
}
</style>
