import { TypingSession, ordinal } from './typing.js';
import { clearFireworks, playFireworks } from './victory-fireworks.js';

const API='/api/classroom', KEY='dino:classroom:tab-v1';
const node=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
function button(text,fn,primary=false){const e=node('button',text,primary?'primary':'secondary');e.type='button';e.onclick=fn;return e;}
function field(label,control){const l=node('label',label);control.setAttribute('aria-label',label);l.append(control);return l;}
async function request(url,session,body){
  const headers={};if(session)headers.Authorization='Bearer '+session.credential;
  if(body!==undefined)headers['Content-Type']='application/json';
  const resp=await fetch(url,{headers,method:body===undefined?'GET':'POST',body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  let data;try{data=await resp.json();}catch{throw Error('The local classroom server is unavailable.');}
  if(!resp.ok)throw Object.assign(new Error(data.error||'Could not reach the room.'),{status:resp.status});return data;
}
async function portrait(character){
  const im=new Image();im.src=character.portrait;await im.decode();
  const canvas=document.createElement('canvas');canvas.width=canvas.height=192;
  const scale=Math.min(192/im.naturalWidth,192/im.naturalHeight), w=im.naturalWidth*scale,h=im.naturalHeight*scale;
  canvas.getContext('2d').drawImage(im,(192-w)/2,(192-h)/2,w,h);
  return {name:character.displayName,png:canvas.toDataURL('image/png').split(',')[1]};
}
export async function bindClassroom({passages,racers,nickname}){
  const $=id=>document.getElementById(id),dlg=$('dailyRoom'),area=$('dailyContent'),msg=$('dailyMessage'),exit=$('exitDaily');
  // Static hosting has no room server. Keep the normal game functional there.
  try{if((await request(API)).version!==1)return;}catch{return;}
  $('dailyTeacherEntry').hidden=$('joinDailyRace').hidden=false;
  let session=null,view=null,timer,clock,offset=0,typing=null,renderKey='',sentIndex=0,sentErrors=0,busy=false,polling=false,flying=false;
  let clockText,roster,picks,start,words,hint,keyboard,lanes,subtitle,art=new Map();
  const say=s=>{msg.textContent=s;};
  const show=()=>{if(!dlg.open)dlg.showModal();};
  const url=(s,part='')=>API+'/'+s.code+(part?'/'+part:'');
  const remember=s=>{try{s?sessionStorage.setItem(KEY,JSON.stringify(s)):sessionStorage.removeItem(KEY);}catch{}};
  function clear(){
    if(lanes)clearFireworks(lanes);
    clearInterval(timer);clearInterval(clock);for(const entry of art.values())if(entry.url)URL.revokeObjectURL(entry.url);
    art=new Map();session=view=typing=null;renderKey='';sentIndex=sentErrors=0;remember(null);area.replaceChildren();say('');exit.textContent='Back to setup';
  }
  function ended(message){clear();show();area.append(node('p',message));exit.focus();}
  function handle(e,s){if(s&&session!==s)return;if(s&&[403,404].includes(e.status))ended(e.message);else say(e.message||'Connection lost. Trying again.');}
  async function act(action,body={},opts={}){
    const s=session;if(!s||(!opts.progress&&busy))return;
    if(!opts.progress)busy=true;
    try{
      const data=await request(url(s,action),s,body);if(session!==s)return;
      if(data.ended){clear();dlg.close();}else{say('');accept(data);}
      return data;
    }catch(e){handle(e,s);}finally{if(!opts.progress)busy=false;}
  }
  async function poll(){
    const s=session;if(!s||polling)return;polling=true;
    try{const data=await request(url(s),s);if(session===s){if(msg.textContent==='Connection interrupted. Reconnecting…')say('');accept(data);}}
    catch(e){if(e.status)handle(e,s);else if(session===s)say('Connection interrupted. Reconnecting…');}finally{polling=false;}
  }
  function connect(s){clear();session=s;remember(s);show();area.append(node('p','Opening room…'));exit.textContent=s.role==='host'?'End room':'Leave room';poll();timer=setInterval(()=>{poll();flush();},550);clock=setInterval(updateClock,100);}
  function image(id){
    const im=node('img');im.alt='';im.width=64;im.height=64;const s=session,cache=art;
    if(!cache.has(id)){
      const entry={};cache.set(id,entry);
      entry.promise=fetch(url(s,'art/'+id),{headers:{Authorization:'Bearer '+s.credential}}).then(r=>{if(!r.ok)throw Error('Artwork unavailable');return r.blob();}).then(b=>{if(session!==s)return '';return entry.url=URL.createObjectURL(b);}).catch(()=>{cache.delete(id);return '';});
    }
    const entry=cache.get(id);if(entry.url)im.src=entry.url;else entry.promise.then(u=>{if(u)im.src=u;});return im;
  }
  function chooseTeacher(){
    area.replaceChildren();say('');show();
    const ps=passages(),cs=racers(),select=node('select'),preview=node('p',null,'daily-excerpt'),grid=node('div',null,'daily-dinos');
    for(const [i,p] of ps.entries())select.add(new Option((p.category?p.category+' · ':'')+p.title,String(i)));
    const previewPassage=()=>{preview.textContent=ps[Number(select.value)]?.text||'No enabled passages.';};select.onchange=previewPassage;previewPassage();
    const options=cs.map(c=>{
      const label=node('label',null,'daily-card'),im=node('img'),box=node('input');box.type='checkbox';box.checked=true;im.src=c.portrait;im.alt='';label.append(box,im,node('span',c.displayName+(c.custom?' · Custom':'')));grid.append(label);return {box,c};
    });
    const create=button('Open room',async()=>{
      if(busy)return;const chosen=options.filter(o=>o.box.checked),p=ps[Number(select.value)];
      if(!p||chosen.length<1||chosen.length>32){say('Pick a passage and 1–32 racers. Each racer is one seat.');return;}
      busy=true;create.disabled=true;exit.disabled=true;say('Preparing the selected portraits…');
      try{const payload={title:p.title,text:p.text,racers:await Promise.all(chosen.map(o=>portrait(o.c)))};
        connect(await request(API,null,payload));
      }catch(e){say(e.message);}finally{busy=false;create.disabled=false;exit.disabled=false;}
    },true);
    area.append(node('h3','Set up today’s race'),field('Passage',select),preview,node('h4','Racers to share'),node('p','Each selected racer is one seat. Only these portraits and this passage are shared. Add your own dinos in Custom Racer.'),grid,create);
  }
  function chooseStudent(){
    area.replaceChildren();say('');show();const form=node('form'),name=node('input'),code=node('input');
    name.type=code.type='text';name.maxLength=24;name.value=nickname();name.required=true;name.autocomplete='off';code.inputMode='numeric';code.pattern='[0-9]{4}';code.maxLength=4;code.required=true;code.autocomplete='off';code.placeholder='4 digits';
    const join=node('button','Join lobby','primary');join.type='submit';
    form.append(field('Racer nickname',name),field('Enter race code',code),join);area.append(node('h3','Join race'),form);
    (name.value?code:name).focus();form.onsubmit=async e=>{e.preventDefault();if(busy)return;busy=true;join.disabled=exit.disabled=true;try{connect(await request(API+'/'+code.value+'/join',null,{name:name.value.trim()}));}catch(err){say(err.message);}finally{busy=false;join.disabled=exit.disabled=false;}};
  }
  function updateClock(){
    if(!session||!view||view.startAt===null||!clockText)return;
    const left=view.startAt-(Date.now()+offset);
    clockText.textContent=left>0?'Starting in '+Math.ceil(left/1000):view.phase==='finished'?'Race complete':'Go!';
    if(typing&&keyboard&&left<=0&&keyboard.getAttribute('aria-disabled')==='true'){
      keyboard.setAttribute('aria-disabled','false');keyboard.focus();
    }
  }
  function layout(v,lobby){
    area.replaceChildren();picks=start=words=keyboard=hint=lanes=null;
    subtitle=node('h3',v.title);area.append(subtitle);
    if(lobby){
      area.append(node('p','Room code: '+session.code,'daily-code'));
      area.append(node('p',session.role==='host'?'Share the code. Start when every student has a dino.':'Choose your dino. Your teacher starts the race.'));
      if(session.role==='student'){picks=node('div',null,'daily-dinos');area.append(picks);}
      roster=node('ul',null,'daily-roster');area.append(roster);
      if(session.role==='host'){start=button('Start race',()=>act('start'),true);area.append(start);}
    }else{
      clockText=node('strong',null,'daily-clock');area.append(clockText);
      lanes=node('div',null,'daily-lanes');area.append(lanes);
      if(session.role==='student'){
        keyboard=node('div',null,'daily-keyboard');keyboard.tabIndex=0;keyboard.setAttribute('role','group');keyboard.setAttribute('aria-label','Race typing area');keyboard.setAttribute('aria-disabled','true');
        words=node('p',null,'daily-passage');hint=node('small');keyboard.append(words,hint);area.append(keyboard);
        keyboard.onkeydown=e=>{
          if(e.ctrlKey||e.altKey||e.metaKey||e.isComposing||!typing||typing.finished||Date.now()+offset<v.startAt)return;
          if(e.key==='Backspace'){e.preventDefault();typing.backspace();}
          else if(e.key.length===1){e.preventDefault();typing.type(e.key);}
          else return;
          paintText();if(typing.finished)flush();
        };
      }
      roster=node('ol',null,'daily-roster');area.append(node('h4','Race standings'),roster);
    }
  }
  function paintText(){
    if(!words||!typing)return;const text=typing.text,i=typing.index;
    const done=node('span',text.slice(0,i),'daily-typed'),cursor=node('span',text[i]||'',typing.errorChar?'daily-wrong':'daily-current');
    words.replaceChildren(done,cursor,document.createTextNode(text.slice(i+1)));
    if(cursor.offsetTop<words.scrollTop || cursor.offsetTop+cursor.offsetHeight>words.scrollTop+words.clientHeight)words.scrollTop=Math.max(0,cursor.offsetTop-words.clientHeight/2);
    hint.textContent=typing.finished?'Finished! Your place appears below.':typing.errorChar?'Missed key — press Backspace to correct.':'Type the passage. Use Backspace to clear a missed key.';
  }
  async function flush(){
    if(!session||!typing||flying||!view||Date.now()+offset<view.startAt||typing.index===sentIndex&&typing.errors===sentErrors)return;
    const s=session,index=typing.index,errors=typing.errors;flying=true;
    try{const ack=await act('progress',{index,errors},{progress:true});if(session===s&&ack){sentIndex=index;sentErrors=errors;}}finally{flying=false;}
  }
  let lastLayout='',lastList='';
  function accept(v){
    if(!session||view&&(v.rev<view.rev||v.rev===view.rev&&v.now<view.now))return;
    const first=!view, lobby=v.phase==='lobby',kind=lobby?'lobby':'track',me=v.players.find(p=>p.id===session.id);
    const justWon=me?.place===1&&view?.players.find(p=>p.id===session.id)?.place!==1;
    view=v;offset=v.now-Date.now();
    if(first||kind!==lastLayout){lastLayout=kind;lastList='';layout(v,lobby);renderKey='';}
    const claim=v.players.map(p=>[p.id,p.racer]).join('|');
    if(lobby&&claim!==renderKey||first&&lobby){
      renderKey=claim;
      if(picks)picks.replaceChildren(...v.racers.map(r=>{
        const owner=v.players.find(p=>p.racer===r.id),b=button('',()=>act('pick',{racer:r.id}));b.classList.add('daily-card');b.disabled=!!owner&&owner!==me;
        b.setAttribute('aria-pressed',String(!!owner&&owner===me));b.append(image(r.id),node('span',r.name),node('small',owner===me&&owner?'Your dino':owner?'Taken':'Choose'));return b;
      }));
      roster.replaceChildren(...v.players.map(p=>{const li=node('li'),r=v.racers.find(r=>r.id===p.racer);li.append(node('span',p.name+' — '+(r?r.name:'Choosing…')));
        if(session.role==='host'){const remove=button('Remove',()=>act('remove',{id:p.id}));remove.setAttribute('aria-label','Remove '+p.name);li.append(remove);}return li;}));
      if(!v.players.length)roster.append(node('li','Waiting for students…'));
    }
    if(start)start.disabled=!v.players.length||v.players.some(p=>!p.racer);
    if(!lobby){
      if(me&&!typing){typing=new TypingSession(v.text);typing.index=typing.correctKeystrokes=sentIndex=me.index;typing.errors=sentErrors=me.errors;typing.totalKeystrokes=me.index+me.errors;paintText();}
      const state=v.players.map(p=>[p.id,p.index,p.place,p.errors]).join('|');
      if(state!==lastList||first||!lanes.childElementCount){
        lastList=state;
        const sorted=[...v.players].sort((a,b)=>(a.place||999)-(b.place||999)||b.index-a.index||Number(a.id)-Number(b.id));
        for(const p of v.players){
          let lane=lanes.querySelector('[data-seat="'+p.id+'"]');if(!lane){lane=node('div',null,'daily-lane');lane.dataset.seat=p.id;const track=node('div',null,'daily-rail');track.append(image(p.racer));lane.append(node('span',p.name),track);lanes.append(lane);}
          lane.lastChild.style.setProperty('--distance',(p.index/v.text.length*100)+'%');
        }
        lanes.querySelectorAll('.daily-lane').forEach(l=>{if(!v.players.some(p=>p.id===l.dataset.seat))l.remove();});
        roster.replaceChildren(...sorted.map(p=>{const li=node('li');li.textContent=(p.place?ordinal(p.place)+' · ':'')+p.name+' — '+(p.finishAt!==null?Math.round(p.index*12000/Math.max(1,p.finishAt-v.startAt))+' WPM · '+Math.round(100*p.index/(p.index+p.errors))+'% accuracy':Math.round(100*p.index/v.text.length)+'% complete');return li;}));
      }updateClock();
      if(justWon)void playFireworks(lanes,me.place);
    }
  }
  $('hostDailyRace').onclick=chooseTeacher;$('joinDailyRace').onclick=chooseStudent;
  exit.onclick=async()=>{if(busy)return;if(!session){clear();dlg.close();return;}const host=session.role==='host';if(host&&!window.confirm('End this room for everyone?'))return;await act(host?'end':'leave');};
  dlg.addEventListener('cancel',e=>{if(session||busy)e.preventDefault();});
  let saved;try{saved=JSON.parse(sessionStorage.getItem(KEY));}catch{}
  if(saved&&/^\d{4}$/.test(saved.code)&&typeof saved.credential==='string')connect(saved);
}
