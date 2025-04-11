const { createServer } = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for testing
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 10000,
  pingTimeout: 5000,
});

const redisPublisher = createClient({
  url: "rediss://default:2ec2165b6cc84674b2b75f8c8b551716@gusc1-keen-gecko-31253.upstash.io:31253",
  tls: { rejectUnauthorized: false }
});
const redisSubscriber = createClient({
  url: "rediss://default:2ec2165b6cc84674b2b75f8c8b551716@gusc1-keen-gecko-31253.upstash.io:31253",
  tls: { rejectUnauthorized: false }
});

redisPublisher.on("error", (err) => console.error("Redis publisher error:", err));
redisSubscriber.on("error", (err) => console.error("Redis subscriber error:", err));

redisPublisher.on("end", () => console.log("Redis publisher connection ended"));
redisSubscriber.on("end", () => console.log("Attempting to reconnect Redis subscriber..."));

Promise.all([redisPublisher.connect(), redisSubscriber.connect()])
  .then(() => {
    console.log("Redis connections established successfully");
    io.adapter(createAdapter(redisPublisher, redisSubscriber));

    io.on("connection", (socket) => {
      console.log("A user connected:", socket.id, "Origin:", socket.handshake.headers.origin);

      socket.on("join", (userId) => {
        socket.join(userId);
        console.log(`User ${userId} joined room, subscribing to notifications:${userId}`);
        redisSubscriber.subscribe(`notifications:${userId}`, (message) => {
          console.log(`Message received on notifications:${userId}:`, message);
          try {
            const notification = JSON.parse(message);
            console.log("Parsed notification:", notification);
            if (notification && (notification._id || notification.id)) {
              console.log("Publishing notification to", userId, ":", notification);
              socket.emit("newNotification", notification);
            } else {
              console.log("Invalid notification format, skipping:", notification);
            }
          } catch (err) {
            console.error("Error parsing notification:", err, "Raw message:", message);
          }
        }).catch(err => console.error("Subscription error for", userId, ":", err));
      });

      socket.on("disconnect", (reason) => {
        console.log("User disconnected:", socket.id, "Reason:", reason);
      });
    });

    const port = process.env.PORT || 3001;
    server.listen(port, () => {
      console.log(`WebSocket server running on port ${port}`);
    });

    setInterval(() => {
      console.log("Server is alive at", new Date());
    }, 30000);
  })
  .catch((err) => {
    console.error("Failed to start server due to Redis error:", err);
    process.exit(1);
  });

redisSubscriber.on("end", () => {
  console.log("Attempting to reconnect Redis subscriber...");
  redisSubscriber.connect().catch(err => console.error("Reconnect failed:", err));
});

redisPublisher.on("end", () => {
  console.log("Attempting to reconnect Redis publisher...");
  redisPublisher.connect().catch(err => console.error("Reconnect failed:", err));
});

server.on("upgrade", (req, socket, head) => {
  console.log("WebSocket upgrade requested for", req.url);
});
