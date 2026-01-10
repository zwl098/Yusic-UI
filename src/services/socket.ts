import { io, type Socket } from 'socket.io-client'

class SocketService {
    private socket: Socket | null = null
    private static instance: SocketService

    private constructor() { }

    public static getInstance(): SocketService {
        if (!SocketService.instance) {
            SocketService.instance = new SocketService()
        }
        return SocketService.instance
    }

    public getSocket(): Socket {
        if (!this.socket) {
            const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'
            this.socket = io(socketUrl, {
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                reconnectionDelayMax: 5000,
                timeout: 20000,
            })

            this.socket.on('connect', () => {
                console.log('Socket connected:', this.socket?.id)
            })

            this.socket.on('disconnect', (reason) => {
                console.log('Socket disconnected:', reason)
            })
        }
        return this.socket
    }

    public disconnect() {
        if (this.socket) {
            this.socket.disconnect()
            this.socket = null
        }
    }
}

export const socketService = SocketService.getInstance()
