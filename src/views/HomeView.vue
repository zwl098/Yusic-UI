<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useMusicStore, type Song } from '@/stores/music'
import type { MusicSource } from '@/services/tunefree'
import { useRoomStore } from '@/stores/room'
import { usePlaylistStore } from '@/stores/playlist'
import { useFavoritesStore } from '@/stores/favorites' // [NEW]
import { useAppStore } from '@/stores/app'
import { showToast, showSuccessToast, showFailToast } from 'vant'
import { flyToElement } from '@/utils/animation'

const keyword = ref('')
const searchResults = ref<Song[]>([])
const loading = ref(false)
const musicStore = useMusicStore()
const playlistStore = usePlaylistStore()
const appStore = useAppStore()
const favoritesStore = useFavoritesStore() // [NEW]

const searchPlatform = ref<MusicSource>('kuwo')
const showPlatformSelect = ref(false)
const platforms = [
    { text: '酷我', value: 'kuwo' },
    { text: '网易', value: 'netease' },
    { text: 'QQ', value: 'qq' },
]

const onSelectPlatform = (action: any) => {
    searchPlatform.value = action.value
    // If we have a keyword, trigger search immediately for better UX
    if (keyword.value.trim()) {
        onSearch()
    }
}

// Version Easter Egg
const appVersion = __APP_VERSION__
const versionClickCount = ref(0)
let versionClickTimer: any = null

const handleTitleClick = () => {
    versionClickCount.value++

    if (versionClickTimer) clearTimeout(versionClickTimer)
    versionClickTimer = setTimeout(() => {
        versionClickCount.value = 0
    }, 500)

    if (versionClickCount.value >= 5) {
        showToast(`v${appVersion}`)
        versionClickCount.value = 0
        clearTimeout(versionClickTimer)
    }
}

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
      const results = await musicStore.searchMusic(searchKw, searchPlatform.value)

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
      <h1 class="app-title" @click="handleTitleClick">Yusic</h1>
      <p class="app-subtitle">Discover your rhythm</p>
      <div class="header-actions">
           <van-button
             v-if="appStore.showInstallButton"
             icon="down"
             size="small"
             round
             color="rgba(255,255,255,0.2)"
             style="border:none; color: white; margin-right: 8px;"
             @click="appStore.installApp()"
           >
             Install
           </van-button>

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

           <!-- Play Random Favorite -->
           <van-button
             icon="like-o"
             size="small"
             round
             color="rgba(255,255,255,0.2)"
             style="border:none; color: white; margin-left: 8px;"
             @click="favoritesStore.playRandomFavorite()"
           >
             Fav Mix
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
       >
        <template #label>
            <van-popover
                v-model:show="showPlatformSelect"
                :actions="platforms"
                @select="onSelectPlatform"
                placement="bottom-start"
            >
                <template #reference>
                    <div class="platform-select">
                        <span>{{ platforms.find(p => p.value === searchPlatform)?.text }}</span>
                        <van-icon name="arrow-down" size="10" style="margin-left: 2px; opacity: 0.5;" />
                    </div>
                </template>
            </van-popover>
        </template>
       </van-search>
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

      <TransitionGroup name="list" tag="div" class="song-list" v-else-if="searchResults.length > 0" appear>
        <div
          v-for="(song, index) in searchResults"
          :key="song.id"
          class="song-card"
          :style="{ transitionDelay: `${index * 0.05}s` }"
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
      </TransitionGroup>

      <div v-else class="empty-state">
        <van-icon name="music-o" size="64" color="#ddd" />
        <p>Start by searching for your favorite music</p>
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
  </div>
</template>

<style scoped>
.home-container {
  min-height: 100vh;
  background-color: #f8f9fc;
  padding-bottom: 120px;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Hero Header */
.header-bg {
  position: relative;
  padding: 60px 24px 80px;
  background: linear-gradient(135deg, #6200ea 0%, #b055ff 50%, #5d00d6 100%);
  color: white;
  border-bottom-left-radius: 40px;
  border-bottom-right-radius: 40px;
  box-shadow: 0 20px 50px rgba(98, 0, 234, 0.25);
  overflow: hidden;
}

/* Background Mesh/Glow */
.header-bg::before {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
    animation: rotate 20s linear infinite;
    pointer-events: none;
}

@keyframes rotate {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.app-title {
  font-size: 42px;
  font-weight: 800;
  margin: 0;
  letter-spacing: -1.5px;
  position: relative;
  z-index: 1;
  text-shadow: 0 4px 10px rgba(0,0,0,0.1);
}

.app-subtitle {
  opacity: 0.9;
  margin: 8px 0 0;
  font-size: 16px;
  font-weight: 500;
  letter-spacing: 0.5px;
  position: relative;
  z-index: 1;
}

.header-actions {
  position: absolute;
  top: 60px;
  right: 24px;
  z-index: 10;
  display: flex;
  gap: 8px;
}

/* Search Section */
.search-section {
  margin-top: -40px;
  padding: 0 20px;
  position: relative;
  z-index: 20;
}

.van-search {
  background: rgba(255, 255, 255, 0.85) !important;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 15px 35px rgba(0,0,0,0.08), 0 5px 15px rgba(0,0,0,0.05);
  border-radius: 24px;
  padding: 6px 6px 6px 12px;
}

.platform-select {
    display: flex;
    align-items: center;
    font-size: 14px;
    color: #333;
    font-weight: 600;
    padding-right: 8px;
    border-right: 1px solid rgba(0,0,0,0.05);
    margin-right: 4px;
    height: 24px;
}


/* History */
.history-section {
    padding: 24px 24px 0;
}

.history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #888;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 16px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.history-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.history-tag {
    padding: 6px 14px;
    font-size: 13px;
    background: #fff;
    border: 1px solid rgba(0,0,0,0.05);
    box-shadow: 0 2px 8px rgba(0,0,0,0.03);
    transition: all 0.2s;
}
.history-tag:active {
    transform: scale(0.95);
    background: #f0f0f0;
}

/* Content Area */
.content-area {
  padding: 24px 20px;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: #aaa;
  font-weight: 500;
}

.empty-state p {
    margin-top: 16px;
    font-size: 15px;
}

/* Song List & Cards */
.song-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.song-card {
  display: flex;
  background: white;
  padding: 12px;
  border-radius: 20px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.03), 0 5px 10px rgba(0,0,0,0.02);
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  cursor: pointer;
  align-items: center;
  border: 1px solid rgba(0,0,0,0.02);
  position: relative;
  overflow: hidden;
}

.song-card:active {
  transform: scale(0.97);
  box-shadow: 0 5px 15px rgba(0,0,0,0.02);
}

.card-image {
  position: relative;
  width: 72px; /* Larger cover */
  height: 72px;
  border-radius: 16px;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 8px 16px rgba(0,0,0,0.1);
}

.card-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s;
}

.song-card:hover .card-image img {
    transform: scale(1.1);
}

.play-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0,0,0,0.4);
  backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
  color: white;
  font-size: 24px;
}

.song-card:hover .play-overlay {
  opacity: 1;
}

.card-info {
  margin-left: 20px;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.song-title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 700;
  color: #1a1a1a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: -0.3px;
}

.song-artist {
  margin: 0;
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.song-album {
  margin: 4px 0 0;
  font-size: 12px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-actions {
  padding-right: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.add-btn {
  padding: 10px;
  color: #6200ea;
  background: #f4f0ff;
  border-radius: 14px;
  transition: all 0.2s;
  font-size: 18px;
}

.add-btn:active {
    background: #6200ea;
    color: white;
}

.add-btn.success {
    color: white;
    background: #07c160;
}

/* Animations */
.list-enter-active,
.list-leave-active {
  transition: all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(30px) scale(0.95);
}

.list-leave-active {
  position: absolute;
  width: 100%;
  z-index: -1;
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
  user-select: none;
  cursor: default;
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

/* List Transitions - Scoped to ensure specificity over song-card */
.song-card.list-move,
.song-card.list-enter-active,
.song-card.list-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.list-leave-active {
  position: absolute;
  width: 100%;
}
</style>
