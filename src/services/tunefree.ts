import { request } from './request'

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
    /**
     * Search for music
     * @param keyword Search keyword
     * @param source Music source (netease, kuwo, qq)
     * @param limit Number of results
     * @param page Page number
     */
    search: (keyword: string, source: MusicSource = 'netease', limit = 20, page = 1) => {
        return request<any>(`?type=search&keyword=${encodeURIComponent(keyword)}&source=${source}&limit=${limit}&page=${page}`)
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
    }
}
