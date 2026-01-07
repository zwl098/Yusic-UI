<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlist'
import { useMusicStore, type Song } from '@/stores/music'
import { showConfirmDialog, showToast } from 'vant'

const route = useRoute()
const router = useRouter()
const playlistStore = usePlaylistStore()
const musicStore = useMusicStore()

const playlistId = route.params.id as string
const playlist = computed(() => playlistStore.getPlaylistById(playlistId))

const onPlaySong = (song: Song) => {
    musicStore.playSong(song)
}

const onRemoveSong = (song: Song) => {
    showConfirmDialog({
        title: 'Remove Song',
        message: 'Are you sure you want to remove this song from the playlist?'
    }).then(() => {
        playlistStore.removeSongFromPlaylist(playlistId, song.id)
        showToast('Removed')
    }).catch(() => {})
}

const deletePlaylist = () => {
     showConfirmDialog({
        title: 'Delete Playlist',
        message: 'Are you sure you want to delete this playlist? This action cannot be undone.'
    }).then(() => {
        playlistStore.deletePlaylist(playlistId)
        router.back()
        showToast('Playlist Deleted')
    }).catch(() => {})
}
</script>

<template>
    <div class="playlist-detail-container" v-if="playlist">
        <van-nav-bar
            :title="playlist.name"
            left-text="Back"
            left-arrow
            @click-left="router.back()"
        >
             <template #right>
                <van-icon name="delete-o" size="18" @click="deletePlaylist" color="red" />
            </template>
        </van-nav-bar>

        <div class="playlist-header">
            <div class="cover">
                <van-icon name="music-o" size="40" color="#fff" />
            </div>
            <div class="info">
                <h1>{{ playlist.name }}</h1>
                <p>{{ playlist.songs.length }} songs</p>
                <p class="date">Created {{ new Date(playlist.createdAt).toLocaleDateString() }}</p>
            </div>
        </div>

        <div class="song-list">
             <div 
                v-for="(song, index) in playlist.songs" 
                :key="song.id" 
                class="song-item"
                @click="onPlaySong(song)"
            >
                <div class="song-index">{{ index + 1 }}</div>
                <div class="song-info">
                    <div class="song-name">{{ song.name }}</div>
                    <div class="song-artist">{{ song.artist }} - {{ song.album }}</div>
                </div>
                <div class="song-actions">
                    <van-icon name="cross" @click.stop="onRemoveSong(song)" color="#999" />
                </div>
            </div>
            <div v-if="playlist.songs.length === 0" class="empty-list">
                <p>No songs yet. Go add some!</p>
            </div>
        </div>
    </div>
    <div v-else class="not-found">
        <van-loading />
    </div>
</template>

<style scoped>
.playlist-detail-container {
    min-height: 100vh;
    background-color: #f8f9fc;
}

.playlist-header {
    padding: 24px;
    background: linear-gradient(135deg, #6200ea 0%, #9046fe 100%);
    color: white;
    display: flex;
    align-items: center;
    gap: 20px;
}

.cover {
    width: 100px;
    height: 100px;
    background: rgba(255,255,255,0.2);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.info h1 {
    margin: 0;
    font-size: 24px;
}

.info p {
    margin: 4px 0 0;
    opacity: 0.8;
    font-size: 14px;
}

.song-list {
    padding: 16px;
    background: white;
    border-radius: 20px 20px 0 0;
    margin-top: -20px;
    min-height: 50vh;
}

.song-item {
    display: flex;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #f0f0f0;
}

.song-index {
    width: 30px;
    color: #999;
    font-size: 14px;
    text-align: center;
}

.song-info {
    flex: 1;
    margin: 0 12px;
}

.song-name {
    font-weight: 500;
    color: #333;
}

.song-artist {
    font-size: 12px;
    color: #999;
    margin-top: 2px;
}

.song-actions {
    padding: 8px;
}

.empty-list {
    text-align: center;
    color: #999;
    padding: 40px;
}

.not-found {
    display: flex;
    justify-content: center;
    padding-top: 100px;
}
</style>
