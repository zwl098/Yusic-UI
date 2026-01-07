<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="basic-layout">
    <header class="layout-header">
      <div class="logo">Yusic</div>
      <nav class="desktop-nav">
        <!-- Desktop Navigation Items -->
      </nav>
    </header>
    
    <main class="layout-main">
      <RouterView />
    </main>

    <footer class="layout-footer">
      <!-- Player Bar Placeholder -->
      <div class="player-placeholder">Player Bar</div>
    </footer>
  </div>
</template>

<style scoped>
.basic-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.layout-header {
  height: 60px;
  background-color: #282828; /* Dark grey */
  display: flex;
  align-items: center;
  padding: 0 20px;
  color: white;
}

.layout-main {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: var(--color-background);
}

.layout-footer {
  height: 80px;
  background-color: #181818;
  border-top: 1px solid #282828;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #b3b3b3;
}

/* Mobile Adaptation */
@media (max-width: 768px) {
  .layout-header {
    justify-content: center;
  }
}
</style>
