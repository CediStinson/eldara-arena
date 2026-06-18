const http = require('http');
const WebSocket = require('ws');

// HTTP server (Fly.io requires HTTP for health checks)
const server = http.createServer(function(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Eldara Arena WS Server OK - rooms: ' + rooms.size);
});

const wss = new WebSocket.Server({ server });
const rooms = new Map(); // roomCode -> { host: ws, guest: ws }

wss.on('connection', function(ws) {
  ws.isAlive = true;
  ws.roomCode = null;
  ws.role = null;

  ws.on('pong', function() { ws.isAlive = true; });

  ws.on('message', function(raw) {
    try {
      var msg = JSON.parse(raw);
      switch (msg.type) {

        case 'join':
          // { type:'join', roomCode, playerId, role:'host'|'guest' }
          var code = msg.roomCode;
          if (!code) break;
          if (!rooms.has(code)) rooms.set(code, {});
          var room = rooms.get(code);
          // Allow reconnect: close old connection for same role
          if (room[msg.role] && room[msg.role] !== ws) {
            try { room[msg.role].close(); } catch(e) {}
          }
          room[msg.role] = ws;
          ws.roomCode = code;
          ws.role = msg.role;
          ws.playerId = msg.playerId;
          console.log('JOIN ' + code + ' as ' + msg.role + ' (rooms: ' + rooms.size + ')');
          // Notify both when room is full
          if (room.host && room.guest) {
            send(room.host, { type: 'ready' });
            send(room.guest, { type: 'ready' });
            console.log('READY ' + code);
          }
          break;

        case 'state':
        case 'action':
          relay(ws, msg);
          break;

        case 'ping':
          send(ws, { type: 'pong', ts: msg.ts });
          break;

        case 'leave':
          relay(ws, { type: 'opponent_left' });
          cleanup(ws);
          break;
      }
    } catch(e) {
      console.error('msg error:', e.message);
    }
  });

  ws.on('close', function() {
    relay(ws, { type: 'opponent_left' });
    cleanup(ws);
  });

  ws.on('error', function(e) {
    console.error('ws error:', e.message);
  });
});

function send(ws, msg) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(msg)); } catch(e) {}
  }
}

function relay(ws, msg) {
  var room = rooms.get(ws.roomCode);
  if (!room) return;
  var target = ws.role === 'host' ? room.guest : room.host;
  send(target, msg);
}

function cleanup(ws) {
  var room = rooms.get(ws.roomCode);
  if (!room) return;
  delete room[ws.role];
  if (!room.host && !room.guest) {
    rooms.delete(ws.roomCode);
    console.log('ROOM ' + ws.roomCode + ' closed (rooms: ' + rooms.size + ')');
  }
}

// Heartbeat - terminate dead connections every 30s
setInterval(function() {
  wss.clients.forEach(function(ws) {
    if (!ws.isAlive) { ws.terminate(); return; }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

var PORT = process.env.PORT || 3000;
server.listen(PORT, function() {
  console.log('Eldara WS server on port ' + PORT);
});
