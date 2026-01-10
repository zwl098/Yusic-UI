<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useMusicStore, type Song } from '@/stores/music'
import { useRoomStore } from '@/stores/room'
import { usePlaylistStore } from '@/stores/playlist'
import { showToast, showSuccessToast, showFailToast } from 'vant'
import { flyToElement } from '@/utils/animation'

const keyword = ref('')
const searchResults = ref<Song[]>([])
const loading = ref(false)
const musicStore = useMusicStore()
const playlistStore = usePlaylistStore()

const showAddToPlaylist = ref(false)
const selectedSong = ref<Song | null>(null)
const addedSongs = ref(new Set<string>())
const searchHistory = ref<string[]>([])

// Load history on mount
const loadHistory = () => {
    try {
        const h = localStorage.getItem('search_history')
        if (h) searchHistory.value = JSON.parse(h)
    } catch (e) {}
}

loadHistory()

const saveHistory = (kw: string) => {
    if (!kw) return
    // Remove if exists
    const idx = searchHistory.value.indexOf(kw)
    if (idx > -1) searchHistory.value.splice(idx, 1)
    
    // Add to front
    searchHistory.value.unshift(kw)
    
    // Limit to 10
    if (searchHistory.value.length > 10) searchHistory.value.pop()
    
    localStorage.setItem('search_history', JSON.stringify(searchHistory.value))
}

const clearHistory = () => {
    searchHistory.value = []
    localStorage.removeItem('search_history')
}

const onHistoryClick = (kw: string) => {
    keyword.value = kw
    onSearch()
}

const onSearch = async () => {
  if (searchTimer) clearTimeout(searchTimer)
  await nextTick()
  if (searchTimer) clearTimeout(searchTimer)
  
  const searchKw = keyword.value
  if (!searchKw.trim()) {
      searchResults.value = []
      return
  }
  loading.value = true
  try {
      const results = await musicStore.searchMusic(searchKw)
      
      // If keyword changed (e.g. cleared) while searching, ignore results
      if (keyword.value !== searchKw) return

      searchResults.value = results
      if (searchKw.trim()) {
          saveHistory(searchKw.trim())
      }
  } catch (e) {
      console.error(e)
  } finally {
      loading.value = false
  }
}

// Real-time search with debounce
let searchTimer: any = null
watch(keyword, (newVal) => {
    // Notify room that we are typing (throttled/debounced separately or simple trigger)
    // Simple trigger: just emit. The store doesn't limit frequency, but we should maybe limit it here to Avoid flooding?
    // Let's limit it to once per 1s.
    triggerTyping()

    if (searchTimer) clearTimeout(searchTimer)
    if (!newVal.trim()) { // Clear results if empty
         searchResults.value = []
         return
    }
    searchTimer = setTimeout(() => {
        onSearch()
    }, 600)
})

let lastTypingTime = 0
const triggerTyping = () => {
    const now = Date.now()
    if (now - lastTypingTime > 1500 && keyword.value.trim().length > 0) {
        lastTypingTime = now
        const roomStore = useRoomStore()
        roomStore.emitTyping()
    }
}

const onPlay = (song: Song) => {
  musicStore.playSong(song)
  // Trigger sync if in room
  const roomStore = useRoomStore()
  if (roomStore.roomId && !roomStore.isRemoteUpdate) {
      roomStore.emitPlay(song)
  }
}

const openAddToPlaylist = (song: Song) => {
    selectedSong.value = song
    showAddToPlaylist.value = true
}

const addToPlaylist = (playlistId: string) => {
    if (selectedSong.value) {
        playlistStore.addSongToPlaylist(playlistId, selectedSong.value)
        showAddToPlaylist.value = false
        showToast('Added to playlist')
    }
}

const addToQueue = (song: Song, event?: MouseEvent) => {
    const success = musicStore.addToQueue(song)
    
    // Always show checkmark to confirm it is in the queue
    addedSongs.value.add(song.id)
    setTimeout(() => {
        addedSongs.value.delete(song.id)
    }, 2000)

    if (success) {
        showSuccessToast('Added to queue')
        if (event && song.cover) {
            flyToElement(event, '#queue-icon', song.cover)
        }
    } else {
        showFailToast('Already in queue')
    }
}

const insertToQueue = (song: Song, event?: MouseEvent) => {
    musicStore.insertToNext(song)
    showSuccessToast('Will play next')
    if (event && song.cover) {
        flyToElement(event, '#queue-icon', song.cover)
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
           <!-- <van-button 
             icon="music-o" 
             size="small" 
             round 
             color="rgba(255,255,255,0.2)" 
             style="border:none; color: white; margin-left: 8px;"
             to="/playlists"
           >
             Playlists
           </van-button> -->
      </div>
    </div>

    <div class="search-section">
       <van-search 
         v-model="keyword" 
         placeholder="Search for songs, artists..." 
         shape="round"
         background="transparent"
         clearable
         @search="onSearch" 
       />
    </div>

    <!-- Search History -->
    <div class="history-section" v-if="!keyword && searchHistory.length > 0">
        <div class="history-header">
            <span>Recent</span>
            <van-icon name="delete-o" @click="clearHistory" />
        </div>
        <div class="history-tags">
            <van-tag 
                v-for="item in searchHistory" 
                :key="item" 
                round 
                size="medium" 
                color="#f0f0f0" 
                text-color="#666"
                class="history-tag"
                @click="onHistoryClick(item)"
            >
                {{ item }}
            </van-tag>
        </div>
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
            <van-image 
                width="100%" 
                height="100%" 
                fit="cover" 
                :src="song.cover || 'https://via.placeholder.com/60'"
            >
                <template v-slot:loading>
                    <van-loading type="spinner" size="20" />
                </template>
                <template v-slot:error>
                    <van-icon name="photo-fail" color="#ccc" />
                </template>
            </van-image>

            <div class="play-overlay">
              <van-icon name="play" />
            </div>
          </div>
          <div class="card-info">
            <h3 class="song-title">{{ song.name }}</h3>
            <p class="song-artist">{{ song.artist }}</p>
            <p class="song-album">{{ song.album }}</p>
          </div>
          <div class="card-actions">
            <!-- 加歌单，暂时不可用 -->
              <!-- <van-icon name="plus" class="add-btn" @click.stop="openAddToPlaylist(song)" style="margin-right: 8px;" /> -->
              <transition name="van-fade" mode="out-in">
                  <van-icon 
                    v-if="addedSongs.has(song.id)" 
                    name="success" 
                    class="add-btn success" 
                    key="success"
                  />
                  <div class="action-group" v-else>
                      <van-icon 
                        name="upgrade" 
                        class="add-btn" 
                        @click.stop="insertToQueue(song, $event)" 
                        style="transform: rotate(90deg);"
                        title="Play Next"
                      />
                      <van-icon 
                        name="clock-o" 
                        class="add-btn" 
                        @click.stop="addToQueue(song, $event)" 
                        key="add"
                        title="Add to Queue"
                      />
                  </div>
              </transition>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <van-icon name="music-o" size="64" color="#ddd" />
        <p>Start by searching for your favorite music</p>
      </div>
    </div>


  </div>

    <van-action-sheet v-model:show="showAddToPlaylist" title="Add to Playlist">
        <div class="playlist-sheet">
            <div 
                v-for="playlist in playlistStore.playlists" 
                :key="playlist.id" 
                class="sheet-item"
                @click="addToPlaylist(playlist.id)"
            >
                <van-icon name="music-o" />
                <span>{{ playlist.name }}</span>
            </div>
            <div v-if="playlistStore.playlists.length === 0" class="sheet-empty">
                No playlists found. Create one first!
            </div>
        </div>
    </van-action-sheet>
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
  position: relative;
  z-index: 10;
}

.history-section {
    padding: 16px 24px;
}

.history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #999;
    font-size: 14px;
    margin-bottom: 12px;
}

.history-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}

.history-tag {
    padding: 4px 12px;
}

.van-search {
  /* Premium look */
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  box-shadow: 0 8px 25px rgba(0,0,0,0.1);
  border-radius: 20px;
  padding: 8px;
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

.card-actions {
  padding: 0 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-group {
    display: flex;
    align-items: center;
    gap: 8px;
}

.add-btn {
  padding: 8px;
  color: #6200ea;
  background: #f0f0f0;
  border-radius: 50%;
  transition: all 0.2s;
}

.add-btn.success {
    color: white;
    background: #07c160;
}

.playlist-sheet {
    padding: 16px;
    max-height: 50vh;
    overflow-y: auto;
}

.sheet-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 0;
    border-bottom: 1px solid #f8f8f8;
    font-size: 16px;
}

.sheet-empty {
    text-align: center;
    padding: 30px;
    color: #999;
}
</style>
