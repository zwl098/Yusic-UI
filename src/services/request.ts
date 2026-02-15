import axios, { type AxiosRequestConfig } from 'axios'

export interface ApiResponse<T = any> {
    code: number
    msg: string
    data: T
    url?: string
    [key: string]: any
}

export const BASE_URL = import.meta.env.DEV ? '/api' : 'http://159.75.236.77'

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
        if (error.code === 'ECONNABORTED') {
            console.error('[API] Request timeout')
        } else if (error.response) {
            console.error(`[API] Error ${error.response.status}:`, error.response.data)
        } else {
            console.error('[API] Network Error:', error.message)
        }
        return Promise.reject(error)
    }
)

export const request = async <T = any>(
    endpoint: string,
    options: AxiosRequestConfig = {}
): Promise<ApiResponse<T>> => {
    try {
        const response = await instance.request<any, ApiResponse<T>>({
            url: endpoint,
            ...options
        })
        return response
    } catch (error) {
        throw error
    }
}
