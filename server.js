import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

// Serve static files from the built dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Upgrade HTTP connections to WebSocket on /ws-sync
server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/ws-sync') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

const clients = new Set();

wss.on('connection', (ws) => {
  clients.add(ws);

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message.toString());
      if (parsed.type === 'JOIN_ROOM') {
        ws.pairingCode = parsed.payload.pairingCode;
        console.log(`Client joined room: ${ws.pairingCode}`);
        return;
      }

      if (parsed.type === 'PING') {
        ws.send(JSON.stringify({ type: 'PONG' }));
        return;
      }

      // Broadcast the message to all other connected clients in the SAME room
      if (ws.pairingCode) {
        for (const client of clients) {
          if (client !== ws && client.pairingCode === ws.pairingCode && client.readyState === 1) {
            client.send(message.toString());
          }
        }
      }
    } catch (e) {
      console.error('Error handling WebSocket message:', e);
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

// Fallback to index.html for Single Page Application routing (e.g. /caregiver)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`Guardian production server running on port ${PORT}`);
});
