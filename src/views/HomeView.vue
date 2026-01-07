<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMusicStore, type Song } from '@/stores/music'
import { useRoomStore } from '@/stores/room'

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
  // Trigger sync if in room
  const roomStore = useRoomStore()
  if (roomStore.roomId && !roomStore.isRemoteUpdate) {
      roomStore.emitPlay(song)
  }
}
</script>

<template>
  <div class="home-container">
    <div class="header-bg">
      <h1 class="app-title">Yusic</h1>
      <p class="app-subtitle">Discover your rhythm</p>
      <div class="header-actions">
           <van-button 
             icon="friends-o" 
             size="small" 
             round 
             color="rgba(255,255,255,0.2)" 
             style="border:none; color: white;"
             to="/room"
           >
             Together
           </van-button>
      </div>
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

.header-bg {
    position: relative;
    /* keep existing styles, but maybe ensure flex container if needed, or absolute position the button */
}

.header-actions {
    position: absolute;
    top: 40px;
    right: 24px;
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


</style>
