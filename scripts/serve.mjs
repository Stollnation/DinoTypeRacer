import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join } from 'node:path';
import { isIPv4 } from 'node:net';
import { fileURLToPath } from 'node:url';
import { RaceRooms, classroomApi } from './race-rooms.mjs';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const host=process.argv.find(a=>a.startsWith('--classroom='))?.slice(12)||'127.0.0.1';
if(!isIPv4(host)||!(/^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)))throw Error('Choose a loopback or private classroom IPv4 address.');
const port=Number(process.env.PORT||4174);
const api=classroomApi(new RaceRooms());
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
types['.gif']='image/gif';
const server=createServer(async(req,res)=>{
  try{
    const authority=req.headers.host||'';
    if(![host,...(host==='127.0.0.1'?['localhost']:[])].some(h=>authority===h+':'+server.address().port)){res.writeHead(403).end();return;}
    const path=decodeURIComponent(new URL(req.url,'http://'+authority).pathname);
    if(path==='/api/classroom'||path.startsWith('/api/classroom/')){await api(req,res,path);return;}
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
    if(path.includes('\\')||path.split('/').some(s=>s.startsWith('.')||s.includes(':'))||!(/^\/(?:assets|src)\//.test(path)||['/','/index.html','/styles.css','/adventure.css'].includes(path))){res.writeHead(404).end();return;}
    const file=join(root,path==='/'?'index.html':path.slice(1));
    if(!statSync(file).isFile()){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});
    if(req.method==='HEAD')res.end();else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch{if(!res.headersSent)res.writeHead(404);res.end();}
});
server.listen(port,host,()=>console.log('Dino Type Racer: http://'+host+':'+server.address().port));
