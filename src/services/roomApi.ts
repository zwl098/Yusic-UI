import { request } from './request'

export interface RoomState {
    roomId: string
    songId: string | null
    isPlaying: boolean
    startTime: number | null // Server timestamp (ms) for current playback segment start
    pauseTime: number | null // Progress string (seconds) when paused
    currentTime?: number      // Server calculated current time (seconds)
}

export const roomApi = {
    createRoom: async () => {
        return request<{ roomId: string }>('/rooms', {
            method: 'POST'
        })
    },

    getRoomState: async (roomId: string) => {
        return request<RoomState>(`/rooms/${roomId}/state`, {
            method: 'GET'
        })
    },

    play: async (roomId: string, songId?: string) => {
        return request(`/rooms/${roomId}/play`, {
            method: 'POST',
            data: { songId }
        })
    },

    pause: async (roomId: string) => {
        return request(`/rooms/${roomId}/pause`, {
            method: 'POST',
            data: {}
        })
    },

    changeSong: async (roomId: string, songId: string) => {
        return request(`/rooms/${roomId}/song`, {
            method: 'POST',
            data: { songId }
        })
    }
}
