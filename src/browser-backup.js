// Portable, game-only archive. A small, checked JSON header precedes the PNG
// blobs so artwork is never base64-expanded or put into localStorage.
const MAGIC = new TextEncoder().encode("DINOSAVE1\n"), PREFIX = MAGIC.length + 4 + 32;
const MAX_HEADER = 24 * 1024 * 1024, MAX_IMAGE = 12 * 1024 * 1024;
const digest = async blob => new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
const hex = bytes => Array.from(bytes,b=>b.toString(16).padStart(2,"0")).join("");
const check = (ok,message="This file contains invalid game data.") => { if (!ok) throw new Error(message); };
const obj = x => x !== null && typeof x === "object" && !Array.isArray(x);
const reserved = new Set(["__proto__", "prototype", "constructor"]);
function safeTree(x, depth=0) {
  check(depth<80);
  if (!x || typeof x!=="object") return;
  for (const [key,value] of Object.entries(x)) {
    check(!reserved.has(key));
    safeTree(value,depth+1);
  }
}
function validateState(s) {
  check(obj(s) && s.version===1 && obj(s.profile) && typeof s.profile.name==="string" && obj(s.settings) && Array.isArray(s.records) && Array.isArray(s.passages), "Unsupported or incomplete game save.");
  safeTree(s);
  for (const k of ["playerProfiles","profileLibraries","customRacersByProfile","nemesesByProfile","campaignProgress","activeCampaignIdByProfile"]) check(s[k]===undefined || obj(s[k]));
  function passages(items) { check(Array.isArray(items) && items.every(x=> obj(x) && typeof x.id==="string" && typeof x.title==="string" && typeof x.text==="string")); }
  function snapshot(p) {
    check(obj(p) && obj(p.profile) && typeof p.profile.name==="string");
    check(p.records===undefined || (Array.isArray(p.records) && p.records.every(r=>obj(r) &&
      (r.mistakes==null || (Array.isArray(r.mistakes) && r.mistakes.every(m=>obj(m)&&Number.isFinite(m.time)))) &&
      (r.seriesStandings==null || (Array.isArray(r.seriesStandings)&&r.seriesStandings.every(obj))))));
    if(p.activeChampionship) check(obj(p.activeChampionship) && Array.isArray(p.activeChampionship.passageIds) && Array.isArray(p.activeChampionship.rounds));
    if(p.bestReplay) check(obj(p.bestReplay) && Array.isArray(p.bestReplay.samples));
  }
  passages(s.passages); snapshot(s);
  for(const p of Object.values(s.playerProfiles||{})) snapshot(p);
  for(const l of Object.values(s.profileLibraries||{})) passages(l.passages);
  check(s.campaigns===undefined || (Array.isArray(s.campaigns) && s.campaigns.every(c=>obj(c)&&Array.isArray(c.levels)&&c.levels.length>0&&c.levels.every(l=>obj(l)&&Array.isArray(l.races)&&l.races.every(obj)))));
}
function racers(s) {
  const refs=[];
  for (const [owner,raw] of Object.entries(s.customRacersByProfile||{})) {
    check(/^[a-z0-9-]+$/.test(owner));
    const list=Array.isArray(raw)?raw:[{...raw,id:"legacy"}];
    for (const racer of list) {
      check(obj(racer) && typeof racer.name==="string" && typeof racer.id==="string");
      const key=racer.assetKey || (racer.id==="legacy"?owner:owner+":"+racer.id);
      check(typeof key==="string" && key.length>0 && key.length<512);
      refs.push({owner,racer,key});
    }
  }
  return refs;
}
async function checkPng(blob) {
  check(blob instanceof Blob && blob.size>=33 && blob.size<=MAX_IMAGE,"Invalid or missing custom racer artwork.");
  const a=new Uint8Array(await blob.slice(0,24).arrayBuffer()), v=new DataView(a.buffer);
  check(hex(a.slice(0,8))==="89504e470d0a1a0a" && v.getUint32(12)===0x49484452 && [16,20].every(i=>v.getUint32(i)>0&&v.getUint32(i)<=2048),"Invalid custom racer PNG.");
}
export async function makeBackup(state, readAsset) {
  validateState(state);
  const parts=[],assets=[];
  for(const key of new Set(racers(state).map(x=>x.key))) {
    const blob=await readAsset(key); await checkPng(blob);
    parts.push(blob);assets.push({key,size:blob.size,hash:hex(await digest(blob))});
  }
  const header=new Blob([JSON.stringify({format:"dino-type-racer",version:1,createdAt:new Date().toISOString(),state,assets})]);
  check(header.size<=MAX_HEADER,"This save is too large for this backup format.");
  const size=new DataView(new ArrayBuffer(4));size.setUint32(0,header.size);
  return new Blob([MAGIC,size.buffer,await digest(header),header,...parts],{type:"application/octet-stream"});
}
export async function readBackup(file) {
  const p=new Uint8Array(await file.slice(0,PREFIX).arrayBuffer());
  check(p.length===PREFIX && MAGIC.every((v,i)=>p[i]===v),"Choose a Dino Type Racer .dinobackup file.");
  const n=new DataView(p.buffer).getUint32(MAGIC.length),head=file.slice(PREFIX,PREFIX+n);
  check(n>0 && n<=MAX_HEADER && n===head.size && hex(await digest(head))===hex(p.slice(MAGIC.length+4)),"The backup is incomplete or damaged.");
  const pack=JSON.parse(await head.text());
  check(pack.format==="dino-type-racer" && pack.version===1,"Unsupported backup version.");
  validateState(pack.state);check(Array.isArray(pack.assets));
  const expected=new Set(racers(pack.state).map(x=>x.key)), assets=new Map();
  let cursor=PREFIX+n;
  for(const a of pack.assets) {
    check(obj(a) && expected.delete(a.key) && Number.isSafeInteger(a.size) && a.size>0 && a.size<=MAX_IMAGE,"Invalid artwork list.");
    const blob=file.slice(cursor,cursor+a.size,"image/png");cursor+=a.size;
    check(blob.size===a.size && hex(await digest(blob))===a.hash,"The racer artwork is incomplete or damaged.");
    await checkPng(blob);assets.set(a.key,blob);
  }
  check(expected.size===0 && cursor===file.size,"The backup is incomplete or contains extra data.");
  return {state:pack.state,assets,createdAt:pack.createdAt};
}
export async function restoreBackup(pack,{writeAsset,removeAsset,commit,oldState}) {
  // Stage under new keys. Neither an image write failure nor a localStorage
  // quota error can break the previous game's artwork or its active profile.
  const next=structuredClone(pack.state),newKeys=new Map(),written=[];
  const previous=new Set(racers(oldState).map(x=>x.key));
  try {
    for(const [key,blob] of pack.assets) {
      const id="restore:"+crypto.randomUUID();await writeAsset(id,blob);
      written.push(id);newKeys.set(key,id);
    }
    const map={};
    for(const {owner,racer,key} of racers(next)) {
      (map[owner] ||= []).push({...racer,assetKey:newKeys.get(key)});
    }
    next.customRacersByProfile=map;
    await commit(next);
  } catch(error) {
    await Promise.allSettled(written.map(removeAsset));throw error;
  }
  await Promise.allSettled([...previous].map(removeAsset));
  return next;
}
