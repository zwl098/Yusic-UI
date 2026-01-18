<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoomStore } from '@/stores/room'
import { useMusicStore } from '@/stores/music'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'

const roomStore = useRoomStore()
const musicStore = useMusicStore()
const router = useRouter()
const roomIdInput = ref('')

const displayRoomId = computed(() => {
    if (!roomStore.roomId) return ''
    return roomStore.roomId.slice(0, 8).toUpperCase()
})

const onCreateRoom = () => {
  roomStore.createRoom()
}

const onJoinRoom = async () => {
  if (roomIdInput.value) {
    try {
        await roomStore.joinRoom(roomIdInput.value)
    } catch (e) {
        showToast((e as Error).message || 'Failed to join')
    }
  }
}

const onLeaveRoom = () => {
    roomStore.leaveRoom()
}

const onBack = () => {
    router.push('/')
}

const copyRoomId = async () => {
    if (roomStore.roomId) {
        try {
            await navigator.clipboard.writeText(roomStore.roomId)
            import('vant').then(({ showSuccessToast }) => showSuccessToast('Room Code Copied!'))
        } catch (e) {
            import('vant').then(({ showFailToast }) => showFailToast('Failed to copy'))
        }
    }
}

const copyInvite = async () => {
    if (roomStore.roomId) {
        const text = `Join my Yusic room! Code: ${roomStore.roomId}`
        try {
            await navigator.clipboard.writeText(text)
            import('vant').then(({ showSuccessToast }) => showSuccessToast('Invite Link Copied!'))
        } catch (e) {
            import('vant').then(({ showFailToast }) => showFailToast('Failed to copy'))
        }
    }
}
</script>

<template>
  <div class="room-container">
    <div class="header">
        <van-icon name="arrow-left" size="24" @click="onBack" />
        <h2>Listen Together</h2>
    </div>

    <transition name="fade" mode="out-in">
    <div v-if="!roomStore.roomId" class="actions" key="actions">
      <div class="action-card create" @click="onCreateRoom">
        <van-icon name="add-o" size="48" :class="{ 'spin': roomStore.isLoading && !roomIdInput }" />
        <h3>{{ roomStore.isLoading && !roomIdInput ? 'Creating...' : 'Create Room' }}</h3>
        <p>Start a listening party and invite friends</p>
      </div>
      
      <div class="divider">OR</div>

      <div class="action-card join">
        <van-icon name="friends-o" size="48" />
        <h3>Join Room</h3>
        <van-field
          v-model="roomIdInput"
          placeholder="Enter Room Code"
          border
          class="room-input"
        >
          <template #button>
             <van-button 
               size="small" 
               type="primary" 
               @click="onJoinRoom" 
               :disabled="!roomIdInput || roomStore.isLoading"
               :loading="roomStore.isLoading && !!roomIdInput"
             >
               Join
             </van-button>
          </template>
        </van-field>
      </div>
    </div>

    <div v-else class="active-room" key="active">
      <div class="room-card">
         <div class="status-indicator">
            <div class="indicator-dot" :class="{ connected: roomStore.isConnected }"></div>
            <span class="status-text">{{ roomStore.isConnected ? 'Live Sync' : 'Connecting...' }}</span>
         </div>
         
         <van-icon name="music-o" size="48" color="#6200ea" class="room-icon" />
         <h3>Room Active</h3>
         
         <div class="room-code-container" @click="copyRoomId">
            <span class="code-label">ROOM CODE</span>
            <div class="code-value">
                {{ displayRoomId }}...
                <van-icon name="description" class="copy-icon" />
            </div>
         </div>

         <div class="room-stats">
            <div class="stat-item">
                <van-icon name="friends" color="#6200ea" />
                <span>{{ roomStore.userCount }} Online</span>
            </div>
            <div class="stat-item">
                <van-icon name="play-circle" color="#6200ea" />
                <span>{{ musicStore.isPlaying ? 'Playing' : 'Paused' }}</span>
            </div>
         </div>

         <div class="divider"></div>
         
         <div class="instruction-box">
             <van-button 
                color="linear-gradient(to right, #6200ea, #9046fe)" 
                round 
                size="small" 
                block
                @click="copyInvite"
             >
                Copy Invite Link
             </van-button>
         </div>

         <van-button 
            plain 
            type="danger" 
            size="small" 
            class="leave-btn"
            @click="onLeaveRoom"
            style="margin-top: 24px; border: none;"
         >
            Leave Room
         </van-button>
      </div>
    </div>
    </transition>
  </div>
</template>

<style scoped>
.room-container {
  min-height: 100vh;
  background: #f8f9fc;
  padding: 24px;
  font-family: 'Inter', sans-serif;
  box-sizing: border-box;
}

.header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 32px;
}

.header h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 400px;
  margin: 0 auto;
}

.divider {
    text-align: center;
    color: #eee;
    margin: 20px 0;
    height: 1px;
    background: #eee;
    width: 100%;
}

.action-card {
  background: white;
  border-radius: 20px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  cursor: pointer;
  transition: transform 0.2s;
}

.action-card:active {
    transform: scale(0.98);
}

.create {
    background: linear-gradient(135deg, #6200ea 0%, #9046fe 100%);
    color: white;
}

.create h3, .create p, .create .van-icon {
    color: white;
}

.join .van-icon {
    color: #6200ea;
}

.action-card h3 {
  margin: 16px 0 8px;
  font-size: 20px;
}

.action-card p {
  margin: 0;
  opacity: 0.8;
  font-size: 14px;
}

.room-input {
    margin-top: 16px;
    background: #f8f9fc;
    border-radius: 8px;
    padding: 8px 12px;
}

/* Active Room Styles */
.active-room {
  display: flex;
  justify-content: center;
  padding-top: 20px;
}

.room-card {
    background: white;
    border-radius: 24px;
    padding: 32px 24px;
    box-shadow: 0 10px 40px rgba(98, 0, 234, 0.1);
    width: 100%;
    max-width: 340px;
    text-align: center;
    position: relative;
    overflow: hidden;
}

.status-indicator {
    position: absolute;
    top: 20px;
    right: 20px;
    display: flex;
    align-items: center;
    gap: 6px;
    background: #f8f9fc;
    padding: 4px 10px;
    border-radius: 20px;
}

.indicator-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ccc;
    transition: background 0.3s;
}

.indicator-dot.connected {
    background: #00c853;
    box-shadow: 0 0 10px rgba(0, 200, 83, 0.4);
}

.status-text {
    font-size: 10px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
}

.room-icon {
    margin: 20px 0 16px;
}

.room-code-container {
    background: #f0f0f5;
    border-radius: 16px;
    padding: 16px;
    margin: 24px 0;
    cursor: pointer;
    transition: background 0.2s;
    border: 2px dashed #d1d1e0;
}

.room-code-container:active {
    background: #e6e6ea;
}

.code-label {
    font-size: 10px;
    color: #999;
    letter-spacing: 1px;
    font-weight: 700;
}

.code-value {
    font-size: 28px;
    font-weight: 800;
    color: #333;
    letter-spacing: 2px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 4px;
}

.copy-icon {
    font-size: 18px;
    color: #999;
}

.room-stats {
    display: flex;
    justify-content: space-around;
    margin-bottom: 24px;
}

.stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
}

.stat-item span {
    font-size: 12px;
    color: #666;
    font-weight: 500;
}

.instruction-box {
    text-align: left;
}

.instruction-box p {
    font-size: 13px;
    color: #666;
    text-align: center;
    margin-bottom: 16px;
}

/* Animations */
.spin {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
