import { defineStore } from 'pinia'
import { ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { useMusicStore, type Song } from './music'

export const useRoomStore = defineStore('room', () => {
    const socket = ref<Socket | null>(null)
    const roomId = ref<string | null>(null)
    const isConnected = ref(false)
    const musicStore = useMusicStore()

    // Flag to prevent loop (when we receive an event, we apply it, but don't want to re-emit)
    let isRemoteUpdate = false

    const connect = () => {
        if (socket.value) return

        const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'
        socket.value = io(socketUrl)

        socket.value.on('connect', () => {
            isConnected.value = true
        })

        socket.value.on('disconnect', () => {
            isConnected.value = false
        })

        socket.value.on('room-created', (id: string) => {
            roomId.value = id
        })

        socket.value.on('joined-room', (data: { roomId: string, currentSong: Song, isPlaying: boolean, currentTime: number }) => {
            roomId.value = data.roomId
            if (data.currentSong) {
                isRemoteUpdate = true
                musicStore.playSong(data.currentSong)
                if (!data.isPlaying) {
                    // If it was playing in store but paused in room, we might need to pause? 
                    // playSong sets isPlaying=true.
                    setTimeout(() => musicStore.audioRef?.pause(), 100)
                    musicStore.isPlaying = false
                }
                isRemoteUpdate = false
            }
        })

        socket.value.on('sync:play', (song: Song) => {
            if (musicStore.currentSong?.id !== song.id) {
                isRemoteUpdate = true
                musicStore.playSong(song)
                isRemoteUpdate = false
            } else {
                isRemoteUpdate = true
                musicStore.audioRef?.play()
                musicStore.isPlaying = true
                isRemoteUpdate = false
            }
        })

        socket.value.on('sync:pause', () => {
            isRemoteUpdate = true
            musicStore.audioRef?.pause()
            musicStore.isPlaying = false
            isRemoteUpdate = false
        })

        socket.value.on('sync:seek', (time: number) => {
            if (musicStore.audioRef) {
                isRemoteUpdate = true
                musicStore.audioRef.currentTime = time
                isRemoteUpdate = false
            }
        })
    }

    const createRoom = () => {
        connect()
        socket.value?.emit('create-room')
    }

    const joinRoom = (id: string) => {
        connect()
        socket.value?.emit('join-room', id)
    }

    // Hooks to be called from UI or MusicStore watcher 
    const emitPlay = (song: Song) => {
        if (!isRemoteUpdate && roomId.value) {
            socket.value?.emit('sync:play', roomId.value, song)
        }
    }

    const emitPause = () => {
        if (!isRemoteUpdate && roomId.value) {
            socket.value?.emit('sync:pause', roomId.value)
        }
    }

    // Optional: Emit seek if we can capture it easily
    const emitSeek = (time: number) => {
        if (!isRemoteUpdate && roomId.value) {
            socket.value?.emit('sync:seek', roomId.value, time)
        }
    }

    return {
        socket,
        roomId,
        isConnected,
        createRoom,
        joinRoom,
        emitPlay,
        emitPause,
        emitSeek,
        isRemoteUpdate
    }
})
