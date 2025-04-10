const { createServer } = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = ["https://nexgen-staging.vercel.app"];
      console.log("Request Origin:", origin); // Log incoming origin
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"));
      }
    },
    methods: ["GET", "POST"],
    credentials: true, // Explicitly allow credentials
  },
});

const redisPublisher = createClient({ url: process.env.REDIS_URL });
const redisSubscriber = createClient({ url: process.env.REDIS_URL });

redisPublisher.on("error", (err) => console.error("Redis publisher error:", err));
redisSubscriber.on("error", (err) => console.error("Redis subscriber error:", err));

Promise.all([redisPublisher.connect(), redisSubscriber.connect()]).then(() => {
  io.adapter(createAdapter(redisPublisher, redisSubscriber));

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id, "Origin:", socket.handshake.headers.origin);

    socket.on("join", (userId) => {
      socket.join(userId);
      console.log(`User ${userId} joined room`);

      redisSubscriber.subscribe(`notifications:${userId}`, (message) => {
        const notification = JSON.parse(message);
        console.log("Publishing notification to", userId, ":", notification);
        socket.emit("newNotification", notification);
      });
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  const port = process.env.PORT || 3001;
  server.listen(port, () => {
    console.log(`WebSocket server running on port ${port}`);
  });
}).catch(err => console.error("Redis connection failed:", err));
