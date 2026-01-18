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

        const res = await request<any>(`?type=search&keyword=${encodeURIComponent(keyword)}&source=${source}&limit=${limit}&page=${page}`)

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
        return request<any>(`?type=url&id=${id}&source=${source}`)
    },

    /**
     * Get song details including cover
     * @param id Song ID
     * @param source Music source
     */
    getMusicInfo: (id: string, source: MusicSource) => {
        return request<any>(`?type=info&id=${id}&source=${source}`)
    },

    /**
     * Get song lyrics
     * @param id Song ID
     * @param source Music source
     */
    getLyric: (id: string, source: MusicSource) => {
        return request<any>(`?type=lrc&id=${id}&source=${source}`)
    },

    /**
     * Get Album Pick
     * @param id Song ID
     * @param source Music source
     */
    getPic: (id: string, source: MusicSource) => {
        return request<any>(`?type=pic&id=${id}&source=${source}`)
    },

    /**
     * Get direct audio source URL (no request)
     */
    getAudioSrc: (id: string, source: MusicSource) => {
        return `${BASE_URL}?type=url&id=${id}&source=${source}`
    }
}
