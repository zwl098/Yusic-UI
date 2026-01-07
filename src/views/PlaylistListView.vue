<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlist'
import { showDialog } from 'vant'

const router = useRouter()
const playlistStore = usePlaylistStore()
const showCreateDialog = ref(false)
const newPlaylistName = ref('')

const onCreatePlaylist = () => {
    showCreateDialog.value = true
}

const confirmCreate = () => {
    if (newPlaylistName.value.trim()) {
        playlistStore.createPlaylist(newPlaylistName.value.trim())
        newPlaylistName.value = ''
        showCreateDialog.value = false
    }
}

const goToPlaylist = (id: string) => {
    router.push(`/playlists/${id}`)
}
</script>

<template>
    <div class="playlist-list-container">
        <div class="header">
            <van-nav-bar
                title="Your Playlists"
                left-text="Back"
                left-arrow
                @click-left="router.back()"
            >
                <template #right>
                    <van-icon name="plus" size="18" @click="onCreatePlaylist" />
                </template>
            </van-nav-bar>
        </div>

        <div class="content">
            <div v-if="playlistStore.playlists.length === 0" class="empty-state">
                <van-icon name="music-o" size="64" color="#ddd" />
                <p>No playlists yet</p>
                <van-button type="primary" size="small" @click="onCreatePlaylist">Create One</van-button>
            </div>

            <div v-else class="playlist-grid">
                <div 
                    v-for="playlist in playlistStore.playlists" 
                    :key="playlist.id" 
                    class="playlist-card"
                    @click="goToPlaylist(playlist.id)"
                >
                    <div class="card-cover">
                        <div class="cover-placeholder">
                             <van-icon name="music-o" size="32" color="#fff" />
                        </div>
                        <div class="song-count">{{ playlist.songs.length }} songs</div>
                    </div>
                    <div class="card-info">
                        <h3>{{ playlist.name }}</h3>
                        <p>{{ new Date(playlist.createdAt).toLocaleDateString() }}</p>
                    </div>
                </div>
            </div>
        </div>

        <van-dialog v-model:show="showCreateDialog" title="New Playlist" show-cancel-button @confirm="confirmCreate">
            <div class="dialog-input">
                <van-field v-model="newPlaylistName" placeholder="Playlist Name" />
            </div>
        </van-dialog>
    </div>
</template>

<style scoped>
.playlist-list-container {
    min-height: 100vh;
    background-color: #f8f9fc;
    padding-bottom: 20px;
}

.content {
    padding: 16px;
}

.empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding-top: 100px;
    color: #999;
    gap: 16px;
}

.playlist-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
}

.playlist-card {
    background: white;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.card-cover {
    height: 120px;
    background: linear-gradient(135deg, #6200ea 0%, #aaa 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
}

.song-count {
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(0,0,0,0.5);
    color: white;
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
}

.card-info {
    padding: 12px;
}

.card-info h3 {
    margin: 0;
    font-size: 14px;
    color: #333;
}

.card-info p {
    margin: 4px 0 0;
    font-size: 12px;
    color: #999;
}

.dialog-input {
    padding: 20px;
}
</style>
