require("dotenv").config();
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const Document = require("./Document");

const app = express();
const httpServer = http.createServer(app);

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("Connected to MongoDB"))
  .catch((error) => console.log("mongodb connection error:", error));

const DEFAULT_VALUE = { ops: [{ insert: "\n" }] };

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("get-document", async (documentId) => {
    if (!documentId) {
      socket.emit("error", "Missing documentId");
      return;
    }

    const document = await findOrCreateDocument(documentId);
    socket.join(documentId);
    socket.emit("load-document", document.data);

    socket.on("send-changes", (delta) => {
      socket.broadcast.to(documentId).emit("receive-changes", delta);
    });

    socket.on("save-document", async (data) => {
      await Document.findByIdAndUpdate(documentId, { data });
    });
  });

  socket.on("disconnect", () => {
  });
});

async function findOrCreateDocument(id) {
  if (!id) return;
  let doc = await Document.findById(id);
  if (doc) return doc;
  return await Document.create({ _id: id, data: DEFAULT_VALUE });
}

httpServer.listen(PORT, () => console.log(`Listening on port ${PORT}`));
