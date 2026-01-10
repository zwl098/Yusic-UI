import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Socket } from 'socket.io-client'
import { useMusicStore, type Song } from './music'
import { showToast } from 'vant'
import { socketService } from '../services/socket'

interface RoomResponse {
    success: boolean
    roomId?: string
    error?: string
    currentSong?: Song
    isPlaying?: boolean
    currentTime?: number
    queue?: Song[]
}

export const useRoomStore = defineStore('room', () => {
    const socket = ref<Socket | null>(null)
    const roomId = ref<string | null>(localStorage.getItem('yusic_room_id')) // Init from storage
    const isConnected = ref(false)
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const musicStore = useMusicStore()

    const userCount = ref(0)
    const lastEmote = ref<{ emoji: string, id: number } | null>(null)
    const isSomeoneTyping = ref(false)
    let typingTimeout: any = null

    // Flag to prevent loop (when we receive an event, we apply it, but don't want to re-emit)
    let isRemoteUpdate = false

    const onConnect = () => {
        isConnected.value = true
        // Auto-rejoin if we have a roomId (from storage or ref)
        if (roomId.value) {
            console.log('Auto-rejoining room:', roomId.value)
            joinRoom(roomId.value).catch(e => {
                console.error('Failed to rejoin room after reconnect', e)
                // If room doesn't exist anymore (expired), clear storage
                if (e.message.includes("not found")) {
                    roomId.value = null
                    localStorage.removeItem('yusic_room_id')
                }
            })
        }
    }

    const onDisconnect = () => {
        isConnected.value = false
    }

    const onConnectError = (err: any) => {
        console.error('Connection error:', err)
        if (isLoading.value) { // Only show error if we were actively trying to connect/join
            error.value = "Failed to connect to server"
            isLoading.value = false
        }
    }

    const onNotification = (msg: string) => {
        showToast(msg)
    }

    const onRoomUsers = (count: number) => {
        userCount.value = count
    }

    const onEmote = (emoji: string) => {
        lastEmote.value = { emoji, id: Date.now() + Math.random() }
    }

    const onRoomTyping = () => {
        isSomeoneTyping.value = true
        if (typingTimeout) clearTimeout(typingTimeout)
        typingTimeout = setTimeout(() => {
            isSomeoneTyping.value = false
        }, 3000)
    }

    const onSyncPlay = (song: Song, time: number, senderId?: string) => {
        if (!roomId.value) return
        if (musicStore.currentSong?.id !== song.id) {
            // Song changed (Switch)
            if (senderId) {
                showToast(`User ${senderId.slice(-4)} switched to: ${song.name}`)
            }

            isRemoteUpdate = true
            musicStore.playSong(song)
            // Delay reset to avoid catching our own event
            setTimeout(() => { isRemoteUpdate = false }, 500)
        } else {
            // Even if ID matches, we might need to update lyrics if the sender has them but we don't
            if (song.lrc && musicStore.currentSong && musicStore.currentSong.lrc !== song.lrc) {
                musicStore.currentSong.lrc = song.lrc
            } else if (musicStore.currentSong && !musicStore.currentSong.lrc) {
                // Try to fetch if we don't have lyrics and remote didn't send them either
                musicStore.fetchLyrics(musicStore.currentSong)
            }


            isRemoteUpdate = true
            musicStore.audioRef?.play()
            musicStore.isPlaying = true
            // Delay reset to avoid catching our own event
            setTimeout(() => { isRemoteUpdate = false }, 500)
        }
    }

    const onSyncPause = () => {
        if (!roomId.value) return
        isRemoteUpdate = true
        musicStore.audioRef?.pause()
        musicStore.isPlaying = false
        setTimeout(() => { isRemoteUpdate = false }, 500)
    }

    const onSyncSeek = (time: number) => {
        if (!roomId.value) return
        if (musicStore.audioRef) {
            isRemoteUpdate = true
            musicStore.audioRef.currentTime = time
            setTimeout(() => { isRemoteUpdate = false }, 500)
        }
    }

    const onSyncQueue = (queue: Song[]) => {
        if (!roomId.value) return
        if (queue) {
            // Check if new songs were added (simple check: length increased)
            if (queue.length > musicStore.playList.length && isConnected.value) {
                const newSongsCount = queue.length - musicStore.playList.length
                const lastSong = queue[queue.length - 1]
                showToast(`Received ${newSongsCount} new song(s): ${lastSong?.name || 'Unknown'}`)
            }

            isRemoteUpdate = true
            musicStore.playList = queue
            setTimeout(() => { isRemoteUpdate = false }, 500)
        }
    }

    const bindEvents = () => {
        if (!socket.value) return

        socket.value.on('connect', onConnect)
        socket.value.on('disconnect', onDisconnect)
        socket.value.on('connect_error', onConnectError)
        socket.value.on('notification', onNotification)
        socket.value.on('room-users', onRoomUsers)
        socket.value.on('emote', onEmote)
        socket.value.on('room-typing', onRoomTyping)
        socket.value.on('sync:play', onSyncPlay)
        socket.value.on('sync:pause', onSyncPause)
        socket.value.on('sync:seek', onSyncSeek)
        socket.value.on('sync:queue', onSyncQueue)
    }

    const unbindEvents = () => {
        if (!socket.value) return

        socket.value.off('connect', onConnect)
        socket.value.off('disconnect', onDisconnect)
        socket.value.off('connect_error', onConnectError)
        socket.value.off('notification', onNotification)
        socket.value.off('room-users', onRoomUsers)
        socket.value.off('emote', onEmote)
        socket.value.off('room-typing', onRoomTyping)
        socket.value.off('sync:play', onSyncPlay)
        socket.value.off('sync:pause', onSyncPause)
        socket.value.off('sync:seek', onSyncSeek)
        socket.value.off('sync:queue', onSyncQueue)
    }

    const connect = () => {
        if (socket.value) return

        socket.value = socketService.getSocket()
        bindEvents()

        if (socket.value.connected) {
            isConnected.value = true
            // If we are already connected but haven't joined yet (and possess a roomId), try joining now
            if (roomId.value) {
                onConnect()
            }
        }
    }

    // Try to connect immediately if we have a saved room ID
    if (localStorage.getItem('yusic_room_id')) {
        connect()
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
                    localStorage.setItem('yusic_room_id', response.roomId)
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
                    localStorage.setItem('yusic_room_id', response.roomId)

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
                    if (response.queue) {
                        isRemoteUpdate = true
                        musicStore.playList = response.queue
                        setTimeout(() => { isRemoteUpdate = false }, 0)
                    }
                    resolve()
                } else {
                    const msg = response?.error || "Failed to join room"
                    error.value = msg
                    // If room not found, maybe clear storage?
                    if (msg === "Room not found" && roomId.value === id) {
                        roomId.value = null
                        localStorage.removeItem('yusic_room_id')
                    }
                    reject(new Error(msg))
                }
            })
        })
    }

    const emitPlay = (song: Song) => {
        if (!isRemoteUpdate && roomId.value) {
            const time = musicStore.audioRef?.currentTime || 0
            socket.value?.emit('sync:play', roomId.value, song, time)
        }
    }

    const emitPause = () => {
        if (!isRemoteUpdate && roomId.value) {
            const time = musicStore.audioRef?.currentTime || 0
            socket.value?.emit('sync:pause', roomId.value, time)
        }
    }

    const emitSeek = (time: number) => {
        if (!isRemoteUpdate && roomId.value) {
            socket.value?.emit('sync:seek', roomId.value, time)
        }
    }

    const emitQueue = (queue: Song[]) => {
        if (!isRemoteUpdate && roomId.value) {
            socket.value?.emit('sync:queue', roomId.value, queue)
        }
    }

    const emitEmote = (emoji: string) => {
        if (roomId.value) {
            socket.value?.emit('emote', roomId.value, emoji)
            // Display locally too
            onEmote(emoji)
        }
    }

    const emitTyping = () => {
        if (roomId.value) {
            socket.value?.emit('typing', roomId.value)
        }
    }

    // Watch playlist changes
    watch(() => musicStore.playList, (newQueue) => {
        if (isConnected.value && roomId.value && !isRemoteUpdate) {
            emitQueue(newQueue)
        }
    }, { deep: true })

    // Watch current song changes to sync
    watch(() => musicStore.currentSong, (newSong) => {
        if (isConnected.value && roomId.value && !isRemoteUpdate && newSong) {
            emitPlay(newSong)
        }
    }, { deep: true })

    // Watch playing state to sync (pause/resume)
    watch(() => musicStore.isPlaying, (playing) => {
        if (isConnected.value && roomId.value && !isRemoteUpdate) {
            if (playing) {
                if (musicStore.currentSong) emitPlay(musicStore.currentSong)
            } else {
                emitPause()
            }
        }
    })

    const leaveRoom = () => {
        // Do NOT disconnect the shared socket

        unbindEvents()
        socket.value = null

        roomId.value = null
        localStorage.removeItem('yusic_room_id') // Clear storage
        isConnected.value = false
        error.value = null
        isLoading.value = false
        userCount.value = 0

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
        userCount,
        lastEmote,
        isSomeoneTyping,
        createRoom,
        joinRoom,
        emitPlay,
        emitPause,
        emitSeek,
        emitEmote,
        emitTyping,
        isRemoteUpdate,
        isLoading,
        error,
        leaveRoom
    }
})
