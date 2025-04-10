// const { createServer } = require("http");
// const { Server } = require("socket.io");
// const { createClient } = require("redis");
// const { createAdapter } = require("@socket.io/redis-adapter");

// const server = createServer();
// const io = new Server(server, {
//   cors: {
//     origin: (origin, callback) => {
//       const allowedOrigins = ["https://nexgen-staging.vercel.app"];
//       console.log("Request Origin:", origin);
//       if (!origin || allowedOrigins.includes(origin)) {
//         callback(null, true);
//       } else {
//         callback(new Error("CORS not allowed for origin: " + origin));
//       }
//     },
//     methods: ["GET", "POST"],
//     credentials: true,
//   },
// });

// const redisPublisher = createClient({ url: process.env.REDIS_URL });
// const redisSubscriber = createClient({ url: process.env.REDIS_URL });

// redisPublisher.on("error", (err) => console.error("Redis publisher error:", err));
// redisSubscriber.on("error", (err) => console.error("Redis subscriber error:", err));

// redisPublisher.on("end", () => console.log("Redis publisher connection ended"));
// redisSubscriber.on("end", () => console.log("Redis subscriber connection ended"));

// Promise.all([redisPublisher.connect(), redisSubscriber.connect()])
//   .then(() => {
//     io.adapter(createAdapter(redisPublisher, redisSubscriber));

//     io.on("connection", (socket) => {
//       console.log("A user connected:", socket.id, "Origin:", socket.handshake.headers.origin);

//       socket.on("join", (userId) => {
//         socket.join(userId);
//         console.log(`User ${userId} joined room`);

//         redisSubscriber.subscribe(`notifications:${userId}`, (message) => {
//           try {
//             const notification = JSON.parse(message);
//             console.log("Publishing notification to", userId, ":", notification);
//             socket.emit("newNotification", notification);
//           } catch (err) {
//             console.error("Error parsing notification:", err);
//           }
//         }).catch(err => console.error("Subscription error for", userId, ":", err));
//       });

//       socket.on("disconnect", (reason) => {
//         console.log("User disconnected:", socket.id, "Reason:", reason);
//       });
//     });

//     const port = process.env.PORT;
//     server.listen(port, () => {
//       console.log(`WebSocket server running on port ${port}`);
//     });

//     setInterval(() => {
//       console.log("Server is alive at", new Date());
//     }, 30000); // Keep-alive log
//   })
//   .catch((err) => {
//     console.error("Failed to start server due to Redis error:", err);
//     process.exit(1);
//   });

// // Reconnect Redis on disconnection
// redisSubscriber.on("end", () => {
//   console.log("Attempting to reconnect Redis subscriber...");
//   redisSubscriber.connect().catch(err => console.error("Reconnect failed:", err));
// });

// redisPublisher.on("end", () => {
//   console.log("Attempting to reconnect Redis publisher...");
//   redisPublisher.connect().catch(err => console.error("Reconnect failed:", err));
// });
const { createServer } = require("http");
const { Server } = require("socket.io");
const { createClient } = require("redis");
const { createAdapter } = require("@socket.io/redis-adapter");

const server = createServer();
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      const allowedOrigins =  "*";
      console.log("Request Origin:", origin);
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed for origin: " + origin));
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Explicit TLS configuration for Upstash
const redisPublisher = createClient({
  url: "rediss://default:2ec2165b6cc84674b2b75f8c8b551716@gusc1-keen-gecko-31253.upstash.io:31253",
  tls: { rejectUnauthorized: false } // Added here
});
const redisSubscriber = createClient({
  url: "rediss://default:2ec2165b6cc84674b2b75f8c8b551716@gusc1-keen-gecko-31253.upstash.io:31253",
  tls: { rejectUnauthorized: false } // Added here not for production
});

redisPublisher.on("error", (err) => console.error("Redis publisher error:", err));
redisSubscriber.on("error", (err) => console.error("Redis subscriber error:", err));

redisPublisher.on("end", () => console.log("Redis publisher connection ended"));
redisSubscriber.on("end", () => console.log("Redis subscriber connection ended"));

Promise.all([redisPublisher.connect(), redisSubscriber.connect()])
  .then(() => {
    console.log("Redis connections established successfully");
    io.adapter(createAdapter(redisPublisher, redisSubscriber));

    io.on("connection", (socket) => {
        console.log("A user connected:", socket.id, "Origin:", socket.handshake.headers.origin, "Headers:", socket.handshake.headers);
      
        socket.on("join", (userId) => {
          socket.join(userId);
          console.log(`User ${userId} joined room`);
      
          redisSubscriber.subscribe(`notifications:${userId}`, (message) => {
            try {
              const notification = JSON.parse(message);
              console.log("Publishing notification to", userId, ":", notification);
              socket.emit("newNotification", notification);
            } catch (err) {
              console.error("Error parsing notification:", err);
            }
          }).catch(err => console.error("Subscription error for", userId, ":", err));
        });
      
        socket.on("disconnect", (reason) => {
          console.log("User disconnected:", socket.id, "Reason:", reason);
        });
      });
    server.on("upgrade", (req, socket, head) => {
        console.log("WebSocket upgrade requested for", req.url);
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

// Reconnect Redis on disconnection
redisSubscriber.on("end", () => {
  console.log("Attempting to reconnect Redis subscriber...");
  redisSubscriber.connect().catch(err => console.error("Reconnect failed:", err));
});

redisPublisher.on("end", () => {
  console.log("Attempting to reconnect Redis publisher...");
  redisPublisher.connect().catch(err => console.error("Reconnect failed:", err));
});
