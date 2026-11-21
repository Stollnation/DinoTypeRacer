import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, readBackup, restoreBackup } from '../src/browser-backup.js';
const png=new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhWQAAAAASUVORK5CYII=','base64')],{type:'image/png'});
const state=()=>({version:1,profile:{name:'Blue',characterId:'custom-racer-blue'},settings:{theme:'forest'},passages:[{id:'p',title:'Spelling',text:'Blue.'}],records:[],playerProfiles:{red:{profile:{name:'Red'},records:[]}},customRacersByProfile:{blue:{name:'Skater'},red:[{name:'Flyer',id:'r1'}]},progression:{level:2},campaigns:[],campaignProgress:{test:{wins:1}},nemesesByProfile:{blue:{comma:{cleanWins:2}}}});
test('portable backup restores all profiles, old and new racer art, and progress',async()=>{
  const s=state(),pack=await readBackup(await makeBackup(s,async()=>png));
  assert.deepEqual(pack.state,s);assert.equal(pack.assets.size,2);
  const files=new Map(),old={...state(),customRacersByProfile:{}};
  let saved;await restoreBackup(pack,{writeAsset:async(k,v)=>files.set(k,v),removeAsset:async k=>files.delete(k),commit:v=>{saved=v},oldState:old});
  assert.deepEqual(saved.nemesesByProfile,s.nemesesByProfile);assert.deepEqual(saved.playerProfiles,s.playerProfiles);assert.deepEqual(saved.campaignProgress,s.campaignProgress);
  assert.equal(saved.customRacersByProfile.blue[0].id,'legacy');assert.equal(saved.profile.characterId,s.profile.characterId);
  for(const list of Object.values(saved.customRacersByProfile))assert.deepEqual(await files.get(list[0].assetKey).bytes(),await png.bytes());
  const again=await readBackup(await makeBackup(saved,k=>files.get(k)));assert.equal(again.assets.size,2);
});
test('rejects wrong files, truncation, changed header and changed art',async()=>{
  const file=await makeBackup(state(),async()=>png),bytes=await file.bytes();
  await assert.rejects(()=>readBackup(new Blob(['bad'])));
  await assert.rejects(()=>readBackup(file.slice(0,-1)));
  for(const at of [65,bytes.length-1]) {const bad=bytes.slice();bad[at]^=1;await assert.rejects(()=>readBackup(new Blob([bad])));}
  await assert.rejects(()=>makeBackup(state(),async()=>null));await assert.rejects(()=>makeBackup({...state(),version:42},async()=>png));
});
test('failed artwork write or save quota never replaces existing racers',async()=>{
  const s=state(),pack=await readBackup(await makeBackup(s,async()=>png));
  for(const fail of ['image','commit']){
    const files=new Map([['blue',png],['red:r1',png]]);let writes=0;
    await assert.rejects(()=>restoreBackup(pack,{oldState:s,writeAsset:async(k,v)=>{if(++writes===2&&fail==='image')throw Error('write failure');files.set(k,v)},removeAsset:async k=>files.delete(k),commit:()=>{throw Error('quota')}}));
    assert.deepEqual([...files.keys()],['blue','red:r1']);
  }
});
