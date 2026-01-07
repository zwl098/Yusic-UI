import { defineStore } from 'pinia'
import { ref } from 'vue'
import { io } from 'socket.io-client'
import type { Song } from './music'

export interface Playlist {
    id: string
    name: string
    createdAt: number
    songs: Song[]
}

export const usePlaylistStore = defineStore('playlist', () => {
    const playlists = ref<Playlist[]>([])
    const currentPlaylist = ref<Playlist | null>(null)
    const socket = io('http://localhost:3000')

    // Initial load
    socket.emit('playlist:get-all')

    socket.on('playlist:list', (list: Playlist[]) => {
        playlists.value = list
        // Update current playlist if it exists
        if (currentPlaylist.value) {
            const updated = list.find(p => p.id === currentPlaylist.value?.id)
            if (updated) {
                currentPlaylist.value = updated
            }
        }
    })

    socket.on('playlist:updated', (playlist: Playlist) => {
        const index = playlists.value.findIndex(p => p.id === playlist.id)
        if (index !== -1) {
            playlists.value[index] = playlist
        }
        if (currentPlaylist.value?.id === playlist.id) {
            currentPlaylist.value = playlist
        }
    })

    const createPlaylist = (name: string) => {
        socket.emit('playlist:create', name)
    }

    const deletePlaylist = (id: string) => {
        socket.emit('playlist:delete', id)
    }

    const addSongToPlaylist = (playlistId: string, song: Song) => {
        socket.emit('playlist:add', { playlistId, song })
    }

    const removeSongFromPlaylist = (playlistId: string, songId: string) => {
        socket.emit('playlist:remove', { playlistId, songId })
    }

    const getPlaylistById = (id: string) => {
        return playlists.value.find(p => p.id === id)
    }

    return {
        playlists,
        currentPlaylist,
        createPlaylist,
        deletePlaylist,
        addSongToPlaylist,
        removeSongFromPlaylist,
        getPlaylistById
    }
})
