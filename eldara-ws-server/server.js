const http = require('http');
const WebSocket = require('ws');

const server = http.createServer(function(req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Eldara Arena WS Server OK - rooms: ' + rooms.size);
});

const wss = new WebSocket.Server({ server });
const rooms = new Map(); // roomCode -> { host, guest, state }

function makeRoomState() {
  return {
    phase: 'pregame', // pregame | fighting | gameOver
    hp: {},           // playerId -> hp
    maxHp: {},        // playerId -> maxHp
    dead: {},         // playerId -> bool
    roundOver: false
  };
}

wss.on('connection', function(ws) {
  ws.isAlive = true;
  ws.roomCode = null;
  ws.role = null;
  ws.playerId = null;

  ws.on('pong', function() { ws.isAlive = true; });

  ws.on('message', function(raw) {
    try {
      var msg = JSON.parse(raw);
      switch (msg.type) {

        case 'join': {
          var code = msg.roomCode;
          if (!code) break;
          if (!rooms.has(code)) rooms.set(code, { state: makeRoomState() });
          var room = rooms.get(code);
          if (room[msg.role] && room[msg.role] !== ws) {
            try { room[msg.role].close(); } catch(e) {}
          }
          room[msg.role] = ws;
          ws.roomCode = code;
          ws.role = msg.role;
          ws.playerId = msg.playerId;
          console.log('JOIN ' + code + ' as ' + msg.role + ' (rooms: ' + rooms.size + ')');
          if (room.host && room.guest) {
            send(room.host, { type: 'ready' });
            send(room.guest, { type: 'ready' });
            console.log('READY ' + code);
          }
          break;
        }

        case 'state':
          // Track HP from state pushes
          if (msg.data && msg.data.hp != null && ws.playerId) {
            var room2 = rooms.get(ws.roomCode);
            if (room2) {
              room2.state.hp[ws.playerId] = msg.data.hp;
              if (msg.data.dead) {
                room2.state.dead[ws.playerId] = true;
                checkRoundOver(room2, ws.roomCode);
              }
            }
          }
          relay(ws, msg);
          break;

        case 'action':
          // Watch for hp_sync to authoritatively track HP
          if (msg.data && msg.data.type === 'hp_sync' && msg.data.from) {
            var room3 = rooms.get(ws.roomCode);
            if (room3 && msg.data.data) {
              // hp_sync reports the SENDER's own HP (they took a hit)
              room3.state.hp[msg.data.from] = msg.data.data.hp;
              if (msg.data.data.dead) {
                room3.state.dead[msg.data.from] = true;
                checkRoundOver(room3, ws.roomCode);
              }
            }
          }
          relay(ws, msg);
          break;

        case 'match_start':
          // Reset round state when match starts
          var room4 = rooms.get(ws.roomCode);
          if (room4) {
            room4.state = makeRoomState();
            room4.state.phase = 'fighting';
            // Store max HP from match_start if provided
            if (msg.data && msg.data.players) {
              msg.data.players.forEach(function(p) {
                room4.state.maxHp[p.id] = p.maxHp;
                room4.state.hp[p.id] = p.maxHp;
              });
            }
          }
          relay(ws, msg);
          break;

        case 'round_reset':
          // Reset for next round
          var room5 = rooms.get(ws.roomCode);
          if (room5) {
            room5.state.hp = {};
            room5.state.dead = {};
            room5.state.roundOver = false;
            room5.state.phase = 'fighting';
          }
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

// Authoritative round-over check
function checkRoundOver(room, code) {
  if (room.state.roundOver) return;
  var deadIds = Object.keys(room.state.dead).filter(function(id) { return room.state.dead[id]; });
  if (deadIds.length === 0) return;
  room.state.roundOver = true;
  room.state.phase = 'gameOver';
  console.log('ROUND_OVER ' + code + ' dead: ' + deadIds.join(','));
  // Broadcast authoritative round_over to both players
  var msg = { type: 'round_over', deadIds: deadIds };
  send(room.host, msg);
  send(room.guest, msg);
}

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

// Heartbeat
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
