export type Platform = 'netease' | 'qq' | 'kuwo'

export interface Song {
    id: string
    name: string
    artist: string[]
    album: string
    duration?: number
    cover?: string
    platform: Platform
    url?: string
}

export interface SearchResult {
    list: Song[]
    total: number
    page: number
    limit: number
}
