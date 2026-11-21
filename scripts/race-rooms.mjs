import { randomBytes, randomInt } from 'node:crypto';
import { normalizeText } from '../src/passages.js';

const fail=(status,message)=>{ throw Object.assign(new Error(message),{status}); };
const token=()=>randomBytes(24).toString('hex');
const label=(s,max)=>typeof s==='string' && s.trim().length>0 && s.trim().length<=max;
const pngHeader=Buffer.from([137,80,78,71,13,10,26,10]);
// Ephemeral classroom rooms: no account, disk, billing or leaderboard writes.
export class RaceRooms {
  constructor(now=Date.now){ this.now=now; this.rooms=new Map(); }
  expire(){ for(const [code,r] of this.rooms) if(this.now()-r.created>=2*60*60*1000)this.rooms.delete(code); }
  open(body){
    this.expire(); if(this.rooms.size>=16)fail(429,'The local server has too many rooms. End an old room first.');
    const title=body.title, text=normalizeText(body.text);
    if(!label(title,180)||!text||text.length>5000||!Array.isArray(body.racers)||!body.racers.length||body.racers.length>32)fail(400,'Choose a passage and between 1 and 32 racers.');
    const racers=body.racers.map((r,i)=>{
      if(!r||!label(r.name,80)||typeof r.png!=='string'||r.png.length>175000||!/^[A-Za-z0-9+/]+=*$/.test(r.png))fail(400,'Invalid racer portrait.');
      const bytes=Buffer.from(r.png,'base64');
      if(bytes.length<33||!bytes.subarray(0,8).equals(pngHeader)||bytes.readUInt32BE(12)!==0x49484452||[16,20].some(n=>bytes.readUInt32BE(n)<1||bytes.readUInt32BE(n)>256))fail(400,'Expected a small PNG portrait.');
      return {id:String(i+1),name:r.name.trim(),bytes};
    });
    let code;do {code=String(randomInt(1000,10000))} while(this.rooms.has(code));
    const r={code,title:title.trim(),text,racers,host:token(),players:new Map(),created:this.now(),startAt:null,finishers:[],seq:0,rev:0};
    this.rooms.set(code,r);return {code,credential:r.host,role:'host'};
  }
  get(code){this.expire();return this.rooms.get(code)||fail(404,'Room not found. Check the code; the room may have ended.');}
  join(r,name){
    if(r.startAt!==null)fail(409,'This race has already started.');
    if(!label(name,24))fail(400,'Enter a nickname (1–24 characters).');
    if(r.players.size>=r.racers.length)fail(409,'This room is full.');
    if([...r.players.values()].some(p=>p.name.toLowerCase()===name.trim().toLowerCase()))fail(409,'That nickname is taken. Try another.');
    const credential=token(),id=String(++r.seq);
    r.players.set(credential,{id,name:name.trim(),racer:null,index:0,errors:0,finishAt:null}); r.rev++;
    return {code:r.code,credential,role:'student',id};
  }
  member(r,key){if(key===r.host)return null;return r.players.get(key)||fail(403,'This room session is no longer active.');}
  view(r,key){
    this.member(r,key); const now=this.now();
    return {code:r.code,title:r.title,text:r.text,now,rev:r.rev,startAt:r.startAt,
      phase:r.startAt===null?'lobby':now<r.startAt?'countdown':r.finishers.length===r.players.size?'finished':'racing',
      racers:r.racers.map(({id,name})=>({id,name})),
      players:[...r.players.values()].map(p=>({...p,place:p.finishAt===null?null:r.finishers.indexOf(p.id)+1}))};
  }
  act(r,key,action,b){
    const p=this.member(r,key);
    if(action==='end'){if(p)fail(403,'Only the teacher can end the room.');this.rooms.delete(r.code);return {ended:true};}
    if(action==='start'){
      if(p)fail(403,'Only the teacher can start.');
      if(r.startAt!==null||!r.players.size||[...r.players.values()].some(x=>!x.racer))fail(409,'Every joined student needs to pick a dino before Start.');
      r.startAt=this.now()+3000;
    }else if(action==='remove'||action==='leave'){
      if(action==='remove'&&(p||r.startAt!==null))fail(403,'Only the teacher can remove a student in the lobby.');
      if(action==='leave'&&!p)fail(400,'Use End room to close the teacher session.');
      const id=action==='leave'?p.id:b.id;
      for(const [k,v] of r.players)if(v.id===id && (r.startAt===null||v.finishAt===null))r.players.delete(k);
      if(action==='leave'){r.rev++;return {ended:true};}
    }else if(action==='pick'){
      if(!p||r.startAt!==null||!r.racers.some(x=>x.id===b.racer))fail(400,'Pick a racer in the lobby.');
      if([...r.players.values()].some(x=>x!==p&&x.racer===b.racer))fail(409,'That dino was just picked. Choose another.');
      p.racer=b.racer;
    }else if(action==='progress'){
      if(!p||r.startAt===null||this.now()<r.startAt)fail(409,'Wait for Go.');
      if(!Number.isSafeInteger(b.index)||b.index<0||b.index>r.text.length||!Number.isSafeInteger(b.errors)||b.errors<0||b.errors>1000000)fail(400,'Invalid race progress.');
      if(p.finishAt===null){
        p.index=Math.max(p.index,b.index);p.errors=Math.max(p.errors,b.errors);
        if(p.index===r.text.length){p.finishAt=this.now();r.finishers.push(p.id);}
      }
    }else fail(404,'Unknown room action.');
    r.rev++;return this.view(r,key);
  }
}
const reply=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
async function json(req,max){
  if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))fail(415,'Expected JSON.');
  const chunks=[];let total=0;for await(const part of req){total+=part.length;if(total>max)fail(413,'Room data is too large.');chunks.push(part);}
  try{const value=JSON.parse(Buffer.concat(chunks).toString());if(value&&!Array.isArray(value)&&typeof value==='object')return value;}catch{}
  fail(400,'Invalid room data.');
}
export function classroomApi(rooms){
  return async(req,res,path)=>{
    try{
      if(req.headers.origin && req.headers.origin!=='http://'+req.headers.host)fail(403,'Use this game’s own classroom page.');
      if(req.method==='GET'&&path==='/api/classroom'){reply(res,200,{version:1,access:'free-preview'});return;}
      if(req.method==='POST'&&path==='/api/classroom'){reply(res,201,rooms.open(await json(req,6*1024*1024)));return;}
      const m=/^\/api\/classroom\/(\d{4})(?:\/(join|start|pick|progress|leave|end|remove|art)(?:\/(\d{1,2}))?)?$/.exec(path);
      if(!m)fail(404,'Unknown room.');
      const r=rooms.get(m[1]),key=req.headers.authorization?.replace(/^Bearer /,''),action=m[2];
      if(req.method==='POST'&&action==='join'){reply(res,201,rooms.join(r,(await json(req,512)).name));return;}
      rooms.member(r,key);
      if(req.method==='GET'&&action==='art'){
        const art=r.racers.find(x=>x.id===m[3]);if(!art)fail(404,'No such racer.');
        res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(art.bytes);return;
      }
      if(req.method==='GET'&&!action){reply(res,200,rooms.view(r,key));return;}
      if(req.method==='POST'&&action){reply(res,200,rooms.act(r,key,action,await json(req,1024)));return;}
      fail(405,'Unsupported request.');
    }catch(error){if(!res.destroyed)reply(res,error.status||500,{error:error.status?error.message:'The local room service could not complete this request.'});}
  };
}
