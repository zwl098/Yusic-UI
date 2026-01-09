import axios, { type AxiosRequestConfig } from 'axios'

export interface ApiResponse<T = any> {
    code: number
    msg: string
    data: T
    url?: string
}

const BASE_URL = import.meta.env.DEV ? '/api' : 'https://music-dl.sayqz.com/api'

const instance = axios.create({
    baseURL: BASE_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    }
})

// Add response interceptor for global error handling or data unwrapping if needed
instance.interceptors.response.use(
    (response) => {
        return response.data
    },
    (error) => {
        console.error('API Request Error:', error)
        return Promise.reject(error)
    }
)

export const request = async <T = any>(
    endpoint: string,
    options: AxiosRequestConfig = {}
): Promise<T> => {
    try {
        const response = await instance.request<any, T>({
            url: endpoint,
            ...options
        })
        return response
    } catch (error) {
        throw error
    }
}
