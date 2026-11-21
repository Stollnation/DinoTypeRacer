// Thin illustrated panels. All measurements below are in original art pixels:
// one uniform scale per panel, including corners, vertical rails and foliage.
// HTML stays in place for keyboard access; the artwork takes no pointer input.
const atlas = new URL("../assets/ui/expedition-frame.webp", import.meta.url).href;
const ns = "http://www.w3.org/2000/svg";
const selectors = [
  "#dashboardScreen .setup-grid > .setup-panel",
  "#dashboardScreen > .championship-map",
  ".manual-pace-form",
  ".library-screen",
  ".creator-screen",
  ".racer-workshop-screen",
].join(",");
const cornerXY = [[0,0],[1280,0],[0,1280],[1280,1280]];
const choices = [0,3,1,2,3,0,2,1,3,2,0,1,2];
const records = new WeakMap();
const shared = (p) => {
  const cuts = ["E","W","S","N"].map((side,i) => {
    const axes = [[0,0,1,0],[1,0,0,0],[0,0,0,1],[0,1,0,0]][i];
    return '<linearGradient id="'+p+side+'" x1="'+axes[0]+'" y1="'+axes[1]+'" x2="'+axes[2]+'" y2="'+axes[3]+'"><stop offset=".34" stop-color="black" stop-opacity="0"/><stop offset=".57" stop-color="black"/></linearGradient>';
  }).join("");
  const masks = ["ES","WS","EN","WN"].map((pair,i) =>
    '<mask id="'+p+'c'+i+'" maskUnits="userSpaceOnUse" x="0" y="0" width="256" height="256"><rect width="256" height="256" fill="white"/>'+[...pair].map(side=>'<rect width="256" height="256" fill="url(#'+p+side+')"/>').join("")+'</mask>').join("");
  const leaf = '<path d="M0 9 Q55 0 114 35 Q142 48 166 42" fill="none" stroke="#535020" stroke-width="4" stroke-linecap="round"/>'+
    [[29,9,-30],[48,12,25],[67,18,-25],[86,25,34],[106,32,-17],[125,40,20],[146,44,-22]].map(([x,y,angle],i)=>
    '<g transform="translate('+x+' '+y+') rotate('+angle+') scale(1 '+(i%2===0?-1:1)+')"><path d="M-2 1 Q7 -2 12 -9 Q24 -18 32 -16 Q30 -3 18 2 Q7 6 -2 1Z" fill="'+["#778b2d","#627d28","#889a39"][i%3]+'" stroke="#465320" stroke-width="1.6"/><path d="M2 1 Q14 0 25 -11" fill="none" stroke="#acb95f" stroke-width="1.8"/></g>').join("");
  const flower = '<g transform="translate(116 35)">'+[0,72,144,216,288].map(a=>'<ellipse transform="rotate('+a+')" cy="-5" rx="3.5" ry="6" fill="#e5ab69" stroke="#9c6939" stroke-width="1.1"/>').join("")+'<circle r="3.3" fill="#edc951"/></g>';
  // Carry the actual foliage beyond the short stone cap, not its differently
  // aligned tail stone. SourceAlpha preserves the transparent leaf cutouts.
  const greens='<filter id="'+p+'greens" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  -6 7 -1 0 -.35"/><feComposite in2="SourceGraphic" operator="in"/></filter>';
  return cuts+masks+greens+'<image id="'+p+'atlas" href="'+atlas+'" width="1536" height="1536"/><g id="'+p+'leaf">'+leaf+'</g><g id="'+p+'flower">'+flower+'</g>';
};
function slice(p,x,y,w,h) {
  return '<svg width="'+w+'" height="'+h+'" viewBox="'+x+' '+y+' '+w+' '+h+'" overflow="hidden"><use href="#'+p+'atlas"/></svg>';
}
// The four painted arms don't meet the same centreline. At the upper-right,
// for instance, the vertical arm is 27–65px in from the edge. A full-width
// rail beginning there leaves a square ledge. Grow the rail outward from
// inside each opaque cap; never expose the rectangular end of its image.
const jointArms = [[[8,55],[12,62]],[[18,68],[24,73]],[[12,54],[17,52]],[[29,65],[17,57]]];
function jointPath(len,side) {
  const [[oa,ia],[ob,ib]]=jointArms[side], a=(oa+ia)/2,b=(ob+ib)/2;
  return `M 55 ${a} C 70 ${a} 88 ${oa} 96 ${oa} S 135 0 160 0 H ${len-160}
    C ${len-135} 0 ${len-114} ${ob} ${len-96} ${ob} S ${len-71} ${b} ${len-55} ${b}
    C ${len-70} ${b} ${len-85} ${ib} ${len-96} ${ib} S ${len-135} 96 ${len-160} 96 H 160
    C 135 96 114 ${ia} 96 ${ia} S 70 ${a} 55 ${a} Z`;
}
function render(host) {
  const r = records.get(host);
  if (!r || !host.getClientRects().length) return;
  const box = host.getBoundingClientRect(), width=box.width, height=box.height;
  if (width<1 || height<1) return;
  const requested = parseFloat(getComputedStyle(host).getPropertyValue("--frame-corner")) || 52;
  const scale = Math.min(requested, width/2, height/2)/256;
  const w=width/scale, h=height/scale, key=[width,height,requested].join(":");
  if (key===r.key) return;
  r.key=key;
  r.svg.setAttribute("viewBox", "0 0 "+w+" "+h);
  const p=r.prefix; let defs="", rails="", accents="";
  const transforms=["matrix(1 0 0 1 0 0)","matrix(1 0 0 -1 0 "+h+")","matrix(0 1 1 0 0 0)","matrix(0 1 -1 0 "+w+" 0)"];
  for (let side=0;side<4;side++) {
    const len=side<2?w:h, start=55, end=len-55;
    // The original horizontal and vertical pieces have different painted
    // widths. Turn the preferred bottom stones as intact squares instead.
    // No tile ever resizes to fill a remainder. The trimmed ends are hidden
    // under ~half a corner, and that corner's stone tips crossfade into them.
    const phase=(r.seed*173+side*89)%256, count=choices.length;
    const tiles=Array.from({length:count},(_,i)=>{
      const j=choices[(i+(side*3+r.seed))%count];
      const flip=(i*3+side+r.seed)%5<2;
      // Keep the painted top highlight facing the light on the upper rail.
      return '<g transform="translate('+(256*i+(flip?256:0))+' '+(side===0?-24:96)+') scale('+(flip?-1:1)+' '+(side===0?1:-1)+')">'+slice(p,256+j*256,1440,256,96)+'</g>';
    }).join("");
    defs+='<pattern id="'+p+'rail'+side+'" x="'+phase+'" y="0" width="'+(count*256)+'" height="96" patternContentUnits="userSpaceOnUse" patternUnits="userSpaceOnUse">'+tiles+'</pattern>';
    // Subpixel antialiasing can leave a hairline between two opaque SVG
    // viewports at fractional browser zoom. A narrow sandstone joint behind
    // the opaque middle connects them without flattening the outer silhouette.
    defs+='<clipPath id="'+p+'join'+side+'"><path d="'+jointPath(len,side)+'"/></clipPath>';
    rails+='<g transform="'+transforms[side]+'"><g clip-path="url(#'+p+'join'+side+')"><rect x="'+start+'" y="26" width="'+(end-start)+'" height="18" fill="#ac8156"/><rect x="'+start+'" width="'+(end-start)+'" height="96" fill="url(#'+p+'rail'+side+')"/></g></g>';
    if (requested<32 || len<1350) continue;
    let sprigs="";
    for(let i=0,t=450+(r.seed*217+side*349)%750;t<len-480;i++,t+=900+((i*431+r.seed*173+side*193)%800)) {
      const mirror=(i+side+r.seed)%2===1, flowering=(i+2*side+r.seed)%4===0;
      sprigs+='<g transform="translate('+(t+(mirror?160:0))+' 31) scale('+(mirror?-1:1)+' 1)"><use href="#'+p+'leaf"/>'+(flowering?'<use href="#'+p+'flower"/>':'')+'</g>';
    }
    accents+='<g transform="'+transforms[side]+'">'+sprigs+'</g>';
  }
  const corners=cornerXY.map(([sx,sy],i)=>{const art=slice(p,sx,sy,256,256);return '<g transform="translate('+(i%2?w-256:0)+' '+(i>=2?h-256:0)+')"><g mask="url(#'+p+'c'+i+')">'+art+'</g><g filter="url(#'+p+'greens)">'+art+'</g></g>';}).join("");
  // Stop the panel surface inside the opaque stone band on *all* sides.
  // The inset rounded corner keeps parchment out of the foliage's cutouts.
  r.svg.innerHTML='<defs>'+shared(p)+defs+'</defs><rect class="expedition-paper" x="36" y="36" width="'+(w-72)+'" height="'+(h-72)+'" rx="75"/>'+rails+corners+accents;
}
async function mount() {
  const bitmap = new Image(); bitmap.src=atlas; await bitmap.decode();
  const observer=new ResizeObserver(entries=>entries.forEach(e=>render(e.target)));
  document.querySelectorAll(selectors).forEach((host,i)=>{
    const svg=document.createElementNS(ns,"svg");
    svg.setAttribute("class","expedition-art");svg.setAttribute("aria-hidden","true");svg.setAttribute("focusable","false");
    // The summary is rendered even when details is closed. Its positioned
    // ancestor remains the disclosure, so the same art fits both states.
    (host.matches("details") ? host.querySelector("summary") : host).append(svg);
    records.set(host,{svg,prefix:"exp-frame-"+i+"-",seed:i,key:""});
    host.classList.add("expedition-framed"); observer.observe(host,{box:"border-box"});render(host);
    if(host.matches("details")) host.addEventListener("toggle",()=>render(host));
  });
}
mount().catch(()=>{/* Native solid borders remain available without artwork. */});
