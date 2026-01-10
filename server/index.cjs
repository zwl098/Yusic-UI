const { Server } = require("socket.io");

const io = new Server({
    cors: {
        origin: "*",
    },
});

const rooms = new Map();
const roomTimeouts = new Map();

const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PLAYLIST_FILE = path.join(__dirname, 'playlists.json');

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

io.listen(PORT);
console.log(`Socket.io server running on port ${PORT}`);
