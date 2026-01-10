<script setup lang="ts">
import { useMusicStore } from '@/stores/music'
import { useRoomStore } from '@/stores/room'
import { ref, watch } from 'vue'
import FullPlayer from './FullPlayer.vue'

const musicStore = useMusicStore()
const roomStore = useRoomStore()

const togglePlay = () => {
    // Trigger local toggle
    // If currently playing, it will pause. If paused, it will play.
    musicStore.togglePlay()
    
    // Sync with room
    if (roomStore.roomId && !roomStore.isRemoteUpdate) {
        if (musicStore.isPlaying) {
             // It just started playing
             if (musicStore.currentSong) {
                // If we are resuming, we might want to just emit play?
                // The room store 'sync:play' expects a song. 
                roomStore.emitPlay(musicStore.currentSong)
             }
        } else {
             // It just paused
             roomStore.emitPause()
        }
    }
    }

const showQueue = ref(false)
const showFullPlayer = ref(false)

const onNext = () => {
    musicStore.playNext()
}

const onRemoveFromQueue = (index: number) => {
    musicStore.removeFromQueue(index)
}

// Init Audio Context once audio element is ready and user interacts (play)
watch(() => [musicStore.audioRef, musicStore.isPlaying], ([ref, playing]) => {
    if (ref && playing) {
        if (!musicStore.audioContext) {
            musicStore.initAudioContext()
        } else if (musicStore.audioContext.state === 'suspended') {
            musicStore.audioContext.resume()
        }
    }
})

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
                <span class="player-artist">{{ musicStore.currentSong.artist }}</span>
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
        
        <!-- Hidden Audio Element -->
        <audio 
          :src="musicStore.currentSong.url" 
          crossorigin="anonymous"
          autoplay
          @play="musicStore.isPlaying = true"
          @pause="musicStore.isPlaying = false"
          @ended="onNext"
          @timeupdate="(e) => musicStore.currentTime = (e.target as HTMLAudioElement).currentTime"
          @loadedmetadata="(e) => musicStore.duration = (e.target as HTMLAudioElement).duration"
          :ref="(el) => { if(el) musicStore.audioRef = el as HTMLAudioElement }"
        ></audio>
      </div>
    </transition>

    <!-- Queue Popup -->
    <van-popup v-model:show="showQueue" position="bottom" round :style="{ height: '60%' }">
            <div class="queue-content">
                <h3>Up Next</h3>
                <div class="queue-list" v-if="musicStore.playList.length > 0">
                    <div v-for="(song, index) in musicStore.playList" :key="index" class="queue-item">
                        <div class="q-info">
                            <div class="q-name">{{ song.name }}</div>
                            <div class="q-artist">{{ song.artist }}</div>
                        </div>
                        <van-icon name="cross" @click="onRemoveFromQueue(index)" class="q-remove" />
                    </div>
                </div>
                <div v-else class="queue-empty">
                    Queue is empty
                </div>
            </div>
    </van-popup>

    <!-- Full Player Popup -->
    <van-popup 
        v-model:show="showFullPlayer" 
        position="bottom" 
        :style="{ height: '100%' }"
        close-icon-position="top-left"
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

.queue-content {
    padding: 24px;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.queue-content h3 {
    margin: 0 0 16px;
    font-size: 18px;
    color: #333;
}

.queue-list {
    flex: 1;
    overflow-y: auto;
}

.queue-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 0;
    border-bottom: 1px solid #f8f8f8;
}

.q-info {
    flex: 1;
    min-width: 0;
}

.q-name {
    font-size: 15px;
    color: #333;
    font-weight: 500;
}

.q-artist {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
}

.q-remove {
    padding: 8px;
    color: #999;
}

.queue-empty {
    text-align: center;
    color: #999;
    margin-top: 40px;
}
</style>
