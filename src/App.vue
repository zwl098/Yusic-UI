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
  
  <PlayerBar />
</template>
