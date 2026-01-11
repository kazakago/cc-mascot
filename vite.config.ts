import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { ViteDevServer, Plugin } from 'vite'
import { WebSocketServer, WebSocket } from 'ws'

function webSocketPlugin(): Plugin {
  const clients = new Set<WebSocket>();

  function broadcast(message: string) {
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  return {
    name: 'websocket-plugin',
    configureServer(server: ViteDevServer) {
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer?.on('upgrade', (request, socket, head) => {
        if (request.url === '/ws') {
          wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
          });
        }
      });

      wss.on('connection', (ws) => {
        console.log('WebSocket client connected');
        clients.add(ws);

        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            if (message.text) {
              broadcast(JSON.stringify({ type: 'speak', text: message.text }));
            }
          } catch {
            console.error('Invalid message received');
          }
        });

        ws.on('close', () => {
          console.log('WebSocket client disconnected');
          clients.delete(ws);
        });
      });

      // HTTP endpoint for easy testing
      server.middlewares.use('/speak', (req, res, next) => {
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: Buffer) => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body);
              if (data.text) {
                broadcast(JSON.stringify({ type: 'speak', text: data.text }));
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
              } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'text is required' }));
              }
            } catch {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
          });
        } else {
          next();
        }
      });

      console.log('WebSocket server integrated at ws://localhost:8563/ws');
      console.log('HTTP endpoint: POST http://localhost:8563/speak');
    },
  };
}

export default defineConfig({
  plugins: [react(), webSocketPlugin()],
  server: {
    port: 8563,
  },
})
