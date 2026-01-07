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
                    url: item.url,
                    cover: item.pic,
                    lrc: item.lrc
                }))
            }
            return []
        } catch (error) {
            console.error('Search failed:', error)
            return []
        }
    }

    const playSong = async (song: Song) => {
        currentSong.value = song
        isPlaying.value = true

        // Attempt to auto-play if audio element is ready
        if (audioRef.value) {
            setTimeout(() => {
                audioRef.value?.play().catch(e => {
                    console.warn('Autoplay prevented:', e)
                })
            }, 100)
        }
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

    return {
        currentSong,
        isPlaying,
        playList,
        searchMusic,
        playSong,
        togglePlay,
        audioRef
    }
})
