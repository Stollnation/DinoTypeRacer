import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { playFireworks, clearFireworks } from "../src/victory-fireworks.js";
import { makeBurstField, drawBurstField, showMs } from "../src/victory-bursts.js";

test("every show covers the full stage with independently timed bursts", () => {
  const a = makeBurstField(() => .12), b = makeBurstField(() => .78);
  for (const field of [a, b]) {
    assert.equal(field.length, 15);
    assert.equal(new Set(field.map(s => Math.floor(s.x * 5) + 5 * Math.floor(s.y * 3))).size, 15);
    assert.equal(new Set(field.map(s => s.start)).size, 15);
    assert(field.every(s => s.start + s.duration < showMs));
  }
  assert.notDeepEqual(a.map(s => [s.x,s.y]), b.map(s => [s.x,s.y]));
});

test("a quiet still draws each shell once without scheduling motion", t => {
  let shells = 0, ticks = 0;
  const ctx = {setTransform(){}, clearRect(){}, beginPath(){}, moveTo(){}, lineTo(){}, stroke(){shells++;}, fillRect(){}};
  const canvas = {clientWidth:900,clientHeight:360,getContext:()=>ctx};
  const oldWin=globalThis.window;
  t.after(()=>{if(oldWin)globalThis.window=oldWin;else delete globalThis.window;});
  globalThis.window={devicePixelRatio:2,requestAnimationFrame(){ticks++;}};
  drawBurstField(canvas,makeBurstField(),false)();
  assert.equal(shells,15); assert.equal(ticks,0);
  assert.equal(canvas.width,1800);assert.equal(canvas.height,720);
});

test("win artwork is a transparent animation with a finite run", () => {
  const bytes = readFileSync(new URL("../assets/ui/first-place-fireworks.gif",import.meta.url));
  assert.equal(bytes.toString("ascii",0,6),"GIF89a");
  assert.equal(bytes.readUInt16LE(6),840);
  assert.equal(bytes.readUInt16LE(8),288);
  assert(!bytes.includes(Buffer.from("NETSCAPE2.0"))); // single pass, not a loop
  // A graphics control block carries each frame's four-centisecond delay.
  const gce = [...bytes.toString("latin1").matchAll(/\x21\xf9\x04(.)\x04\x00.\x00/gs)];
  assert(gce.length >= 85);
  assert(gce.some(frame => frame[1].charCodeAt(0) & 1));
  const still = readFileSync(new URL("../assets/ui/first-place-fireworks-still.png",import.meta.url));
  assert.equal(still.toString("ascii",1,4),"PNG");
  assert.equal(still.readUInt32BE(16),840);
  assert.equal(still.readUInt32BE(20),288);
});

test("only device reduced motion suppresses fireworks; failures fall back to a still",async t=>{
  let systemQuiet=false,reads=0,release;
  t.mock.method(globalThis,"fetch",async()=>{
    reads++;
    if (reads === 1) return new Response("", {status:404});
    await new Promise(resolve=>release=resolve);
    return new Response("GIF");
  });
  const host={children:[],append(image){image.isConnected=true;this.children.push(image);},getClientRects(){return [{}];}};
  const oldDoc=globalThis.document,oldWin=globalThis.window;
  t.after(()=>{if(oldDoc)globalThis.document=oldDoc;else delete globalThis.document;if(oldWin)globalThis.window=oldWin;else delete globalThis.window;});
  globalThis.window={matchMedia:()=>({matches:systemQuiet})};
  globalThis.document={createElement:()=>({setAttribute(){},getContext:()=>null,append(...children){this.children=children;},remove(){this.isConnected=false;host.children=host.children.filter(i=>i!==this);}})};
  await playFireworks(host,2);
  assert.equal(host.children.length,0);
  systemQuiet=true;await playFireworks(host,1);systemQuiet=false;
  assert.match(host.children[0].children[1].src,/fireworks-still.png$/);
  assert.equal(reads,0);
  await playFireworks(host,1);
  assert.match(host.children[0].className,/is-still/);
  const pending=playFireworks(host,1);await playFireworks(host,3);release();await pending;
  assert.equal(host.children.length,0);
  systemQuiet=true;await playFireworks(host,1,{manual:true});systemQuiet=false;
  const first=host.children[0];assert(first.children[1].src.startsWith("blob:"));
  assert.match(first.className,/is-manual/);
  await playFireworks(host,1);assert.equal(host.children.length,1);assert.notEqual(host.children[0].children[1].src,first.children[1].src);
  clearFireworks(host);assert.equal(host.children.length,0);assert.equal(reads,2);
});
