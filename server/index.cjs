const { Server } = require("socket.io");

const io = new Server({
    cors: {
        origin: "*",
    },
});

const rooms = new Map();

io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("create-room", () => {
        const roomId = Math.random().toString(36).substring(2, 8);
        rooms.set(roomId, {
            id: roomId,
            users: [socket.id],
            currentSong: null,
            isPlaying: false,
            currentTime: 0,
            host: socket.id
        });
        socket.join(roomId);
        socket.emit("room-created", roomId);
        console.log(`Room created: ${roomId} by ${socket.id}`);
    });

    socket.on("join-room", (roomId) => {
        if (rooms.has(roomId)) {
            const room = rooms.get(roomId);
            room.users.push(socket.id);
            socket.join(roomId);
            // Send current state to new joiner
            socket.emit("joined-room", {
                roomId,
                currentSong: room.currentSong,
                isPlaying: room.isPlaying,
                currentTime: room.currentTime
            });
            console.log(`User ${socket.id} joined room ${roomId}`);
        } else {
            socket.emit("error", "Room not found");
        }
    });

    // Sync events
    socket.on("sync:play", (roomId, song) => {
        const room = rooms.get(roomId);
        if (room) {
            room.currentSong = song;
            room.isPlaying = true;
            socket.to(roomId).emit("sync:play", song);
        }
    });

    socket.on("sync:pause", (roomId) => {
        const room = rooms.get(roomId);
        if (room) {
            room.isPlaying = false;
            socket.to(roomId).emit("sync:pause");
        }
    });

    socket.on("sync:seek", (roomId, time) => {
        const room = rooms.get(roomId);
        if (room) {
            room.currentTime = time;
            socket.to(roomId).emit("sync:seek", time);
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
                    rooms.delete(roomId);
                    console.log(`Room ${roomId} deleted (empty)`);
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
io.listen(PORT);
console.log(`Socket.io server running on port ${PORT}`);
