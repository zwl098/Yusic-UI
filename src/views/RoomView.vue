<script setup lang="ts">
import { ref } from 'vue'
import { useRoomStore } from '@/stores/room'
import { useRouter } from 'vue-router'

const roomStore = useRoomStore()
const router = useRouter()
const roomIdInput = ref('')

const onCreateRoom = () => {
  roomStore.createRoom()
}

const onJoinRoom = () => {
  if (roomIdInput.value) {
    roomStore.joinRoom(roomIdInput.value)
  }
}

const onBack = () => {
    router.push('/')
}
</script>

<template>
  <div class="room-container">
    <div class="header">
        <van-icon name="arrow-left" size="24" @click="onBack" />
        <h2>Listen Together</h2>
    </div>

    <div v-if="!roomStore.roomId" class="actions">
      <div class="action-card create" @click="onCreateRoom">
        <van-icon name="add-o" size="48" />
        <h3>Create Room</h3>
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
             <van-button size="small" type="primary" @click="onJoinRoom" :disabled="!roomIdInput">Join</van-button>
          </template>
        </van-field>
      </div>
    </div>

    <div v-else class="active-room">
      <div class="room-status">
         <van-icon name="music-o" size="64" color="#6200ea" class="status-icon" />
         <h3>Connected to Room</h3>
         <div class="room-code">
            <span>{{ roomStore.roomId }}</span>
            <van-tag type="primary" size="medium">Active</van-tag>
         </div>
         <p class="instruction">Play a song to sync with everyone!</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.room-container {
  min-height: 100vh;
  background: #f8f9fc;
  padding: 24px;
  font-family: 'Inter', sans-serif;
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
    color: #999;
    font-weight: 600;
    font-size: 14px;
}

.action-card {
  background: white;
  border-radius: 20px;
  padding: 32px 24px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  transition: transform 0.2s;
  cursor: pointer;
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

.active-room {
  text-align: center;
  padding-top: 60px;
}

.room-status {
    background: white;
    border-radius: 24px;
    padding: 48px 24px;
    box-shadow: 0 10px 40px rgba(98, 0, 234, 0.1);
    max-width: 320px;
    margin: 0 auto;
}

.status-icon {
    margin-bottom: 24px;
    animation: bounce 2s infinite;
}

.room-code {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    font-size: 32px;
    font-weight: 800;
    color: #333;
    margin: 16px 0;
    background: #f0f0f0;
    padding: 12px 24px;
    border-radius: 12px;
    letter-spacing: 2px;
}

.instruction {
    color: #666;
    margin: 0;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {transform: translateY(0);}
  40% {transform: translateY(-10px);}
  60% {transform: translateY(-5px);}
}
</style>
