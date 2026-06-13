import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { WebSocketServer } from 'ws'

// Custom WebSocket sync server plugin
const websocketSyncPlugin = {
  name: 'websocket-sync',
  configureServer(server: any) {
    if (!server.httpServer) return;

    const wss = new WebSocketServer({ noServer: true });

    server.httpServer.on('upgrade', (request: any, socket: any, head: any) => {
      if (request.url === '/ws-sync') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    });

    const clients = new Set<any>();

    wss.on('connection', (ws: any) => {
      clients.add(ws);

      ws.on('message', (message: any) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.type === 'JOIN_ROOM') {
            ws.pairingCode = parsed.payload.pairingCode;
            console.log(`[Dev WS] Client joined room: ${ws.pairingCode}`);
            return;
          }

          if (parsed.type === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG' }));
            return;
          }

          // Broadcast to all other connected clients in the same room
          if (ws.pairingCode) {
            for (const client of clients) {
              if (client !== ws && client.pairingCode === ws.pairingCode && client.readyState === 1) {
                client.send(message.toString());
              }
            }
          }
        } catch (e) {
          console.error('[Dev WS] Error handling message:', e);
        }
      });

      ws.on('close', () => {
        clients.delete(ws);
      });
    });
  }
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl(), websocketSyncPlugin],
  server: {
    host: true,      // exposes on local network IP, not just localhost
    port: 5173,
  },
})
