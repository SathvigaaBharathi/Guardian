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
        const data = message.toString();
        // Broadcast to all other connected clients
        for (const client of clients) {
          if (client !== ws && client.readyState === 1) { // 1 = OPEN
            client.send(data);
          }
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
