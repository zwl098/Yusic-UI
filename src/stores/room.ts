import { defineStore } from 'pinia'
import { ref } from 'vue'
import { io, type Socket } from 'socket.io-client'
import { useMusicStore, type Song } from './music'

interface RoomResponse {
  success: boolean
  roomId?: string
  error?: string
  currentSong?: Song
  isPlaying?: boolean
  currentTime?: number
}

export const useRoomStore = defineStore('room', () => {
    const socket = ref<Socket | null>(null)
    const roomId = ref<string | null>(null)
    const isConnected = ref(false)
    const isLoading = ref(false)
    const error = ref<string | null>(null)
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

        socket.value.on('connect_error', (err) => {
            console.error('Connection error:', err)
            error.value = "Failed to connect to server"
            isLoading.value = false
        })

        // Legacy listeners removed in favor of callbacks
        /*
        socket.value.on('room-created', (id: string) => {
            roomId.value = id
        })

        socket.value.on('joined-room', ... )
        */

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

    const createRoom = async () => {
        connect()
        isLoading.value = true
        error.value = null
        
        return new Promise<void>((resolve, reject) => {
             const timeout = setTimeout(() => {
                 isLoading.value = false
                 error.value = "Connection timeout"
                 reject(new Error("Connection timeout"))
             }, 5000)

             socket.value?.emit('create-room', (response: RoomResponse) => {
                 clearTimeout(timeout)
                 isLoading.value = false
                 if (response && response.success && response.roomId) {
                     roomId.value = response.roomId
                     resolve()
                 } else {
                     error.value = "Failed to create room"
                     reject(new Error("Failed to create room"))
                 }
             })
        })
    }

    const joinRoom = async (id: string) => {
        connect()
        isLoading.value = true
        error.value = null

        return new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                isLoading.value = false
                error.value = "Connection timeout"
                reject(new Error("Connection timeout"))
            }, 5000)

            socket.value?.emit('join-room', id, (response: RoomResponse) => {
                clearTimeout(timeout)
                isLoading.value = false
                if (response && response.success && response.roomId) {
                    roomId.value = response.roomId
                    // Apply state
                    if (response.currentSong) {
                        isRemoteUpdate = true
                        musicStore.playSong(response.currentSong)
                        if (!response.isPlaying) {
                            setTimeout(() => musicStore.audioRef?.pause(), 100)
                            musicStore.isPlaying = false
                        } else {
                             // If it IS playing, we might need to seek
                             if (response.currentTime !== undefined && response.currentTime > 0) {
                                 musicStore.audioRef!.currentTime = response.currentTime
                             }
                        }
                        isRemoteUpdate = false
                    }
                    resolve()
                } else {
                    const msg = response?.error || "Failed to join room"
                    error.value = msg
                    reject(new Error(msg))
                }
            })
        })
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

    const leaveRoom = () => {
        if (socket.value) {
            socket.value.disconnect()
            socket.value = null
        }
        roomId.value = null
        isConnected.value = false
        error.value = null
        isLoading.value = false
        
        // Stop music
        if (musicStore.audioRef) {
            musicStore.audioRef.pause()
            musicStore.isPlaying = false
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
        isRemoteUpdate,
        isLoading,
        error,
        leaveRoom
    }
})
