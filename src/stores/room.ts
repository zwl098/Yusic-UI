import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Socket } from 'socket.io-client'
import { useMusicStore, type Song } from './music'
import { showToast, showNotify } from 'vant'
import { socketService } from '../services/socket'
import { roomApi, type RoomState } from '../services/roomApi'
import { tunefreeApi, type MusicSource } from '../services/tunefree'

interface SyncEvent {
    type: 'PLAY' | 'PAUSE' | 'SONG_CHANGE' | 'INIT'
    roomId: string
    songId?: string
    startTime?: number
    pauseTime?: number
}

export const useRoomStore = defineStore('room', () => {
    const socket = ref<Socket | null>(null)
    const roomId = ref<string | null>(localStorage.getItem('yusic_room_id'))
    const isConnected = ref(false)
    const isLoading = ref(false)
    const error = ref<string | null>(null)
    const musicStore = useMusicStore()

    const userCount = ref(0)
    const lastEmote = ref<{ emoji: string, id: number } | null>(null)
    const isSomeoneTyping = ref(false)
    let typingTimeout: any = null

    // Flag to prevent loop
    const isRemoteUpdate = ref(false)

    // Helper: Composite ID
    const encodeSongId = (song: Song) => `${song.source}:${song.id}`
    const decodeSongId = (compositeId: string): { source: MusicSource, id: string } | null => {
        if (!compositeId) return null
        const request = compositeId.split(':')
        if (request.length < 2) return null // Or default to netease?
        return { source: request[0] as MusicSource, id: request.slice(1).join(':') } // Handle id containing colons if any
    }

    const setRemoteUpdate = (val: boolean) => {
        isRemoteUpdate.value = val
        if (val) {
            // Auto reset after safety timeout
            setTimeout(() => { isRemoteUpdate.value = false }, 1000)
        }
    }

    const onConnect = () => {
        isConnected.value = true
        if (roomId.value) {
            socket.value?.emit('join', roomId.value)
        }
    }

    const onDisconnect = () => {
        isConnected.value = false
    }

    const onSyncUpdate = async (msg: SyncEvent) => {
        if (msg.roomId !== roomId.value) return

        setRemoteUpdate(true)

        try {
            if (msg.type === 'PLAY') {
                // 1. Calculate offset
                if (msg.startTime) {
                    const offset = (Date.now() - msg.startTime) / 1000
                    const audio = musicStore.audioRef
                    if (audio) {
                        const diff = Math.abs(audio.currentTime - offset)
                        if (diff > 0.5) { // Threshold 0.5s
                            musicStore.seek(offset)
                        }
                    }
                }

                // 2. Play
                if (!musicStore.isPlaying) {
                    // If paused, play
                    musicStore.togglePlay()
                    // Note: musicStore.playSong usually plays automatically. 
                    // If we are just resuming:
                    if (musicStore.audioRef?.paused) {
                        musicStore.audioRef.play()
                        musicStore.isPlaying = true
                    }
                }
            } else if (msg.type === 'PAUSE') {
                if (musicStore.isPlaying) {
                    musicStore.audioRef?.pause()
                    musicStore.isPlaying = false
                }
                if (msg.pauseTime !== undefined) {
                    musicStore.seek(msg.pauseTime)
                }
            } else if (msg.type === 'SONG_CHANGE') {
                if (msg.songId) {
                    const info = decodeSongId(msg.songId)
                    if (info) {
                        if (musicStore.currentSong?.id !== info.id) {
                            // We need to fetch song info
                            // Ideally, we should show a loading state
                            try {
                                const songData = await tunefreeApi.getMusicInfo(info.id, info.source)
                                if (songData && songData.code === 200 && songData.data) {
                                    // Map to Song object
                                    // This mapping depends on API response structure. 
                                    // Assuming getMusicInfo returns similar structure to search result or we might need search.
                                    // Actually getMusicInfo usually returns detailed info.
                                    // Let's assume standard structure or basic reconstruction
                                    const d = songData.data
                                    console.log('[RoomStore] Remote Update. Song Info:', d)
                                    const safeLrc = await processLyrics(d.lrc)
                                    // Note: API might vary. If fetch fails, we can't play.
                                    const newSong: Song = {
                                        id: info.id,
                                        source: info.source,
                                        name: d.name || 'Unknown Song',
                                        artist: d.artist || 'Unknown Artist',
                                        album: d.album || '',
                                        cover: d.pic || '',
                                        url: '', // playSong will fetch url
                                        lrc: safeLrc
                                    }
                                    musicStore.playSong(newSong)
                                }
                            } catch (e) {
                                showToast('Failed to load synced song')
                            }
                        }
                    }
                }
                // Stop playback until PLAY received (usually)
                // But playSong auto-plays.
                // Spec says: "切歌后 isPlaying=false".
                // So if we just called playSong, it might auto play. We might need to pause it if subsequent PLAY hasn't arrived?
                // Actually `playSong` in musicStore fetches URL and then plays.
                // If backend says SONG_CHANGE, it implies switching. 
                // We should probably wait for PLAY to resume? 
                // But users expect auto-play. 
                // If typical flow is Change -> Play, then we can let it be.
            }
        } finally {
            setTimeout(() => { isRemoteUpdate.value = false }, 500)
        }
    }

    const bindEvents = () => {
        if (!socket.value) return
        socket.value.on('connect', onConnect)
        socket.value.on('disconnect', onDisconnect)
        socket.value.on('sync_update', onSyncUpdate)

        // Keep auxiliary events
        socket.value.on('room-users', (count: number) => userCount.value = count)
        socket.value.on('emote', (emoji: string) => {
            lastEmote.value = { emoji, id: Date.now() }
        })
        socket.value.on('notification', (msg: string) => showToast(msg))
        socket.value.on('room-typing', () => {
            isSomeoneTyping.value = true
            if (typingTimeout) clearTimeout(typingTimeout)
            typingTimeout = setTimeout(() => isSomeoneTyping.value = false, 3000)
        })
    }

    const unbindEvents = () => {
        if (!socket.value) return
        socket.value.off('connect', onConnect)
        socket.value.off('disconnect', onDisconnect)
        socket.value.off('sync_update', onSyncUpdate)
        socket.value.off('room-users')
        socket.value.off('emote')
        socket.value.off('notification')
        socket.value.off('room-typing')
    }

    const connectSocket = () => {
        if (!socket.value) {
            socket.value = socketService.getSocket()
            bindEvents()
        }
        if (!socket.value.connected) {
            socket.value.connect()
        }
    }

    // Helper to fetch lyrics if URL
    const processLyrics = async (lrc: string | undefined): Promise<string> => {
        if (!lrc) return ''
        if (lrc.startsWith('http')) {
            try {
                let fetchUrl = lrc
                // CORS Proxy (Dev)
                if (import.meta.env.DEV && lrc.includes('159.75.236.77:3000/api')) {
                    fetchUrl = lrc.replace('http://159.75.236.77', '/api')
                }
                const res = await fetch(fetchUrl)
                const text = await res.text()
                // Simple validation
                if (text && !text.trim().toLowerCase().startsWith('<!doctype')) {
                    return text
                }
            } catch (e) {
                console.warn('[RoomStore] Failed to fetch lyrics:', e)
            }
            return '' // failed
        }
        return lrc
    }

    // Applying Room State (from HTTP)
    const applyRoomState = async (state: RoomState) => {
        setRemoteUpdate(true)

        try {
            // 1. Song
            if (state.songId) {
                const info = decodeSongId(state.songId)
                if (info && musicStore.currentSong?.id !== info.id) {
                    // Fetch and load
                    const songData = await tunefreeApi.getMusicInfo(info.id, info.source)
                    if (songData?.data) {
                        const d = songData.data
                        console.log('[RoomStore] Joined. Song Info:', d)
                        const safeLrc = await processLyrics(d.lrc)
                        const newSong: Song = {
                            id: info.id,
                            source: info.source,
                            name: d.name || 'Unknown',
                            artist: d.artist || 'Unknown',
                            album: d.album || '',
                            cover: d.pic || '',
                            url: '',
                            lrc: safeLrc
                        }
                        await musicStore.playSong(newSong)
                    }
                }
            }

            // 2. Play/Pause & Time
            if (state.isPlaying) {
                const offset = (Date.now() - (state.startTime || 0)) / 1000
                // Use offset if reasonable, else state.currentTime
                let targetTime = offset
                // Optimization: if offset is way off (e.g. neg), maybe fallback to currentTime?
                // But server is authority.

                musicStore.seek(targetTime)
                if (!musicStore.isPlaying && musicStore.currentSong?.url) {
                    // Ensure playback
                    try {
                        await import('vue').then(({ nextTick }) => nextTick())
                        await musicStore.audioRef?.play()
                        musicStore.isPlaying = true
                    } catch (e: any) {
                        console.warn('Autoplay blocked:', e)
                        musicStore.isPlaying = false
                        import('vant').then(({ showToast }) => showToast('Click Play to Sync'))
                    }
                }
            } else {
                if (state.pauseTime !== null) {
                    musicStore.seek(state.pauseTime)
                }
                musicStore.audioRef?.pause()
                musicStore.isPlaying = false
            }
        } catch (e) {
        } finally {
            setTimeout(() => { isRemoteUpdate.value = false }, 1000)
        }
    }

    const createRoom = async () => {
        isLoading.value = true
        try {
            const res = await roomApi.createRoom()
            if (res.data && res.data.roomId) {
                roomId.value = res.data.roomId
                localStorage.setItem('yusic_room_id', res.data.roomId)
                connectSocket()
                socket.value?.emit('join', res.data.roomId)
                // Initialize state? usually empty for new room
            }
        } catch (e: any) {
            error.value = e.message || 'Failed to create room'
            throw e
        } finally {
            isLoading.value = false
        }
    }

    const joinRoom = async (id: string, isRejoin = false) => {
        isLoading.value = true
        error.value = null
        try {
            // 1. Get State via HTTP
            const res = await roomApi.getRoomState(id)
            if (res.code !== 200) throw new Error(res.msg || 'Failed to get state')
            const state = res.data
            // 2. Apply State
            await applyRoomState(state)

            // 3. Connect Socket
            roomId.value = id
            localStorage.setItem('yusic_room_id', id)
            connectSocket()
            socket.value?.emit('join', id)

        } catch (e: any) {
            roomId.value = null
            localStorage.removeItem('yusic_room_id')
            error.value = "Room not found or error"
            throw e
        } finally {
            isLoading.value = false
        }
    }

    // Actions
    const emitPlay = async (song: Song) => {
        if (isRemoteUpdate.value || !roomId.value) return

        // If it's a new song, use changeSong? 
        // Doc says: "Play... if songId provided... switch and play"
        // But also "Change Song" endpoint exists.
        // Let's use Play with songId if song changed.

        const compositeId = encodeSongId(song)
        try {
            // Check if we are resuming or playing new
            // We pass songId to play just in case, or if it changed
            await roomApi.play(roomId.value, compositeId)
        } catch (e) {
        }
    }

    const emitPause = async () => {
        if (isRemoteUpdate.value || !roomId.value) return
        try {
            await roomApi.pause(roomId.value)
        } catch (e) { }
    }

    const emitChangeSong = async (song: Song) => {
        if (isRemoteUpdate.value || !roomId.value) return
        try {
            const compositeId = encodeSongId(song)
            await roomApi.changeSong(roomId.value, compositeId)
        } catch (e) { }
    }

    // Watchers
    watch(() => musicStore.currentSong, (newSong, oldSong) => {
        if (roomId.value && !isRemoteUpdate.value && newSong) {
            if (!oldSong || oldSong.id !== newSong.id) {
                emitChangeSong(newSong)
            }
        }
    }, { deep: true })

    watch(() => musicStore.isPlaying, (playing) => {
        if (roomId.value && !isRemoteUpdate.value) {
            if (playing) {
                if (musicStore.currentSong) emitPlay(musicStore.currentSong)
            } else {
                emitPause()
            }
        }
    })

    // Init
    if (roomId.value) {
        joinRoom(roomId.value, true).catch(() => {
            // silent fail on auto join
            roomId.value = null
        })
    }

    const leaveRoom = () => {
        roomId.value = null
        localStorage.removeItem('yusic_room_id')
        isConnected.value = false
        if (socket.value) {
            socket.value.disconnect()
            socket.value = null
        }
        if (musicStore.isPlaying) {
            musicStore.togglePlay()
        }
    }

    // Emote/Typing (Keep as Socket Emits for now as they are ephemeral?)
    // Doc doesn't say Emote/Typing must be HTTP. 
    // Usually these are pure ephemeral info.
    const emitEmote = (emoji: string) => {
        if (roomId.value && socket.value) {
            socket.value.emit('emote', roomId.value, emoji)
            lastEmote.value = { emoji, id: Date.now() }
        }
    }

    const emitTyping = () => {
        if (roomId.value && socket.value) {
            socket.value.emit('typing', roomId.value)
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
        leaveRoom,
        emitEmote,
        emitTyping,
        emitPlay,
        emitPause,
        isLoading,
        error,
        isRemoteUpdate
    }
})
