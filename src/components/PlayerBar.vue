<script setup lang="ts">
import { useMusicStore } from '@/stores/music'
import { useRoomStore } from '@/stores/room'

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
</script>

<template>
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
