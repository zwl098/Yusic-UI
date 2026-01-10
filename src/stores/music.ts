import { defineStore } from 'pinia'
import { ref } from 'vue'
import { tunefreeApi, type MusicSource } from '@/services/tunefree'

export interface Song {
    id: string
    name: string
    artist: string
    album: string
    source: MusicSource
    url: string
    cover: string
    lrc?: string
}

export const useMusicStore = defineStore('music', () => {
    const currentSong = ref<Song | null>(null)
    const isPlaying = ref(false)
    const playList = ref<Song[]>([])
    const audioRef = ref<HTMLAudioElement | null>(null)
    const currentTime = ref(0)
    const duration = ref(0)

    const searchMusic = async (keyword: string, source: MusicSource = 'netease') => {
        try {
            const res = await tunefreeApi.search(keyword, source)
            if (res.code === 200 && res.data && res.data.results) {
                return res.data.results.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    artist: item.artist,
                    album: item.album,
                    source: item.platform || source,
                    url: item.url.replace(/^http:/, 'https:'),
                    cover: item.pic.replace(/^http:/, 'https:')
                    // lrc: item.lrc // Ignore lyrics from search results, fetch via API
                }))
            }
            return []
        } catch (error) {
            console.error('Search failed:', error)
            return []
        }
    }

    const fetchLyrics = async (song: Song) => {
        // If we already have lyrics and it's not a URL (basic check), return
        // But since we don't set it in searchMusic, it should be empty initially.
        if (song.lrc && !song.lrc.startsWith('http')) return

        console.log('[MusicStore] Lyrics missing/invalid for:', song.name, 'Fetching via API...')

        try {
            // Priority: API getLyric
            console.log('[MusicStore] Fetching via API...')
            const res = await tunefreeApi.getLyric(song.id, song.source)
            console.log('[MusicStore] Lyric API response:', res)

            // Direct string response
            if (typeof res === 'string') {
                song.lrc = res
                return
            }

            // Object response
            if (res.code === 200 || (res.data && typeof res.data === 'string')) { // Some APIs strictly return 200, others might just return data
                if (typeof res.data === 'string') {
                    song.lrc = res.data
                } else if (res.data && res.data.lrc) {
                    song.lrc = res.data.lrc
                } else {
                    song.lrc = JSON.stringify(res.data)
                }
            } else if (res.lrc) {
                // Fallback for flat object
                song.lrc = res.lrc
            }

            // Trigger reactivity update if song is currentSong
            if (currentSong.value && currentSong.value.id === song.id) {
                // Pinia state is reactive.
            }
        } catch (e) {
            console.error('[MusicStore] Failed to fetch lyrics:', e)
            song.lrc = '[00:00.00] Lyrics load failed'
        }
    }

    const playSong = async (song: Song) => {
        currentSong.value = song
        isPlaying.value = true

        // Fetch lyrics if missing (Background)
        fetchLyrics(song)

        // Attempt to auto-play if audio element is ready
        // Attempt to auto-play if audio element is ready
        // Use nextTick to allow Vue to update ref/src, but keep within microtask for iOS
        import('vue').then(({ nextTick }) => {
            nextTick(() => {
                const audio = audioRef.value
                if (audio) {
                    const playPromise = audio.play()
                    if (playPromise !== undefined) {
                        playPromise.catch(error => {
                            console.warn('[MusicStore] Autoplay prevented or interrupted:', error)
                            isPlaying.value = false // Sync state
                        })
                    }
                }
            })
        })
    }

    const togglePlay = () => {
        if (currentSong.value && audioRef.value) {
            if (isPlaying.value) {
                audioRef.value.pause()
            } else {
                audioRef.value.play()
            }
            isPlaying.value = !isPlaying.value
        }
    }

    const addToQueue = (song: Song) => {
        if (playList.value.some(item => item.id === song.id)) return false
        playList.value.push(song)

        // Auto-play if not playing
        if (!currentSong.value) {
            playSong(song)
        }

        return true
    }

    const playNext = () => {
        if (playList.value.length > 0) {
            const nextSong = playList.value.shift()
            if (nextSong) {
                playSong(nextSong)
            }
        } else {
            // Optional: Stop playing or loop? For now just stop if nothing else.
            // But we might want to keep the current song loaded but paused?
            // Or simply do nothing.
            // If we want to support "Auto-Radio" later, this is where we'd fetch a new song.
            isPlaying.value = false
        }
    }

    const insertToNext = (song: Song) => {
        // Remove if already exists to avoid duplicates? Or allow duplicates?
        // Let's remove duplicates for better UX
        const idx = playList.value.findIndex(item => item.id === song.id)
        if (idx > -1) {
            playList.value.splice(idx, 1)
        }
        playList.value.unshift(song)
    }

    const removeFromQueue = (index: number) => {
        if (index >= 0 && index < playList.value.length) {
            playList.value.splice(index, 1)
        }
    }

    const clearQueue = () => {
        playList.value = []
    }

    const seek = (time: number) => {
        if (audioRef.value) {
            audioRef.value.currentTime = time
            currentTime.value = time
        }
    }

    const audioContext = ref<AudioContext | null>(null)
    const analyser = ref<AnalyserNode | null>(null)

    const initAudioContext = () => {
        if (!audioRef.value || audioContext.value) return

        try {
            const AudioContextIdx = window.AudioContext || (window as any).webkitAudioContext
            const ctx = new AudioContextIdx()
            const ana = ctx.createAnalyser()
            ana.fftSize = 512

            const source = ctx.createMediaElementSource(audioRef.value)
            source.connect(ana)
            ana.connect(ctx.destination)

            audioContext.value = ctx
            analyser.value = ana
            console.log('[MusicStore] AudioContext initialized')
        } catch (e) {
            console.error('[MusicStore] Failed to init AudioContext:', e)
        }
    }

    return {
        currentSong,
        isPlaying,
        playList,
        searchMusic,
        playSong,
        togglePlay,
        addToQueue,
        playNext,
        insertToNext,
        removeFromQueue,
        clearQueue,
        seek,
        fetchLyrics,
        currentTime,
        duration,
        audioRef,
        audioContext,
        analyser,
        initAudioContext
    }
})

