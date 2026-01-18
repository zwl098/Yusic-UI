<script setup lang="ts">
import { useMusicStore } from '@/stores/music'
import { useRoomStore } from '@/stores/room'
import { ref, watch } from 'vue'
import FullPlayer from './FullPlayer.vue'
import { VueDraggable } from 'vue-draggable-plus'
import { showConfirmDialog, showToast } from 'vant'

const musicStore = useMusicStore()
const roomStore = useRoomStore()

const togglePlay = () => {
    musicStore.togglePlay()
}

const showQueue = ref(false)
const showFullPlayer = ref(false)
// const queueListRef = ref<HTMLElement | null>(null) // No longer needed

const onNext = () => {
    musicStore.playNext()
}

const onRemoveFromQueue = (index: number) => {
    musicStore.removeFromQueue(index)
}

const onClearQueue = () => {
    if (musicStore.playList.length === 0) return
    showConfirmDialog({
        title: '清空列表',
        message: '确定要清空所有歌曲吗？',
        confirmButtonColor: '#6200ea',
    })
    .then(() => {
        musicStore.clearQueue()
        showToast('列表已清空')
    })
    .catch(() => {
        // cancel
    })
}

// Manual sortable logic removed in favor of VueDraggable component



</script>

<template>
    <transition name="slide-up">
      <div class="player-bar" v-if="musicStore.currentSong">
        <div class="player-content">
          <img 
            :src="musicStore.currentSong.cover" 
            class="player-cover" 
            :class="{ rotating: musicStore.isPlaying }" 
            @click="showFullPlayer = true"
          />
          
          <div class="player-info" @click="showFullPlayer = true">
            <div class="player-title">{{ musicStore.currentSong.name }}</div>
            <div class="player-sub">
                <span class="player-artist" v-if="!roomStore.isSomeoneTyping">{{ musicStore.currentSong.artist }}</span>
                <span class="player-typing" v-else>
                     <van-icon name="edit" /> Someone is picking a song...
                </span>
                <span class="player-users" v-if="roomStore.userCount > 1">
                    <van-icon name="friends" /> {{ roomStore.userCount }}
                </span>
            </div>
          </div>

          <div class="player-controls">
             <button class="control-btn" @click.stop="togglePlay">
              <van-icon :name="musicStore.isPlaying ? 'pause' : 'play'" size="28" color="#333" />
            </button>
            <button class="control-btn" @click.stop="onNext">
               <van-icon name="arrow" size="20" color="#333" />
            </button>
            <button class="control-btn" @click.stop="showQueue = true" id="queue-icon">
               <van-icon name="bars" size="20" color="#333" />
            </button>
          </div>
        </div>
        
      </div>
    </transition>
    
    <!-- Audio Element (Always Mounted) -->
    <audio 
      v-if="musicStore.currentSong"
      :src="musicStore.currentSong.url" 
      crossorigin="anonymous"
      playsinline
      @play="musicStore.isPlaying = true"
      @pause="musicStore.isPlaying = false"
      @ended="onNext"
      @timeupdate="(e) => musicStore.currentTime = (e.target as HTMLAudioElement).currentTime"
      @loadedmetadata="(e) => musicStore.duration = (e.target as HTMLAudioElement).duration"
      :ref="(el) => { if(el) musicStore.audioRef = el as HTMLAudioElement }"
    ></audio>

    <!-- Queue Popup -->
    <van-popup 
        v-model:show="showQueue" 
        position="bottom" 
        round 
        :style="{ height: '60%' }"
        title="Play Queue"
    >
            <div class="queue-content">
                <h3>
                    <div style="display:flex; align-items:center;">
                        <van-icon name="music-o" color="#6200ea"/> 
                        <span style="margin-left:8px">Up Next</span>
                        <span style="font-size:12px; color:#999; font-weight:400; margin-left:8px">({{ musicStore.playList.length }})</span>
                    </div>
                    <van-icon name="delete-o" @click="onClearQueue" style="cursor:pointer" color="#666" />
                </h3>
                
                <!-- Draggable List -->
                <div class="queue-list" v-if="musicStore.playList.length > 0">
                    <VueDraggable 
                        v-model="musicStore.playList"
                        :animation="200"
                        handle=".q-drag-handle"
                        ghost-class="sortable-ghost"
                        drag-class="sortable-drag"
                        :force-fallback="true"
                        :fallback-on-body="true"
                        class="list-group"
                    >
                        <div v-for="(song, index) in musicStore.playList" :key="song.id || index" class="queue-item">
                            <van-icon name="bars" class="q-drag-handle" color="#ddd" style="margin-right:12px; cursor:grab;" />
                            <div class="q-left" @click="musicStore.playSong(song)">
                                <img :src="song.cover || 'https://via.placeholder.com/40'" class="q-cover" />
                                <div class="q-info">
                                    <div class="q-name" :class="{ active: musicStore.currentSong?.id === song.id }">{{ song.name }}</div>
                                    <div class="q-artist">{{ song.artist }}</div>
                                </div>
                            </div>
                            <div class="q-right">
                                <van-icon v-if="musicStore.currentSong?.id === song.id" name="play-circle" color="#6200ea" style="margin-right:8px" />
                                <van-icon name="cross" @click.stop="onRemoveFromQueue(index)" class="q-remove" />
                            </div>
                        </div>
                    </VueDraggable>
                </div>
                
                <div v-else class="queue-empty">
                    <van-icon name="smile-o" size="48" color="#eee" />
                    <span>Your queue is empty</span>
                    <van-button size="small" round type="primary" color="#6200ea" @click="showQueue = false">Add Songs</van-button>
                </div>
            </div>
    </van-popup>

    <!-- Full Player Popup -->
    <van-popup 
        v-model:show="showFullPlayer" 
        position="bottom" 
        :style="{ height: '100%' }"
        close-icon-position="top-left"
        :lazy-render="false"
    >
        <FullPlayer :show="showFullPlayer" @close="showFullPlayer = false" />
    </van-popup>
</template>

<style scoped>
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

.player-sub {
    display: flex;
    align-items: center;
    gap: 8px;
    overflow: hidden;
}

.player-users {
    font-size: 10px;
    background: #f0f0f0;
    padding: 2px 6px;
    border-radius: 10px;
    color: #666;
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
}

.player-typing {
    font-size: 11px;
    color: #6200ea;
    display: flex;
    align-items: center;
    gap: 4px;
    animation: pulse 1.5s infinite;
    white-space: nowrap;
}

@keyframes pulse {
    0% { opacity: 0.6; }
    50% { opacity: 1; }
    100% { opacity: 0.6; }
}

.player-controls {
    display: flex;
    align-items: center;
    gap: 12px;
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

/* Premium Queue Popup */
.queue-content {
    padding: 24px;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: rgba(255, 255, 255, 0.85);
    backdrop-filter: blur(20px);
}

.queue-content h3 {
    margin: 0 0 20px;
    font-size: 20px;
    font-weight: 700;
    color: #1a1a1a;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

/* ... existing code ... */

.q-name.active {
    color: #6200ea;
    font-weight: 700;
}

.sortable-ghost {
    opacity: 0;
}

.sortable-drag {
    background: #fff;
    box-shadow: 0 8px 20px rgba(0,0,0,0.25);
    transform: scale(1.02);
    z-index: 9999;
    border-radius: 12px;
    transition: none !important; /* Critical: prevents drag lag */
}

.flip-list-move {
  transition: transform 0.3s;
}

.q-right {
    display: flex;
    align-items: center;
}

.queue-list {
    flex: 1;
    overflow-y: auto;
    padding-bottom: 20px;
}

.queue-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px;
    margin-bottom: 8px;
    border-radius: 12px;
    background: rgba(255,255,255,0.5);
    transition: all 0.2s;
}

.queue-item:active {
    transform: scale(0.98);
    background: rgba(255,255,255,0.8);
}

.q-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
}

.q-cover {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    object-fit: cover;
    background: #eee;
}

.q-info {
    flex: 1;
    min-width: 0;
}

.q-name {
    font-size: 15px;
    color: #333;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.q-artist {
    font-size: 12px;
    color: #888;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.q-remove {
    padding: 8px;
    color: #ccc;
    transition: color 0.2s;
}
.q-remove:active {
    color: #ff4d4f;
}

.q-drag-handle {
    touch-action: none; /* Crucial for touch dragging */
    cursor: grab;
}
.q-drag-handle:active {
    cursor: grabbing;
}

.queue-empty {
    text-align: center;
    color: #999;
    margin-top: 60px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}
</style>
