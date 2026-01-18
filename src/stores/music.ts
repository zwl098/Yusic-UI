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
                    url: item.url.replace(/http:/g, 'https:'),
                    cover: item.pic.replace(/http:/g, 'https:')
                }))
            }
            return []
        } catch (error) {
            return []
        }
    }

    const fetchLyrics = async (song: Song) => {
        // 1. If we have lyrics text (not URL), we are done.
        if (song.lrc && !song.lrc.startsWith('http')) return

        let lyricText: string | null = null

        try {
            // 2. Determine the source: Existing URL or API?
            if (song.lrc && song.lrc.startsWith('http')) {
                console.log('[MusicStore] Using existing lyrics URL:', song.lrc)
                lyricText = song.lrc
            } else {
                // console.log('[MusicStore] No lyrics URL, calling API...')
                const res = await tunefreeApi.getLyric(song.id, song.source)

                // Process API response
                if (typeof res === 'string') {
                    lyricText = res
                } else if (res.code === 200 || (res.data && typeof res.data === 'string')) {
                    if (typeof res.data === 'string') {
                        lyricText = res.data
                    } else if (res.data && res.data.lrc) {
                        lyricText = res.data.lrc
                    } else {
                        lyricText = JSON.stringify(res.data)
                    }
                } else if (res.lrc) {
                    lyricText = res.lrc
                }
            }

            // 3. If we have a URL now, fetch its content
            if (lyricText && lyricText.startsWith('http')) {
                console.log('[MusicStore] Fetching content from URL...')

                // CORS Proxy Fix for Dev
                let fetchUrl = lyricText
                if (import.meta.env.DEV && lyricText.includes('music-dl.sayqz.com/api')) {
                    fetchUrl = lyricText.replace('https://music-dl.sayqz.com/api', '/api')
                    console.log('[MusicStore] Rewrote URL for proxy:', fetchUrl)
                }

                try {
                    const lyrRes = await fetch(fetchUrl)
                    const text = await lyrRes.text()
                    // Verify it's not HTML (sometimes 404 returns html)
                    if (!text.trim().toLowerCase().startsWith('<!doctype')) {
                        lyricText = text
                        console.log('[MusicStore] Fetched lyric content length:', lyricText.length)
                    } else {
                        console.warn('[MusicStore] Fetched content looks like HTML (error page?), keeping URL.')
                    }
                } catch (err) {
                    console.warn('[MusicStore] Failed to fetch lyric URL:', err)
                }
            }

            // 4. Update State
            if (lyricText && !lyricText.startsWith('http')) {
                song.lrc = lyricText
                // Trigger reactivity update if song is currentSong
                if (currentSong.value && currentSong.value.id === song.id) {
                    currentSong.value.lrc = song.lrc
                }
            }
        } catch (e) {
            console.error('[MusicStore] fetchLyrics error:', e)
            song.lrc = '[00:00.00] Lyrics load failed'
            if (currentSong.value && currentSong.value.id === song.id) {
                currentSong.value.lrc = song.lrc
            }
        }
    }

    // Keep track of the current object URL to revoke it
    let currentObjectUrl: string | null = null

    const updateMediaSession = () => {
        if ('mediaSession' in navigator && currentSong.value) {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: currentSong.value.name,
                artist: currentSong.value.artist,
                album: currentSong.value.album || 'Yusic',
                artwork: [
                    { src: currentSong.value.cover || 'https://via.placeholder.com/512', sizes: '512x512', type: 'image/jpeg' }
                ]
            })

            navigator.mediaSession.setActionHandler('play', () => {
                togglePlay()
            })
            navigator.mediaSession.setActionHandler('pause', () => {
                togglePlay()
            })
            navigator.mediaSession.setActionHandler('previoustrack', () => {
                // For now, seek to 0 as we don't have history stack yet
                seek(0)
            })
            navigator.mediaSession.setActionHandler('nexttrack', () => {
                playNext()
            })
        }
    }

    const playSong = async (song: Song) => {
        currentSong.value = song
        // Don't set isPlaying true immediately to avoid buffering glitches, wait for load

        // Fetch lyrics if missing (Background)
        fetchLyrics(song)

        // Update Media Session
        updateMediaSession()

        // Cleanup previous Blob URL
        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl)
            currentObjectUrl = null
        }


        try {
            // 1. Get Fresh URL via direct link (Backend redirects to file)
            // console.log('[MusicStore] Constructing URL for:', song.name, song.id)
            const finalUrl = tunefreeApi.getAudioSrc(song.id, song.source)

            if (finalUrl) {
                // Update URL
                if (currentSong.value && currentSong.value.id === song.id) {
                    currentSong.value.url = finalUrl
                }
            } else {
                console.error('[MusicStore] Failed to generate URL')
            }

            // 3. Play
            // Use nextTick to allow Vue to update ref/src, but keep within microtask for iOS
            import('vue').then(({ nextTick }) => {
                nextTick(() => {
                    const audio = audioRef.value
                    if (audio && currentSong.value?.url) {
                        const playPromise = audio.play()
                        if (playPromise !== undefined) {
                            playPromise.catch(error => {
                                import('vant').then(({ showFailToast }) => {
                                    showFailToast({
                                        message: `Play Error: ${error.name}`,
                                        duration: 3000
                                    })
                                })
                                isPlaying.value = false // Sync state
                            })
                        }
                    }
                })
            })

        } catch (e: any) {
            import('vant').then(({ showFailToast }) => {
                showFailToast(`Error: ${e.message}`)
            })
        }
    }

    const togglePlay = () => {
        console.log('[MusicStore] togglePlay called. state:', {
            playing: isPlaying.value,
            hasUrl: !!currentSong.value?.url,
            hasAudio: !!audioRef.value,
            volume: audioRef.value?.volume,
            paused: audioRef.value?.paused
        })

        if (currentSong.value && audioRef.value) {
            if (isPlaying.value) {
                audioRef.value.pause()
                isPlaying.value = false
            } else {
                if (currentSong.value.url) {
                    audioRef.value.play().then(() => {
                        console.log('[MusicStore] Manual play succeeded')
                    }).catch(e => {
                        // Ignore AbortError (interrupted by pause)
                        if (e.name === 'AbortError') {
                            console.log('[MusicStore] Play interrupted (normal)')
                            return
                        }
                        console.warn('[MusicStore] Manual play failed:', e)
                        isPlaying.value = false
                        import('vant').then(({ showToast }) => showToast(`Play failed: ${e.message}`))
                    })
                    isPlaying.value = true
                } else {
                    console.warn('[MusicStore] Toggle Play ignored: No URL')
                    import('vant').then(({ showToast }) => showToast('Song is loading...'))
                }
            }
        } else {
            console.warn('[MusicStore] Toggle Play ignored: No song or audio ref')
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

            console.log('[MusicStore] Hijacking audio for visualization...')
            const source = ctx.createMediaElementSource(audioRef.value)
            source.connect(ana)
            ana.connect(ctx.destination)

            audioContext.value = ctx
            analyser.value = ana
        } catch (e) {
            console.error('[MusicStore] AudioContext init failed:', e)
        }
    }

    const shutdownAudioContext = async () => {
        if (audioContext.value) {
            try {
                console.log('[MusicStore] Releasing audio context for background play...')
                // Closing content releases the media element from the graph
                await audioContext.value.close()
            } catch (e) {
                console.warn('[MusicStore] Context close error:', e)
            } finally {
                audioContext.value = null
                analyser.value = null
            }
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
        initAudioContext,
        shutdownAudioContext
    }
})
