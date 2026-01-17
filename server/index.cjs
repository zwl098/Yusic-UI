const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

const PORT = process.env.PORT || 3000;
const PLAYLIST_FILE = path.join(__dirname, 'playlists.json');

// API Proxy Configuration
app.use('/api', createProxyMiddleware({
    target: 'https://music-dl.sayqz.com/api',
    changeOrigin: true,
    pathRewrite: {
        '^/api': '', // Remove /api prefix when forwarding
    },
    on: {
        proxyRes: (proxyRes, req, res) => {
            if (proxyRes.headers['location']) {
                // Force HTTPS in redirect Location header
                proxyRes.headers['location'] = proxyRes.headers['location'].replace(/^http:\/\//, 'https://');
            }
        }
    }
}));

const rooms = new Map();
const roomTimeouts = new Map();

// Helper to load playlists
function loadPlaylists() {
    if (!fs.existsSync(PLAYLIST_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(PLAYLIST_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error loading playlists:", err);
        return [];
    }
}

app.use(express.json());

// --- Room HTTP API ---

// 1. Create Room
app.post('/rooms', (req, res) => {
    const roomId = Math.random().toString(36).substring(2, 8);
    rooms.set(roomId, {
        id: roomId,
        users: [],
        currentSong: null,
        isPlaying: false,
        currentTime: 0,
        lastUpdateTime: Date.now(),
        startTime: null, // For accurate sync
        pauseTime: null,
        queue: []
    });
    console.log(`[HTTP] Room created: ${roomId}`);
    res.json({ roomId });
});

// 2. Get Room State
app.get('/rooms/:roomId/state', (req, res) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }

    // Calculate current time
    let currentTime = room.currentTime || 0;
    if (room.isPlaying && room.startTime) {
        currentTime = (Date.now() - room.startTime) / 1000;
    } else if (!room.isPlaying && room.pauseTime !== null) {
        currentTime = room.pauseTime;
    }

    res.json({
        roomId: room.id,
        songId: room.currentSong ? (room.currentSong.source + ':' + room.currentSong.id) : null, // Composite ID
        isPlaying: room.isPlaying,
        startTime: room.startTime,
        pauseTime: room.pauseTime,
        currentTime: currentTime,
        // Extras
        currentSong: room.currentSong,
        queue: room.queue
    });
});

// 3. Play
app.post('/rooms/:roomId/play', (req, res) => {
    const { roomId } = req.params;
    const { songId } = req.body;
    const room = rooms.get(roomId);

    if (!room) return res.status(404).json({ error: 'Room not found' });

    // Handle Song Switch if ID provided
    if (songId) {
        // We expect composite ID usually, but here we just store ID or need to fetch?
        // Wait, if frontend sends `source:id`, we need to handle it.
        // Actually, the room store sends composite ID now.
        // But backend `room.currentSong` expects a full Song object?
        // The current implementation in `room.ts` `applyRoomState` fetches details if needed.
        // Backend doesn't fetch song info. It just broadcasts ID?
        // But `sync_update` event expects `songId`.
        // AND `socket.on('sync:play')` previously received a full Song object.

        // ISSUE: Backend HTTP API only receives `songId`. It cannot construct a full `Song` object to store in `room.currentSong`.
        // This causes a regression if we rely on backend storing the Song object for new joiners.

        // Quick fix: If we only have ID, we store it. 
        // But `room.currentSong` is used in `join-room`.

        // We will broadcast the ID. Frontend must fetch.
        // We should update `room.currentSong` to be compatible or minimal.

        // Let's store what we have.
        // If songId is composite "source:id".

    }

    room.isPlaying = true;
    room.startTime = Date.now() - (room.currentTime || 0) * 1000; // Recalculate start base
    // Actually, if simply resuming:
    // startTime = Date.now() - (current progress in ms)
    // If Play was called with new song, progress is 0.

    if (songId) {
        // It's a switch
        // We don't have the full song object here to update room.currentSong properly for legacy listeners.
        // But for new HTTP/WS flow, we only broadcast `songId`.
        // We update state.
        room.currentSong = { id: songId.split(':')[1], source: songId.split(':')[0] }; // Minimal stub
        room.currentTime = 0;
        room.startTime = Date.now();
        room.pauseTime = null;

        io.to(roomId).emit('sync_update', {
            type: 'PLAY',
            roomId,
            songId,
            startTime: room.startTime
        });

        // Also legacy event for compatibility? 
        // socket.to(roomId).emit("sync:play", ...); // Skip for now, assume strict new protocol
    } else {
        // Resume
        // If we were paused, we have `pauseTime`.
        const progress = room.pauseTime || room.currentTime || 0;
        room.startTime = Date.now() - (progress * 1000);
        room.pauseTime = null;

        io.to(roomId).emit('sync_update', {
            type: 'PLAY',
            roomId,
            startTime: room.startTime
        });
    }

    res.json({ success: true });
});

// 4. Pause
app.post('/rooms/:roomId/pause', (req, res) => {
    const { roomId } = req.params;
    const room = rooms.get(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    room.isPlaying = false;
    if (room.startTime) {
        const elapsed = (Date.now() - room.startTime) / 1000;
        room.pauseTime = elapsed;
        room.currentTime = elapsed;
    } else {
        room.pauseTime = room.currentTime || 0;
    }
    room.startTime = null;

    io.to(roomId).emit('sync_update', {
        type: 'PAUSE',
        roomId,
        pauseTime: room.pauseTime
    });

    res.json({ success: true });
});

// 5. Change Song
app.post('/rooms/:roomId/song', (req, res) => {
    const { roomId } = req.params;
    const { songId } = req.body; // Expect composite
    const room = rooms.get(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });

    if (songId) {
        const [source, id] = songId.split(':');
        room.currentSong = { id, source }; // Stub
    }
    room.isPlaying = false;
    room.currentTime = 0;
    room.pauseTime = 0;
    room.startTime = null;

    io.to(roomId).emit('sync_update', {
        type: 'SONG_CHANGE',
        roomId,
        songId
    });

    res.json({ success: true });
});

// Helper to save playlists
function savePlaylists(playlists) {
    try {
        fs.writeFileSync(PLAYLIST_FILE, JSON.stringify(playlists, null, 2));
    } catch (err) {
        console.error("Error saving playlists:", err);
    }
}

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    // --- Playlist Events ---

    // Get all playlists
    socket.on("playlist:get-all", () => {
        const playlists = loadPlaylists();
        socket.emit("playlist:list", playlists);
    });

    // Create a new playlist
    socket.on("playlist:create", (name) => {
        const playlists = loadPlaylists();
        const newPlaylist = {
            id: Math.random().toString(36).substring(2, 10),
            name: name,
            createdAt: Date.now(),
            songs: []
        };
        playlists.push(newPlaylist);
        savePlaylists(playlists);
        io.emit("playlist:list", playlists); // Broadcast update
    });

    // Add song to playlist
    socket.on("playlist:add", ({ playlistId, song }) => {
        const playlists = loadPlaylists();
        const playlist = playlists.find(p => p.id === playlistId);
        if (playlist) {
            // Avoid duplicates based on ID
            if (!playlist.songs.find(s => s.id === song.id)) {
                playlist.songs.push(song);
                savePlaylists(playlists);
                io.emit("playlist:list", playlists);
                io.emit("playlist:updated", playlist);
            }
        }
    });

    // Remove song from playlist
    socket.on("playlist:remove", ({ playlistId, songId }) => {
        const playlists = loadPlaylists();
        const playlist = playlists.find(p => p.id === playlistId);
        if (playlist) {
            playlist.songs = playlist.songs.filter(s => s.id !== songId);
            savePlaylists(playlists);
            io.emit("playlist:list", playlists);
            io.emit("playlist:updated", playlist);
        }
    });

    // Delete playlist
    socket.on("playlist:delete", (playlistId) => {
        let playlists = loadPlaylists();
        playlists = playlists.filter(p => p.id !== playlistId);
        savePlaylists(playlists);
        io.emit("playlist:list", playlists);
    });

    // --- Room Events ---

    socket.on("create-room", (callback) => {
        const roomId = Math.random().toString(36).substring(2, 8);
        rooms.set(roomId, {
            id: roomId,
            users: [socket.id],
            currentSong: null,
            isPlaying: false,
            currentTime: 0,
            lastUpdateTime: Date.now(),
            queue: [], // Add queue
            host: socket.id
        });
        socket.join(roomId);
        console.log(`Room created: ${roomId} by ${socket.id}`);

        // Acknowledge the creator
        if (typeof callback === 'function') {
            callback({ success: true, roomId });
        }
    });

    socket.on("join-room", (roomId, callback) => {
        if (rooms.has(roomId)) {
            // Cancel deletion since someone is joining
            if (roomTimeouts.has(roomId)) {
                clearTimeout(roomTimeouts.get(roomId));
                roomTimeouts.delete(roomId);
                console.log(`Room ${roomId} deletion cancelled (user joined)`);
            }

            const room = rooms.get(roomId);
            room.users.push(socket.id);
            socket.join(roomId);

            // Notify others
            socket.to(roomId).emit("notification", "A user joined the room");

            // Broadcast user count
            io.to(roomId).emit("room-users", room.users.length);

            // Calculate current playback time for the joining user
            let processedCurrentTime = room.currentTime;
            if (room.isPlaying && room.lastUpdateTime) {
                const elapsed = (Date.now() - room.lastUpdateTime) / 1000;
                processedCurrentTime += elapsed;
            }

            // Return current state to the joiner immediately via callback
            if (typeof callback === 'function') {
                callback({
                    success: true,
                    roomId,
                    currentSong: room.currentSong,
                    isPlaying: room.isPlaying,
                    currentSong: room.currentSong,
                    isPlaying: room.isPlaying,
                    currentTime: processedCurrentTime,
                    queue: room.queue // Send queue on join
                });
            }
        } else {
            console.log(`Join failed: Room ${roomId} not found`);
            if (typeof callback === 'function') {
                callback({ success: false, error: "Room not found" });
            }
        }
    });

    // Sync events
    socket.on("sync:play", (roomId, song, time) => {
        const room = rooms.get(roomId);
        if (room) {
            room.currentSong = song;
            room.isPlaying = true;
            room.currentTime = time || 0;
            room.lastUpdateTime = Date.now();
            socket.to(roomId).emit("sync:play", song);
        }
    });

    socket.on("sync:pause", (roomId, time) => {
        const room = rooms.get(roomId);
        if (room) {
            room.isPlaying = false;
            room.currentTime = time || room.currentTime;
            room.lastUpdateTime = Date.now();
            socket.to(roomId).emit("sync:pause");
        }
    });

    socket.on("sync:seek", (roomId, time) => {
        const room = rooms.get(roomId);
        if (room) {
            room.currentTime = time;
            room.lastUpdateTime = Date.now();
            socket.to(roomId).emit("sync:seek", time);
        }
    });

    socket.on("sync:queue", (roomId, queue) => {
        const room = rooms.get(roomId);
        if (room) {
            room.queue = queue;
            socket.to(roomId).emit("sync:queue", queue);
        }
    });

    socket.on("emote", (roomId, emoji) => {
        const room = rooms.get(roomId);
        if (room) {
            socket.to(roomId).emit("emote", emoji);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
        // Cleanup logic could go here (remove user from rooms, destroy empty rooms)
        for (const [roomId, room] of rooms.entries()) {
            const index = room.users.indexOf(socket.id);
            if (index !== -1) {
                room.users.splice(index, 1);
                if (room.users.length === 0) {
                    console.log(`Room ${roomId} is empty. Scheduling deletion in 30s.`);
                    // Schedule deletion
                    const timeout = setTimeout(() => {
                        if (rooms.has(roomId) && rooms.get(roomId).users.length === 0) {
                            rooms.delete(roomId);
                            roomTimeouts.delete(roomId);
                            console.log(`Room ${roomId} deleted (timeout)`);
                        }
                    }, 30000);
                    roomTimeouts.set(roomId, timeout);
                } else {
                    // Notify others
                    socket.to(roomId).emit("notification", "A user left the room");
                    io.to(roomId).emit("room-users", room.users.length);
                }
            }
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Socket.io attached`);
    console.log(`API Proxy available at /api`);
});
