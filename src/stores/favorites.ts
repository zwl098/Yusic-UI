import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { type Song, useMusicStore } from './music'
import { showToast } from 'vant'

const STORAGE_KEY = 'yusic_favorites'

export const useFavoritesStore = defineStore('favorites', () => {
    const favorites = ref<Song[]>([])
    const musicStore = useMusicStore()

    // Initialize from local storage
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
        try {
            favorites.value = JSON.parse(stored)
        } catch (e) {
            console.error('Failed to load favorites', e)
        }
    }

    // Persistence watcher
    watch(favorites, (val) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    }, { deep: true })

    const isFavorite = (id: string) => {
        return favorites.value.some(s => s.id === id)
    }

    const toggleFavorite = (song: Song | null | undefined) => {
        if (!song) return
        if (isFavorite(song.id)) {
            favorites.value = favorites.value.filter(s => s.id !== song.id)
            showToast('Removed from Favorites 💔')
        } else {
            favorites.value.unshift(song)
            showToast('Added to Favorites ❤️')
        }
    }

    const playRandomFavorite = () => {
        if (favorites.value.length === 0) {
            showToast('No favorites yet! Go like some songs first.')
            return
        }
        const randomIndex = Math.floor(Math.random() * favorites.value.length)
        const song = favorites.value[randomIndex]
        musicStore.playSong(song)
        showToast(`Playing favorite: ${song.name} 🎲`)
    }

    return {
        favorites,
        isFavorite,
        toggleFavorite,
        playRandomFavorite
    }
})
