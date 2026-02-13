import { request, BASE_URL } from './request'

export interface SongInfo {
    id: string
    name: string
    artist: string
    album: string
    pic: string
    url: string
    lrc: string
    source: string
}

export type MusicSource = 'netease' | 'kuwo' | 'qq'

export const tunefreeApi = {
    // Simple in-memory cache
    _cache: new Map<string, { data: any, timestamp: number }>(),

    /**
     * Search for music
     * @param keyword Search keyword
     * @param source Music source (netease, kuwo, qq)
     * @param limit Number of results
     * @param page Page number
     */
    search: async (keyword: string, source: MusicSource = 'netease', limit = 20, page = 1) => {
        const cacheKey = `search:${keyword}:${source}:${page}:${limit}`
        const cached = tunefreeApi._cache.get(cacheKey)
        const now = Date.now()

        if (cached && (now - cached.timestamp < 1000 * 60 * 5)) { // 5 minutes TTL
            console.log('[API] Cache hit for:', cacheKey)
            return Promise.resolve(cached.data)
        }

        // Changed from ?type=search to /music/search
        const res = await request<any>('/music/search', {
            params: { keyword, platform: source, limit, page }
        })

        if (res.code === 200) {
            tunefreeApi._cache.set(cacheKey, { data: res, timestamp: now })
        }
        return res
    },

    /**
     * Get playing URL for a song
     * @param id Song ID
     * @param source Music source
     */
    getMusicUrl: (id: string, source: MusicSource) => {
        return request<any>('/music/url', {
            params: { id, platform: source }
        })
    },

    /**
     * Get song details including cover
     * @param id Song ID
     * @param source Music source
     */
    getMusicInfo: (id: string, source: MusicSource) => {
        // Not implemented in backend yet, using search or specific details if needed
        // For now, keep it as placeholder or remove if unused
        return Promise.reject('Not implemented')
    },

    /**
     * Get song lyrics
     * @param id Song ID
     * @param source Music source
     */
    getLyric: (id: string, source: MusicSource) => {
        return request<string | any>('/music/lrc', {
            params: { id, platform: source }
        })
    },

    /**
     * Get Album Pick
     * @param id Song ID
     * @param source Music source
     */
    getPic: (id: string, source: MusicSource) => {
        return request<any>('/music/pic', {
            params: { id, platform: source }
        })
    },

    /**
     * Get direct audio source URL (Async now!)
     */
    getAudioSrc: async (id: string, source: MusicSource) => {
        // We need to fetch the real URL from backend because backend proxies it or gets it from upstream
        // The old way was returning a string directly because it assumed a proxy endpoint.
        // Now we use getMusicUrl to get the REAL url.
        try {
            const res = await tunefreeApi.getMusicUrl(id, source)
            if (res.code === 200 && res.data) {
                // If it's a full URL, we might need to proxy it through our stream endpoint if it has CORS issues
                // But MusicService.getUrl already returns a clean URL or one that needs proxying?
                // Actually, MusicService.getUrl returns the upstream URL.
                // We should use our stream proxy if needed.
                // For now, let's try returning the URL directly.

                // Optimization: If we want to use the stream proxy:
                // return `${BASE_URL}/music/stream?url=${encodeURIComponent(res.data)}`

                // Let's use the stream proxy for maximum compatibility
                return `${BASE_URL}/music/stream?url=${encodeURIComponent(res.data)}`
            }
        } catch (e) {
            console.error('Failed to get audio src', e)
        }
        return ''
    }
}
