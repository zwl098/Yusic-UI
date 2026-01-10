<script setup lang="ts">
import PlayerBar from './components/PlayerBar.vue'
import { useRegisterSW } from 'virtual:pwa-register/vue'
import { useAppStore } from '@/stores/app'
import { onMounted, watch } from 'vue'
import { showConfirmDialog } from 'vant'
import 'vant/es/dialog/style'

const appStore = useAppStore()
const appVersion = __APP_VERSION__

// Register Service Worker
const { needRefresh, updateServiceWorker } = useRegisterSW()

// Watch for update
watch(needRefresh, (value) => {
  if (value) {
    showConfirmDialog({
      title: '更新提示',
      message: `发现新版本，是否立即刷新以应用更新？\n当前版本: ${__APP_VERSION__}`,
      confirmButtonText: '立即刷新',
      cancelButtonText: '稍后',
      theme: 'round-button',
    }).then(() => {
      updateServiceWorker()
    }).catch(() => {
      // User cancelled, do nothing
    })
  }
})

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
