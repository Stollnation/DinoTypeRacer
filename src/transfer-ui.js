import {makeBackup, readBackup, restoreBackup} from "./browser-backup.js";

export function bindBrowserTransfer({getState,readAsset,writeAsset,removeAsset,commit}) {
  const byId=id=>document.getElementById(id);
  const exp=byId("exportBrowserSave"),imp=byId("importBrowserSave"),file=byId("browserBackupFile"),dialog=byId("restoreBackupDialog");
  const status=byId("backupStatus"),cancel=byId("cancelRestore"),confirm=byId("confirmRestore");
  let pending=null,busy=false;
  function lock(locked){busy=locked;exp.disabled=imp.disabled=cancel.disabled=confirm.disabled=locked;}
  function problem(e){status.textContent="Not completed: "+(e.message||"This browser could not access the save.");}
  exp.addEventListener("click",async()=>{
    if(busy)return; lock(true);status.textContent="Packing game saves and racer artwork…";
    try{
      const blob=await makeBackup(getState(),readAsset),url=URL.createObjectURL(blob);
      const link=document.createElement("a");link.href=url;link.download="Dino-Type-Racer-"+new Date().toISOString().slice(0,10)+".dinobackup";
      document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
      status.textContent="Backup ready. Move the downloaded file to the other computer, then choose Import backup there.";
    }catch(e){problem(e);}finally{lock(false);}
  });
  imp.addEventListener("click",()=>{if(!busy) file.click();});
  file.addEventListener("change",async()=>{
    const selected=file.files[0];file.value="";if(!selected||busy)return;
    lock(true);status.textContent="Checking backup…";
    try{
      pending=await readBackup(selected);
      const state=pending.state, names=new Set(Object.values(state.playerProfiles||{}).map(p=>p.profile.name).filter(Boolean));
      if(state.profile.name)names.add(state.profile.name);
      byId("backupSummary").textContent="Incoming backup: "+names.size+" player(s), "+(state.campaigns||[]).length+" campaign(s), and "+pending.assets.size+" custom racer image(s).";
      dialog.showModal();status.textContent="Backup checked. No saves have been changed.";
    }catch(e){pending=null;problem(e);}finally{lock(false);}
  });
  cancel.addEventListener("click",()=>dialog.close());
  dialog.addEventListener("cancel",e=>{if(busy)e.preventDefault();});
  dialog.addEventListener("close",()=>{if(!busy && pending){pending=null;status.textContent="Import canceled. Your saves are unchanged.";}});
  confirm.addEventListener("click",async()=>{
    if(busy||!pending)return;lock(true);
    try{
      await restoreBackup(pending,{writeAsset,removeAsset,commit,oldState:getState()});
      history.replaceState(null,"","#ready");location.reload();
    }catch(e){dialog.close();lock(false);pending=null;queueMicrotask(()=>problem(e));}
  });
}
