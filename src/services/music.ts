import { request } from './request'
import type { Song, SearchResult, Platform } from '@/types/music'

export const musicApi = {
    /**
     * 搜索音乐
     * @param keyword 关键词
     * @param platform 平台 (netease, qq, kuwo)
     * @param page 页码 (默认1)
     * @param limit 每页数量 (默认20)
     */
    search: (keyword: string, platform: Platform = 'netease', page = 1, limit = 20) => {
        return request<SearchResult>('/music/search', {
            method: 'GET',
            params: {
                keyword,
                platform,
                page,
                limit
            }
        })
    },

    /**
     * 获取音乐播放链接
     * @param id 歌曲ID
     * @param platform 平台
     * @param quality 音质 (默认320k)
     */
    getUrl: (id: string, platform: Platform, quality = '320k') => {
        return request<string>('/music/url', {
            method: 'GET',
            params: {
                id,
                platform,
                quality
            }
        })
    },

    /**
     * 获取音频流代理地址 (用于解决跨域/防盗链)
     * @param url 原始音频链接
     */
    getStreamUrl: (url: string) => {
        // 直接返回完整的代理 URL，不需要 request 请求
        const baseUrl = import.meta.env.DEV ? '/api' : import.meta.env.VITE_API_URL
        return `${baseUrl}/music/stream?url=${encodeURIComponent(url)}`
    }
}
