<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMusicStore, type Song } from '@/stores/music'

const keyword = ref('')
const searchResults = ref<Song[]>([])
const loading = ref(false)
const musicStore = useMusicStore()

const onSearch = async () => {
  if (!keyword.value) return
  loading.value = true
  searchResults.value = await musicStore.searchMusic(keyword.value)
  loading.value = false
}

const onPlay = (song: Song) => {
  musicStore.playSong(song)
}

const togglePlay = () => {
  musicStore.togglePlay()
}
</script>

<template>
  <div class="home-container">
    <div class="header-bg">
      <h1 class="app-title">Yusic</h1>
      <p class="app-subtitle">Discover your rhythm</p>
    </div>

    <div class="search-section">
       <van-search 
         v-model="keyword" 
         placeholder="Search for songs, artists..." 
         shape="round"
         background="transparent"
         @search="onSearch" 
       />
    </div>

    <div class="content-area">
      <div v-if="loading" class="loading-state">
        <van-loading type="spinner" color="#6200ea" />
        <p>Searching...</p>
      </div>
      
      <div v-else-if="searchResults.length > 0" class="song-list">
        <div 
          v-for="song in searchResults" 
          :key="song.id" 
          class="song-card"
          @click="onPlay(song)"
        >
          <div class="card-image">
            <img :src="song.cover || 'https://via.placeholder.com/60'" alt="cover" loading="lazy" />
            <div class="play-overlay">
              <van-icon name="play" />
            </div>
          </div>
          <div class="card-info">
            <h3 class="song-title">{{ song.name }}</h3>
            <p class="song-artist">{{ song.artist }}</p>
            <p class="song-album">{{ song.album }}</p>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <van-icon name="music-o" size="64" color="#ddd" />
        <p>Start by searching for your favorite music</p>
      </div>
    </div>

    <transition name="slide-up">
      <div class="player-bar" v-if="musicStore.currentSong">
        <div class="player-content">
          <img :src="musicStore.currentSong.cover" class="player-cover" :class="{ rotating: musicStore.isPlaying }" />
          
          <div class="player-info">
            <div class="player-title">{{ musicStore.currentSong.name }}</div>
            <div class="player-artist">{{ musicStore.currentSong.artist }}</div>
          </div>

          <div class="player-controls">
            <button class="control-btn" @click.stop="togglePlay">
              <van-icon :name="musicStore.isPlaying ? 'pause' : 'play'" size="28" color="#333" />
            </button>
          </div>
        </div>
        
        <!-- Hidden Audio Element -->
        <audio 
          :src="musicStore.currentSong.url" 
          autoplay
          @play="musicStore.isPlaying = true"
          @pause="musicStore.isPlaying = false"
          @ended="musicStore.isPlaying = false"
          :ref="(el) => { if(el) musicStore.audioRef = el as HTMLAudioElement }"
        ></audio>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.home-container {
  min-height: 100vh;
  background-color: #f8f9fc;
  padding-bottom: 100px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

.header-bg {
  padding: 40px 24px 60px;
  background: linear-gradient(135deg, #6200ea 0%, #9046fe 100%);
  color: white;
  border-bottom-left-radius: 30px;
  border-bottom-right-radius: 30px;
  box-shadow: 0 10px 30px rgba(98, 0, 234, 0.2);
}

.app-title {
  font-size: 32px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -1px;
}

.app-subtitle {
  opacity: 0.8;
  margin: 5px 0 0;
  font-size: 14px;
}

.search-section {
  margin-top: -30px;
  padding: 0 16px;
}

.van-search {
  box-shadow: 0 8px 20px rgba(0,0,0,0.08);
  border-radius: 20px;
  padding: 6px;
}

.content-area {
  padding: 24px 16px;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #999;
}

.song-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.song-card {
  display: flex;
  background: white;
  padding: 12px;
  border-radius: 16px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.03);
  transition: transform 0.2s, box-shadow 0.2s;
  cursor: pointer;
  align-items: center;
}

.song-card:active {
  transform: scale(0.98);
}

.card-image {
  position: relative;
  width: 60px;
  height: 60px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
  background: #f0f0f0;
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
  color: white;
}

.song-card:hover .play-overlay {
  opacity: 1;
}

.card-info {
  margin-left: 16px;
  flex: 1;
  min-width: 0;
}

.song-title {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  margin: 0;
  font-size: 13px;
  color: #666;
}

.song-album {
  margin: 2px 0 0;
  font-size: 11px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Player Bar */
.player-bar {
  position: fixed;
  bottom: 20px;
  left: 16px;
  right: 16px;
  height: 72px;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px;
  box-shadow: 0 10px 40px rgba(0,0,0,0.15);
  display: flex;
  align-items: center;
  padding: 0 16px;
  z-index: 1000;
  border: 1px solid rgba(255,255,255,0.5);
}

.player-content {
  display: flex;
  align-items: center;
  width: 100%;
}

.player-cover {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid white;
  box-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.rotating {
  animation: rotate 10s linear infinite;
}

@keyframes rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.player-info {
  flex: 1;
  margin: 0 16px;
  overflow: hidden;
}

.player-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-artist {
  font-size: 12px;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.control-btn {
  background: rgba(0,0,0,0.05);
  border: none;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.2s;
}

.control-btn:hover {
  background: rgba(0,0,0,0.1);
}

.control-btn:active {
  transform: scale(0.95);
}

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.5, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
