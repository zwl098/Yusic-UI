<script setup lang="ts">
import PlayerBar from './components/PlayerBar.vue'
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="fade" mode="out-in">
      <component :is="Component" />
    </Transition>
  </RouterView>
  <PlayerBar />
</template>

<style scoped>
</style>
