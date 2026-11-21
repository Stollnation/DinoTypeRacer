import {test} from 'node:test';
import assert from 'node:assert/strict';
import {RaceRooms} from '../scripts/race-rooms.mjs';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhWQAAAAASUVORK5CYII=';
const payload=()=>({title:'Field notes',text:'Clever claws.',racers:[{name:'My Fern',png},{name:'Nova',png}]});
function setup(){let now=5000;const rooms=new RaceRooms(()=>now),host=rooms.open(payload()),r=rooms.get(host.code);
return {rooms,host,r,advance:n=>now+=n,act:(s,a,b={})=>rooms.act(r,s.credential,a,b)};}
test('free room uses a short code, only selected data, and private role credentials',()=>{
  const {rooms,r,host}=setup();assert.match(host.code,/^\d{4}$/);assert.throws(()=>rooms.view(r,''));const student=rooms.join(r,'Clover');
  const view=rooms.view(r,student.credential);assert.equal(view.title,'Field notes');assert.equal(view.racers[0].name,'My Fern');
  assert(!JSON.stringify(view).includes(host.credential));assert(!JSON.stringify(view).includes(student.credential));assert(!JSON.stringify(view).includes(png));
});
test('unique seats, capacity, nickname conflicts and teacher-only synchronized start',()=>{
  const {rooms,r,act,host,advance}=setup();const a=rooms.join(r,'A');assert.throws(()=>rooms.join(r,'a'));const b=rooms.join(r,'B');
  assert.throws(()=>rooms.join(r,'Full'));assert.throws(()=>act(host,'start'));
  act(a,'pick',{racer:'1'});assert.throws(()=>act(b,'pick',{racer:'1'}));act(b,'pick',{racer:'2'});
  assert.throws(()=>act(a,'start'));const v=act(host,'start');assert.equal(v.phase,'countdown');assert.equal(v.startAt,8000);
  assert.throws(()=>rooms.join(r,'Too late'));assert.throws(()=>act(a,'pick',{racer:'2'}));assert.throws(()=>act(a,'progress',{index:1,errors:0}));
  advance(3001);assert.equal(rooms.view(r,a.credential).phase,'racing');assert.throws(()=>act(a,'progress',{index:10000,errors:0}));
  act(b,'progress',{index:r.text.length,errors:1});advance(500);act(a,'progress',{index:r.text.length,errors:0});
  const final=act(a,'progress',{index:r.text.length,errors:0});assert.equal(final.phase,'finished');assert.deepEqual(final.players.map(p=>p.place),[2,1]);
});
test('leaving or removing a student releases the dino; rooms close or expire',()=>{
  const {rooms,r,act,host,advance}=setup();const a=rooms.join(r,'A');act(a,'pick',{racer:'1'});act(host,'remove',{id:a.id});
  assert.throws(()=>rooms.view(r,a.credential));const b=rooms.join(r,'B');act(b,'pick',{racer:'1'});act(b,'leave');act(host,'end');assert.throws(()=>rooms.get(host.code));
  const next=rooms.open(payload());advance(2*60*60*1000);assert.throws(()=>rooms.get(next.code));
});
test('rejects missing passages, empty rosters and invalid artwork',()=>{
  const s=new RaceRooms();for(const bad of [{text:''},{racers:[]},{racers:[{name:'X',png:'nope'}]}])assert.throws(()=>s.open({...payload(),...bad}));
});
