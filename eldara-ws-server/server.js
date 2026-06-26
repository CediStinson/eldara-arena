const http = require('http');
const WebSocket = require('ws');

// ===========================================
// GAME CONSTANTS (mirrored from client)
// ===========================================
var TILE=48, AW=16, AH=12;
var COLL_OFFSET_Y=-30, COLL_R=18;

var CLS={
  warrior:{name:'Warrior',hp:105,spd:2.7,atkDmg:22,atkRange:54,atkMs:320,atkType:'melee',
    s1:{name:'Shield Bash',cd:5000,range:58,dmg:16,stun:600,shieldHp:10,shieldDur:3000},
    s2:{name:'War Cry',cd:10000,warcry:true},
    move:{name:'War Charge',cd:6000,charge:true,chargeDur:800,dmgReduce:0.4}},
  mage:{name:'Mage',hp:80,spd:2.2,atkDmg:10,atkRange:220,atkMs:500,atkType:'proj',atkSpeed:300,
    s1:{name:'Fireball',cd:2800,dmg:25,proj:true,speed:340,range:230,charged:true,chargeMax:1500,chargeDmgMax:55},
    s2:{name:'Frost Shield',cd:10000,arcaneShield:true,arcaneShieldDur:8000,arcaneShieldHits:3},
    move:{name:'Blink',cd:4000,blink:140}},
  ranger:{name:'Rogue',hp:105,spd:3.0,atkDmg:10,atkRange:58,atkMs:240,atkType:'melee',
    s1:{name:'Headbutt',cd:5500,dmg:12,range:56,stun:700},
    s2:{name:'Stealth',cd:10000,stealth:true,stealthDur:7000,spdMult:0.65},
    move:{name:'Shadow Step',cd:5000,shadowStep:true,stepRange:280,stepDmg:12}}
};

var ARENAS={
  volcano:{name:'Volcanic Rift',sp1:{x:1,y:5},sp2:{x:14,y:3},tiles:[
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,2,0,0,0,0,1,1,0,0,0,0,0,1],
    [1,0,0,0,1,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,2,2,2,1,1,0,0,0,0,0,1,1,0,1],
    [1,0,2,2,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,0,0,0,0,1,2,0,0,1,0,0,0,1],
    [1,0,1,0,0,1,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,0,0,2,2,2,0,0,0,0,1],
    [1,0,0,1,0,0,0,1,2,2,2,2,0,0,0,1],
    [1,0,0,0,0,0,1,1,2,2,2,2,2,2,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]]},
  desert:{name:'Desert Colosseum',sp1:{x:1,y:5},sp2:{x:14,y:5},tiles:[
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1],
    [1,1,0,0,7,0,0,0,0,0,0,7,0,0,1,1],
    [1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1],
    [1,0,7,0,0,0,0,0,0,0,0,0,0,7,0,1],
    [1,0,0,0,1,0,0,0,0,0,0,1,0,0,0,1],
    [1,0,0,0,1,0,0,0,0,0,0,1,0,0,0,1],
    [1,0,7,0,0,0,0,0,0,0,0,0,0,7,0,1],
    [1,0,0,0,0,0,1,0,0,1,0,0,0,0,0,1],
    [1,1,0,0,7,0,0,0,0,0,0,7,0,0,1,1],
    [1,1,1,0,0,0,0,0,0,0,0,0,0,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]]},
  temple:{name:'Shadow Temple',sp1:{x:1,y:0},sp2:{x:14,y:9},tiles:[
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,0,0,0,1,0,0,0,1],
    [1,0,1,0,1,0,1,1,1,1,0,1,0,1,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,1,1,1,0,0,0,0,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,4,4,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,4,4,0,0,0,0,0,0,1],
    [1,0,1,1,1,1,0,0,0,0,1,1,1,1,0,1],
    [1,0,1,0,0,0,0,0,0,0,0,0,0,1,0,1],
    [1,0,1,0,1,0,1,1,1,1,0,1,0,1,0,1],
    [1,0,0,0,1,0,0,0,0,0,0,1,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]]}
};
var ARENA_KEYS=['volcano','desert','temple'];

// ===========================================
// GAME LOGIC
// ===========================================
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
function isWall(a,wx,wy){var tx=Math.floor(wx/TILE),ty=Math.floor(wy/TILE);if(tx<0||ty<0||tx>=AW||ty>=AH)return true;var tt=a.tiles[ty][tx];return tt===1||tt===7;}
function isTrap(a,wx,wy,tick){var tx=Math.floor(wx/TILE),ty=Math.floor(wy/TILE);if(tx<0||ty<0||tx>=AW||ty>=AH)return false;return a.tiles[ty][tx]===5&&Math.floor(tick/40)%3===0;}
function collBlocked(a,cx,cy){var r=COLL_R;return isWall(a,cx-r,cy)||isWall(a,cx+r,cy)||isWall(a,cx,cy-r)||isWall(a,cx,cy+r)||isWall(a,cx-r*0.7,cy-r*0.7)||isWall(a,cx+r*0.7,cy-r*0.7)||isWall(a,cx-r*0.7,cy+r*0.7)||isWall(a,cx+r*0.7,cy+r*0.7);}
function resolveX(a,p){var cx=p.x,cy=p.y-COLL_OFFSET_Y;if(!collBlocked(a,cx,cy))return;p.vx=0;var tx=Math.floor(cx/TILE)*TILE+TILE/2;var pd=cx>=tx?1:-1;for(var i=1;i<=TILE;i++){if(!collBlocked(a,cx+pd*i,cy)){p.x=cx+pd*i;return;}if(!collBlocked(a,cx-pd*i,cy)){p.x=cx-pd*i;return;}}}
function resolveY(a,p){var cx=p.x,cy=p.y-COLL_OFFSET_Y;if(!collBlocked(a,cx,cy))return;p.vy=0;var ty=Math.floor(cy/TILE)*TILE+TILE/2;var pd=cy>=ty?1:-1;for(var i=1;i<=TILE;i++){if(!collBlocked(a,cx,cy+pd*i)){p.y=(cy+pd*i)+COLL_OFFSET_Y;return;}if(!collBlocked(a,cx,cy-pd*i)){p.y=(cy-pd*i)+COLL_OFFSET_Y;return;}}}

function mkPlayer(id,cls,name,spawn,isHost,level,redEyes,skullHelmet){
  var C=CLS[cls];
  return {id:id,name:name,cls:cls,isHost:isHost,level:level||1,redEyes:!!redEyes,skullHelmet:!!skullHelmet,
    x:spawn.x*TILE+TILE/2,y:spawn.y*TILE+TILE/2,
    vx:0,vy:0,hp:C.hp,maxHp:C.hp,
    dir:isHost?3:2,anim:0,moving:false,
    atkTimer:0,attacking:0,s1cd:0,s2cd:0,
    stunned:0,stealthed:false,stealthTimer:0,stealthFirstHit:false,
    rollInv:false,rolling:0,rollTimer:0,rollDir:{x:1,y:0},
    shieldHp:0,shieldTimer:0,arcaneShield:0,arcaneShieldHits:0,
    frostSlow:0,frost:0,frostTimer:0,frosted:false,frostedTimer:0,
    burning:false,burnTimer:0,burnTick:0,
    warCryBuff:0,warCryShake:0,warCharging:false,chargeTimer:0,chargeVx:0,chargeVy:0,dmgReduce:0,
    fireballCharging:false,fireballCharge:0,
    galing:false,galeTimer:0,
    moveCd:0,disarmed:0,hitFlash:0,dead:false,wins:0,projId:0};
}

function mkGS(arenaKey,host,guest){
  var ak=arenaKey||ARENA_KEYS[Math.floor(Math.random()*ARENA_KEYS.length)];
  var arena=ARENAS[ak];
  // Host always sp1, guest always sp2 — no random flip, client syncs to server state
  var sp1=arena.sp1;
  var sp2=arena.sp2;
  return {
    arena:arena,arenaKey:ak,
    players:[mkPlayer(host.playerId,host.cls,host.name,sp1,true,host.level,host.redEyes,host.skullHelmet),
              mkPlayer(guest.playerId,guest.cls,guest.name,sp2,false,guest.level,guest.redEyes,guest.skullHelmet)],
    projs:[],effects:[],traps:[],dopps:[],
    tick:0,phase:'pregame',countdown:5000,roundTimer:99,roundMs:0,round:1
  };
}

function spawnEfx(gs,type,x,y){var life=type==='shadow_step'?650:400;gs.effects.push({type:type,x:x,y:y,life:life,max:life,anim:0});}

function dealDmg(gs,target,dmg,type){
  if(target.dead||target.stealthed)return;
  if(target.arcaneShield>0&&target.arcaneShieldHits>0){
    target.arcaneShieldHits--;
    if(target.arcaneShieldHits<=0){target.arcaneShield=0;target.arcaneShieldHits=0;}
    spawnEfx(gs,'arcane_block',target.x,target.y);
    var isMelee=(type==='slash'||type==='bash');
    if(isMelee){var atk=gs.players.find(function(p){return p!==target;});if(atk)atk.frostSlow=(atk.frostSlow||0)+1500;}
    dmg=Math.max(1,Math.floor(dmg*(isMelee?0.25:0.5)));
  }
  var finalDmg=Math.round(dmg*(target.warCharging&&target.dmgReduce?(1-target.dmgReduce):1));
  if(target.shieldHp>0){var abs=Math.min(target.shieldHp,finalDmg);target.shieldHp-=abs;finalDmg=Math.max(0,finalDmg-abs);}
  target.hp=Math.max(0,target.hp-finalDmg);
  target.hitFlash=220;
  spawnEfx(gs,type,target.x,target.y);
  if(target.hp<=0){target.dead=true;target.hp=0;}
}

function applyFrost(gs,target){
  if(!target||target.dead||target.frosted)return;
  target.frost=(target.frost||0)+1;
  target.frostTimer=5000;
  if(target.frost>=4){
    target.frosted=true;target.frostedTimer=1500;target.stunned=1000;
    target.frost=0;target.frostTimer=0;
    if(target.cls==='mage'){target.fireballCharging=false;target.fireballCharge=0;}
    spawnEfx(gs,'frost_burst',target.x,target.y);
  }
}

function doAttack(gs,attacker,target){
  var C=CLS[attacker.cls];
  var hadSneakFirstHit=attacker.stealthed&&attacker.stealthFirstHit;
  if(attacker.stealthed){attacker.stealthed=false;attacker.stealthTimer=0;attacker.rollInv=false;attacker.stealthFirstHit=false;}
  attacker.attacking=14;attacker.atkTimer=C.atkMs;
  if(C.atkType==='proj'){
    var angle=target.stealthed?(attacker.dir===2?Math.PI:attacker.dir===3?0:attacker.dir===1?-Math.PI/2:Math.PI/2):Math.atan2(target.y-attacker.y,target.x-attacker.x);
    var projType=attacker.cls==='mage'?'ice':'arrow';
    gs.projs.push({id:attacker.id+'_atk_'+(attacker.projId++),owner:attacker.id,type:projType,
      x:attacker.x,y:attacker.y+10,vx:Math.cos(angle)*(C.atkSpeed||320),vy:Math.sin(angle)*(C.atkSpeed||320),
      dmg:C.atkDmg,dot:0,dotDur:0,range:C.atkRange,traveled:0,alive:true,anim:0,applyFrostOnHit:projType==='ice'});
  } else {
    if(dist(attacker,target)<C.atkRange+10&&!target.rollInv){
      var wBonus=attacker.warCryBuff>0?1.2:1;
      var sneak=hadSneakFirstHit?2.0:1;
      dealDmg(gs,target,Math.round((C.atkDmg+Math.floor(Math.random()*4)-1)*wBonus*sneak),'slash');
    }
    spawnEfx(gs,'slash',attacker.x,attacker.y);
  }
}

function doSkill(gs,user,target,num){
  var C=CLS[user.cls],sk=num===1?C.s1:C.s2;
  var cd=num===1?user.s1cd:user.s2cd;
  if(cd>0)return;
  if(num===1)user.s1cd=sk.cd;else user.s2cd=sk.cd;
  if(user.stealthed&&!sk.stealth){user.stealthed=false;user.stealthTimer=0;user.rollInv=false;}
  if(sk.proj){
    var angle=target.stealthed?(user.dir===2?Math.PI:user.dir===3?0:user.dir===1?-Math.PI/2:Math.PI/2):Math.atan2(target.y-user.y,target.x-user.x);
    gs.projs.push({id:user.id+'_'+(user.projId++),owner:user.id,type:user.cls==='mage'?'fireball':'arrow',
      x:user.x,y:user.y+10,vx:Math.cos(angle)*sk.speed,vy:Math.sin(angle)*sk.speed,
      dmg:sk.dmg,dot:0,dotDur:0,range:sk.range,traveled:0,alive:true,anim:0});
    spawnEfx(gs,'cast',user.x,user.y);
  } else if(sk.stun||sk.disarm){
    if(dist(user,target)<(sk.range||55)+10&&!target.rollInv){
      if(sk.dmg)dealDmg(gs,target,sk.dmg,'bash');
      spawnEfx(gs,'bash',target.x,target.y);
      target.stunned=sk.stun||600;
      spawnEfx(gs,'stun',target.x,target.y);
      if(sk.shieldHp&&user.shieldHp<=0){user.shieldHp=sk.shieldHp;user.shieldTimer=sk.shieldDur||3000;spawnEfx(gs,'shield_up',user.x,user.y);}
    }
  } else if(sk.stealth){
    user.stealthed=true;user.stealthTimer=sk.stealthDur;user.stealthFirstHit=true;user.rollInv=true;
    spawnEfx(gs,'blink',user.x,user.y);
  } else if(sk.arcaneShield){
    if(user.cls==='mage'){user.fireballCharging=false;user.fireballCharge=0;}
    user.arcaneShield=sk.arcaneShieldDur;user.arcaneShieldHits=sk.arcaneShieldHits||3;
    spawnEfx(gs,'arcane_block',user.x,user.y);
  } else if(sk.warcry){
    user.stunned=0;user.frosted=false;user.frostedTimer=0;user.disarmed=0;
    user.s1cd=Math.max(0,(user.s1cd||0)-2000);user.s2cd=Math.max(0,(user.s2cd||0)-2000);user.moveCd=Math.max(0,(user.moveCd||0)-2000);
    user.warCryBuff=3000;user.warCryShake=600;
    spawnEfx(gs,'warcry',user.x,user.y);
  }
}

function doMoveAbility(gs,user,target){
  var C=CLS[user.cls],mv=C.move;
  if(!mv||user.moveCd>0)return;
  user.moveCd=mv.cd;
  if(mv.charge){
    user.warCharging=true;user.chargeTimer=mv.chargeDur;user.dmgReduce=mv.dmgReduce;
    var dx=target.x-user.x,dy=target.y-user.y,d=Math.hypot(dx,dy)||1;
    user.chargeVx=(dx/d)*C.spd*3.5;user.chargeVy=(dy/d)*C.spd*3.5;
    spawnEfx(gs,'charge_start',user.x,user.y);
  } else if(mv.blink){
    var mag=Math.hypot(user.vx,user.vy);
    var bdx,bdy;
    if(mag>0.1){bdx=user.vx/mag;bdy=user.vy/mag;}
    else{var dirMap=[[0,1],[0,-1],[-1,0],[1,0]];var dm=dirMap[user.dir]||[1,0];bdx=dm[0];bdy=dm[1];}
    user.x=Math.max(TILE+COLL_R,Math.min((AW-1)*TILE-COLL_R,user.x+bdx*mv.blink));
    user.y=Math.max(TILE+COLL_OFFSET_Y+COLL_R,Math.min((AH-1)*TILE-COLL_R,user.y+bdy*mv.blink));
    user.rollInv=true;setTimeout(function(){user.rollInv=false;},200);
    spawnEfx(gs,'blink',user.x,user.y);
  } else if(mv.shadowStep){
    var stepDist=dist(user,target);
    if(stepDist<=mv.stepRange){
      var wasStealthed=user.stealthed;
      var ang=Math.atan2(user.y-target.y,user.x-target.x);
      user.x=Math.max(TILE+COLL_R,Math.min((AW-1)*TILE-COLL_R,target.x+Math.cos(ang)*45));
      user.y=Math.max(TILE+COLL_OFFSET_Y+COLL_R,Math.min((AH-1)*TILE-COLL_R,target.y+Math.sin(ang)*45));
      spawnEfx(gs,'shadow_step',user.x,user.y);
      if(user.stealthed){user.stealthed=false;user.stealthTimer=0;user.rollInv=false;user.stealthFirstHit=false;}
      if(wasStealthed&&!target.rollInv){target.stunned=1400;dealDmg(gs,target,CLS[user.cls].s1.dmg,'bash');spawnEfx(gs,'stun',target.x,target.y);}
    }
  }
}

function updatePlayer(gs,p,inputs,dt){
  if(p.stunned>0||p.dead)return;
  if(!inputs){
    // Log once per player when inputs are missing
    if(!p._inputWarnLogged){p._inputWarnLogged=true;console.log('NO INPUTS for player '+p.id+' ('+p.name+')');}
    return;
  }
  p._inputWarnLogged=false;
  var C=CLS[p.cls];
  var spd=C.spd*(p.rolling>0?1.75:1)*(p.galing?(1+(C.move.galeSpd||0)):1)*(p.stealthed&&C.s2&&C.s2.stealth?C.s2.spdMult:1)*(p.frostSlow>0?0.25:1)*(p.fireballCharging&&p.cls==='mage'?0.25:1);
  p.vx=0;p.vy=0;var moved=false;
  if(inputs){
    if(inputs.up){p.vy=-spd;p.dir=1;moved=true;}
    if(inputs.down){p.vy=spd;p.dir=0;moved=true;}
    if(inputs.left){p.vx=-spd;p.dir=2;moved=true;}
    if(inputs.right){p.vx=spd;p.dir=3;moved=true;}
  }
  // Diagonal normalisation
  if(p.vx!==0&&p.vy!==0){var n=Math.SQRT1_2;p.vx*=n;p.vy*=n;}
  p.moving=moved;
  if(p.rolling>0){p.vx=p.rollDir.x*spd;p.vy=p.rollDir.y*spd;}
  var step=dt/16;
  p.x+=p.vx*step;resolveX(gs.arena,p);
  p.y+=p.vy*step;resolveY(gs.arena,p);
  if(moved||p.rolling>0)p.anim+=step;else p.anim=0;
}

function update(gs,inputs,dt){
  if(!gs||gs.phase==='gameOver')return;
  gs.tick++;
  var p0=gs.players[0],p1=gs.players[1];
  if(!p0||!p1)return;
  // Dopps
  if(gs.dopps){gs.dopps=gs.dopps.filter(function(d){return d.life>0;});gs.dopps.forEach(function(d){d.life-=dt;d.anim+=dt*0.01;d.x+=d.vx;d.y+=d.vy;if(d.x<TILE*2||d.x>(AW-2)*TILE)d.vx*=-1;if(d.y<TILE*2||d.y>(AH-2)*TILE)d.vy*=-1;});}
  if(gs.phase==='pregame'){
    gs.countdown-=dt;
    if(gs.countdown<=0){gs.phase='fighting';}
    // No movement during pregame countdown
    return;
  }
  if(gs.phase==='countdown'){gs.countdown-=dt;if(gs.countdown<=0)resetRound(gs);return;}
  gs.roundMs+=dt;
  if(gs.roundMs>=1000){gs.roundMs-=1000;gs.roundTimer=Math.max(0,gs.roundTimer-1);}
  if(gs.roundTimer<=0){
    var w=p0.hp>=p1.hp?p0:p1;
    w.wins++;endRound(gs);return;
  }
  // Update each player with their inputs
  updatePlayer(gs,p0,inputs[p0.id],dt);
  updatePlayer(gs,p1,inputs[p1.id],dt);
  // Tick both players
  [p0,p1].forEach(function(p){
    if(p.dead)return;
    if(p.atkTimer>0)p.atkTimer-=dt;if(p.attacking>0)p.attacking-=2;
    if(p.fireballCharging&&p.cls==='mage')p.fireballCharge=Math.min((p.fireballCharge||0)+dt,1500);
    if(p.frost>0){p.frostTimer-=dt;if(p.frostTimer<=0){p.frost=0;p.frostTimer=0;}}
    if(p.stealthTimer>0){p.stealthTimer-=dt;if(p.stealthTimer<=0){p.stealthed=false;p.stealthTimer=0;p.rollInv=false;p.stealthFirstHit=false;}}
    if(p.shieldTimer>0){p.shieldTimer-=dt;if(p.shieldTimer<=0){p.shieldHp=0;p.shieldTimer=0;}}
    if(p.arcaneShield>0){p.arcaneShield-=dt;if(p.arcaneShield<=0){p.arcaneShield=0;p.arcaneShieldHits=0;}}
    if(p.frostSlow>0)p.frostSlow-=dt;
    if(p.warCryBuff>0)p.warCryBuff-=dt;if(p.warCryShake>0)p.warCryShake-=dt;
    if(p.disarmed>0)p.disarmed-=dt;
    if(p.frosted>0){p.frostedTimer-=dt;if(p.frostedTimer<=0){p.frosted=false;p.frostedTimer=0;p.stunned=0;}}
    if(p.moveCd>0)p.moveCd-=dt;
    if(p.warCharging){p.chargeTimer-=dt;if(p.chargeTimer<=0){p.warCharging=false;p.dmgReduce=0;p.chargeVx=0;p.chargeVy=0;}else{p.x+=p.chargeVx*(dt/16);p.y+=p.chargeVy*(dt/16);resolveX(gs.arena,p);resolveY(gs.arena,p);}}
    if(p.galing){p.galeTimer-=dt;if(p.galeTimer<=0)p.galing=false;}
    if(p.rollTimer>0)p.rollTimer-=dt;if(p.rolling>0){p.rolling-=dt;if(p.rolling<=0)p.rolling=0;}
    if(p.stunned>0)p.stunned-=dt;else p.stunned=0;
    if(p.s1cd>0)p.s1cd-=dt;if(p.s2cd>0)p.s2cd-=dt;if(p.hitFlash>0)p.hitFlash-=dt;
    // Lava
    var tileUnderX=Math.floor(p.x/TILE),tileUnderY=Math.floor((p.y-COLL_OFFSET_Y)/TILE);
    var tileUnder=(tileUnderY>=0&&tileUnderX>=0&&tileUnderY<gs.arena.tiles.length&&tileUnderX<gs.arena.tiles[0].length)?gs.arena.tiles[tileUnderY][tileUnderX]:0;
    if(tileUnder===2){p.burning=true;p.burnTimer=Math.max(p.burnTimer,1500);}
    if(p.burning&&p.burnTimer>0){p.burnTimer-=dt;p.burnTick=(p.burnTick||0)-dt;if(p.burnTick<=0){dealDmg(gs,p,5,'lava');spawnEfx(gs,'lava',p.x,p.y);p.burnTick=500;}if(p.burnTimer<=0){p.burning=false;p.burnTimer=0;p.burnTick=0;}}
    if(isTrap(gs.arena,p.x,p.y-COLL_OFFSET_Y,gs.tick))dealDmg(gs,p,9,'spike');
    p.x=Math.max(TILE+COLL_R,Math.min((AW-1)*TILE-COLL_R,p.x));
    p.y=Math.max(TILE+COLL_OFFSET_Y+COLL_R,Math.min((AH-1)*TILE-COLL_R,p.y));
  });
  // Projectiles
  for(var i=gs.projs.length-1;i>=0;i--){
    var pr=gs.projs[i];pr.anim++;var s2=dt/1000;
    pr.x+=pr.vx*s2;pr.y+=pr.vy*s2;pr.traveled+=Math.hypot(pr.vx,pr.vy)*s2;
    if(pr.traveled>pr.range||isWall(gs.arena,pr.x,pr.y)){pr.alive=false;spawnEfx(gs,'splat',pr.x,pr.y);}
    var tgt=pr.owner===p0.id?p1:p0;
    if(pr.alive&&dist(pr,tgt)<26&&!tgt.rollInv){
      var projDmg=pr.dmg;
      if(tgt.arcaneShield>0&&tgt.arcaneShieldHits>0){tgt.arcaneShieldHits--;if(tgt.arcaneShieldHits<=0){tgt.arcaneShield=0;tgt.arcaneShieldHits=0;}spawnEfx(gs,'arcane_block',tgt.x,tgt.y);projDmg=Math.max(1,Math.floor(projDmg*0.5));}
      dealDmg(gs,tgt,projDmg,'proj');
      if(pr.applyFrostOnHit)applyFrost(gs,tgt);
      pr.alive=false;spawnEfx(gs,'impact',pr.x,pr.y);
    }
    if(!pr.alive)gs.projs.splice(i,1);
  }
  // Effects
  for(var j=gs.effects.length-1;j>=0;j--){gs.effects[j].life-=dt;gs.effects[j].anim++;if(gs.effects[j].life<=0)gs.effects.splice(j,1);}
  // Traps
  for(var ti=gs.traps.length-1;ti>=0;ti--){
    var trap=gs.traps[ti];trap.life-=dt;
    if(trap.life<=0){gs.traps.splice(ti,1);continue;}
    if(trap.triggered){trap.triggerTimer-=dt;if(trap.triggerTimer<=0)gs.traps.splice(ti,1);continue;}
    var trapAtk=gs.players.find(function(p){return p.id===trap.owner;});
    var trapTgt=gs.players.find(function(p){return p.id!==trap.owner;});
    if(trapTgt&&!trapTgt.dead&&dist(trapTgt,trap)<22){
      trap.triggered=true;trap.triggerTimer=600;
      trapTgt.stunned=1000;
      spawnEfx(gs,'trap_trigger',trap.x,trap.y);
    }
  }
  // Check deaths after all damage
  if(p0.dead||p1.dead)endRound(gs);
}

function endRound(gs){
  if(gs.phase==='gameOver')return;
  gs.phase='gameOver';
}

function resetRound(gs,arenaKey){
  var ak=arenaKey||gs.arenaKey;
  var arena=ARENAS[ak]||gs.arena;
  gs.arena=arena;gs.arenaKey=ak;
  gs.phase='pregame';gs.countdown=5000;gs.roundTimer=99;gs.roundMs=0;
  gs.projs=[];gs.effects=[];gs.traps=[];gs.dopps=[];gs.tick=0;
  var spawnFlip=Math.random()<0.5;
  var sp1=spawnFlip?arena.sp2:arena.sp1;
  var sp2=spawnFlip?arena.sp1:arena.sp2;
  gs.players.forEach(function(p,idx){
    var spawn=idx===0?sp1:sp2;
    var C=CLS[p.cls];
    p.x=spawn.x*TILE+TILE/2;p.y=spawn.y*TILE+TILE/2;
    p.vx=0;p.vy=0;p.hp=C.hp;p.maxHp=C.hp;p.dead=false;
    p.dir=idx===0?3:2;p.anim=0;p.moving=false;
    p.atkTimer=0;p.attacking=0;p.s1cd=0;p.s2cd=0;p.stunned=0;
    p.stealthed=false;p.stealthTimer=0;p.stealthFirstHit=false;p.rollInv=false;p.rolling=0;p.rollTimer=0;
    p.shieldHp=0;p.shieldTimer=0;p.arcaneShield=0;p.arcaneShieldHits=0;
    p.frostSlow=0;p.frost=0;p.frostTimer=0;p.frosted=false;p.frostedTimer=0;
    p.burning=false;p.burnTimer=0;p.burnTick=0;
    p.warCryBuff=0;p.warCryShake=0;p.warCharging=false;p.chargeTimer=0;p.dmgReduce=0;
    p.fireballCharging=false;p.fireballCharge=0;
    p.galing=false;p.galeTimer=0;p.moveCd=0;p.disarmed=0;p.hitFlash=0;p.projId=0;
  });
}

// ===========================================
// SERVER
// ===========================================
const server=http.createServer(function(req,res){
  res.writeHead(200,{'Content-Type':'text/plain'});
  res.end('Eldara Arena WS Server OK - rooms: '+rooms.size);
});

const wss=new WebSocket.Server({server});
const rooms=new Map();

function makeRoom(){
  return {host:null,guest:null,gs:null,inputs:{},loop:null,hostInfo:null,guestInfo:null};
}

wss.on('connection',function(ws){
  ws.isAlive=true;
  ws.roomCode=null;ws.role=null;ws.playerId=null;
  ws.on('pong',function(){ws.isAlive=true;});

  ws.on('message',function(raw){
    try{
      var msg=JSON.parse(raw);
      switch(msg.type){

        case 'join':{
          var code=msg.roomCode;if(!code)break;
          if(!rooms.has(code))rooms.set(code,makeRoom());
          var room=rooms.get(code);
          if(room[msg.role]&&room[msg.role]!==ws){try{room[msg.role].close();}catch(e){}}
          room[msg.role]=ws;
          ws.roomCode=code;ws.role=msg.role;ws.playerId=msg.playerId;
          room[msg.role+'Info']={playerId:msg.playerId,name:msg.playerName||msg.role,cls:msg.cls||'warrior',level:msg.level||1,redEyes:!!msg.redEyes,skullHelmet:!!msg.skullHelmet};
          console.log('JOIN '+code+' as '+msg.role+' cls='+msg.cls);
          if(room.host&&room.guest){
            send(room.host,{type:'ready'});
            send(room.guest,{type:'ready'});
            // If game already running (reconnect), resend current state
            if(room.gs){
              broadcastState(room,code,true);
              console.log('RECONNECT '+code+' game already running');
            } else {
              console.log('READY '+code);
            }
          }
          break;
        }

        case 'input':{
          var room2=rooms.get(ws.roomCode);
          if(room2&&ws.playerId){
            room2.inputs[ws.playerId]=msg.data;
          } else {
            console.log('INPUT IGNORED: roomCode='+ws.roomCode+' playerId='+ws.playerId+' hasRoom='+(!!room2));
          }
          break;
        }

        case 'action':{
          // Combat actions: attack, skill1, skill2, move, rematch_start etc
          var room3=rooms.get(ws.roomCode);
          if(!room3||!room3.gs)break;
          var gs3=room3.gs;
          var actor=gs3.players.find(function(p){return p.id===ws.playerId;});
          var other=gs3.players.find(function(p){return p.id!==ws.playerId;});
          if(!actor||!other)break;
          var atype=msg.data&&msg.data.type;
          if(atype==='attack'&&gs3.phase==='fighting'&&!actor.dead&&actor.atkTimer<=0&&!actor.disarmed&&!(actor.stunned>0)){
            doAttack(gs3,actor,other);
          } else if(atype==='skill1'&&gs3.phase==='fighting'&&!actor.dead){
            doSkill(gs3,actor,other,1);
          } else if(atype==='skill2'&&gs3.phase==='fighting'&&!actor.dead){
            doSkill(gs3,actor,other,2);
          } else if(atype==='move'&&gs3.phase==='fighting'&&!actor.dead){
            doMoveAbility(gs3,actor,other);
          } else if(atype==='rematch_ready'){
            // Update class choice
            if(actor&&msg.data.cls)actor.cls=msg.data.cls;
            room3['rematch_'+(ws.role==='host'?'host':'guest')+'_ready']=true;
            room3['rematch_'+(ws.role==='host'?'host':'guest')+'_cls']=msg.data.cls;
            relay(ws,msg); // also notify opponent
            if(room3.rematch_host_ready&&room3.rematch_guest_ready){
              // Both ready - start rematch
              var ak=ARENA_KEYS[Math.floor(Math.random()*ARENA_KEYS.length)];
              if(room3.hostInfo)room3.hostInfo.cls=room3.rematch_host_cls||room3.hostInfo.cls;
              if(room3.guestInfo)room3.guestInfo.cls=room3.rematch_guest_cls||room3.guestInfo.cls;
              room3.rematch_host_ready=false;room3.rematch_guest_ready=false;
              resetRound(gs3,ak);
              gs3.players[0].cls=room3.hostInfo.cls;
              gs3.players[1].cls=room3.guestInfo.cls;
              broadcastState(room3,code,true);
            }
          } else if(atype==='trap_place'&&gs3.phase==='fighting'){
            var myTraps=gs3.traps.filter(function(t){return t.owner===actor.id;});
            if(myTraps.length>=3){var old=myTraps[0];gs3.traps.splice(gs3.traps.indexOf(old),1);}
            gs3.traps.push({id:actor.id+'_t'+Date.now(),owner:actor.id,x:actor.x,y:actor.y,life:30000,trapDur:1000,triggered:false,triggerTimer:0});
          } else if(atype==='fireball_charge'){
            if(actor)actor.fireballCharging=!!msg.data.charging;
          } else if(atype==='chat'||atype==='dopp'||atype==='opponent_left'){
            relay(ws,msg);
          }
          break;
        }

        case 'match_start':{
          var room4=rooms.get(ws.roomCode);
          if(!room4||ws.role!=='host')break;
          // Only create game once — ignore if already running
          if(room4.gs){
            console.log('match_start ignored — game already running for '+ws.roomCode);
            broadcastState(room4,ws.roomCode,true);
            break;
          }
          var ak4=msg.arenaKey||ARENA_KEYS[Math.floor(Math.random()*ARENA_KEYS.length)];
          if(msg.hostCls&&room4.hostInfo)room4.hostInfo.cls=msg.hostCls;
          if(msg.guestCls&&room4.guestInfo)room4.guestInfo.cls=msg.guestCls;
          if(!room4.hostInfo||!room4.guestInfo){console.log('match_start: missing player info');break;}
          room4.gs=mkGS(ak4,room4.hostInfo,room4.guestInfo);
          room4.inputs={};
          room4.inputs[room4.hostInfo.playerId]={up:false,down:false,left:false,right:false};
          room4.inputs[room4.guestInfo.playerId]={up:false,down:false,left:false,right:false};
          startGameLoop(room4,ws.roomCode);
          broadcastState(room4,ws.roomCode,true);
          console.log('MATCH_START '+ws.roomCode+' arena='+ak4);
          break;
        }

        case 'ping':
          send(ws,{type:'pong',ts:msg.ts});
          break;

        case 'leave':
          relay(ws,{type:'opponent_left'});
          stopGameLoop(rooms.get(ws.roomCode));
          cleanup(ws);
          break;
      }
    }catch(e){console.error('msg error:',e.message,e.stack);}
  });

  ws.on('close',function(){
    // Notify opponent but keep game loop running — they might reconnect
    relay(ws,{type:'opponent_left'});
    var room=rooms.get(ws.roomCode);
    if(room){
      delete room[ws.role]; // remove disconnected player's WS
      // Only stop loop and clean up if BOTH players gone
      if(!room.host&&!room.guest){
        stopGameLoop(room);
        rooms.delete(ws.roomCode);
        console.log('ROOM '+ws.roomCode+' closed — both players gone');
      } else {
        console.log('PLAYER LEFT '+ws.roomCode+' role='+ws.role+' (game loop kept alive)');
      }
    }
  });

  ws.on('error',function(e){console.error('ws error:',e.message);});
});

var TICK_RATE=60; // 60hz server tick
var TICK_MS=1000/TICK_RATE;

function startGameLoop(room,code){
  if(room.loop)clearInterval(room.loop);
  var last=Date.now();
  room.loop=setInterval(function(){
    if(!room.gs){stopGameLoop(room);return;}
    try{
      var now=Date.now();
      var dt=Math.min(now-last,100);
      last=now;
      var wasGameOver=room.gs.phase==='gameOver';
      update(room.gs,room.inputs,dt);
      broadcastState(room,code,false);
      if(!wasGameOver&&room.gs.phase==='gameOver'){
        var dead=room.gs.players.find(function(p){return p.dead;});
        var alive=room.gs.players.find(function(p){return !p.dead;});
        send(room.host,{type:'round_over',deadId:dead?dead.id:null,winnerId:alive?alive.id:null});
        send(room.guest,{type:'round_over',deadId:dead?dead.id:null,winnerId:alive?alive.id:null});
        console.log('ROUND_OVER '+code+' winner='+(alive?alive.name:'?'));
      }
    }catch(e){
      console.error('GAME LOOP ERROR in '+code+':',e.message,e.stack);
    }
  },TICK_MS);
}

function stopGameLoop(room){
  if(room&&room.loop){clearInterval(room.loop);room.loop=null;}
}

// Send full game state to both clients
function broadcastState(room,code,force){
  if(!room.gs)return;
  var gs=room.gs;
  // Send state snapshot to each client — their own player marked isMe
  var snap=serializeGS(gs);
  var snapHost=JSON.parse(JSON.stringify(snap));
  var snapGuest=JSON.parse(JSON.stringify(snap));
  // Mark isMe for each client
  if(room.hostInfo){snapHost.players.forEach(function(p){p.isMe=(p.id===room.hostInfo.playerId);});}
  if(room.guestInfo){snapGuest.players.forEach(function(p){p.isMe=(p.id===room.guestInfo.playerId);});}
  send(room.host,{type:'gamestate',data:snapHost});
  send(room.guest,{type:'gamestate',data:snapGuest});
}

function serializeGS(gs){
  return {
    phase:gs.phase,tick:gs.tick,countdown:gs.countdown,roundTimer:gs.roundTimer,arenaKey:gs.arenaKey,
    players:gs.players.map(function(p){
      return {id:p.id,name:p.name,cls:p.cls,isHost:p.isHost,level:p.level||1,redEyes:!!p.redEyes,skullHelmet:!!p.skullHelmet,
        x:Math.round(p.x),y:Math.round(p.y),dir:p.dir,anim:Math.round(p.anim*10)/10,moving:p.moving,
        hp:Math.round(p.hp),maxHp:p.maxHp,dead:p.dead,wins:p.wins,
        attacking:p.attacking,atkTimer:Math.round(p.atkTimer),
        s1cd:Math.round(p.s1cd),s2cd:Math.round(p.s2cd),moveCd:Math.round(p.moveCd),
        stunned:Math.round(p.stunned),hitFlash:p.hitFlash>0?p.hitFlash:0,
        stealthed:p.stealthed,stealthTimer:Math.round(p.stealthTimer),
        shieldHp:Math.round(p.shieldHp),arcaneShield:Math.round(p.arcaneShield),arcaneShieldHits:p.arcaneShieldHits,
        frostSlow:Math.round(p.frostSlow),frost:p.frost,frosted:p.frosted,frostedTimer:Math.round(p.frostedTimer||0),
        warCryBuff:Math.round(p.warCryBuff),warCryShake:Math.round(p.warCryShake),
        warCharging:p.warCharging,dmgReduce:p.dmgReduce||0,
        fireballCharging:p.fireballCharging,fireballCharge:Math.round(p.fireballCharge||0),
        rolling:Math.round(p.rolling),rollInv:p.rollInv,rollDir:p.rollDir,
        burning:p.burning,burnTimer:Math.round(p.burnTimer||0),
        galing:p.galing,disarmed:Math.round(p.disarmed||0),
        vx:p.vx,vy:p.vy,
      };
    }),
    projs:gs.projs.map(function(pr){return {id:pr.id,owner:pr.owner,type:pr.type,x:Math.round(pr.x),y:Math.round(pr.y),vx:Math.round(pr.vx),vy:Math.round(pr.vy),dmg:pr.dmg,range:pr.range,traveled:Math.round(pr.traveled),alive:pr.alive,anim:pr.anim};}).filter(function(p){return p.alive;}),
    effects:gs.effects.map(function(e){return {type:e.type,x:Math.round(e.x),y:Math.round(e.y),life:e.life,max:e.max,anim:e.anim};}),
    traps:gs.traps.map(function(t){return {id:t.id,owner:t.owner,x:Math.round(t.x),y:Math.round(t.y),triggered:t.triggered};}),
    dopps:gs.dopps?gs.dopps.map(function(d){return {cls:d.cls,x:Math.round(d.x),y:Math.round(d.y),dir:d.dir,anim:d.anim,life:d.life,maxLife:d.maxLife};}):[]
  };
}

function send(ws,msg){
  if(ws&&ws.readyState===WebSocket.OPEN){try{ws.send(JSON.stringify(msg));}catch(e){}}
}

function relay(ws,msg){
  var room=rooms.get(ws.roomCode);if(!room)return;
  var target=ws.role==='host'?room.guest:room.host;
  send(target,msg);
}

function cleanup(ws){
  var room=rooms.get(ws.roomCode);if(!room)return;
  delete room[ws.role];
  if(!room.host&&!room.guest){stopGameLoop(room);rooms.delete(ws.roomCode);console.log('ROOM '+ws.roomCode+' closed (rooms: '+rooms.size+')');}
}

// Heartbeat
setInterval(function(){
  wss.clients.forEach(function(ws){
    if(!ws.isAlive){ws.terminate();return;}
    ws.isAlive=false;ws.ping();
  });
},30000);

var PORT=process.env.PORT||3000;
server.listen(PORT,function(){console.log('Eldara authoritative server on port '+PORT+' @ '+TICK_RATE+'hz');});
