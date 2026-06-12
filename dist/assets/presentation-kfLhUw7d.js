const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./mushaf-DJtGvs_r.js","./index-7fnC1GIb.js","./ui-CuE9iwGL.js","./index-Cj1WsKx0.css"])))=>i.map(i=>d[i]);
import{i as e}from"./ui-CuE9iwGL.js";import{D as t,E as n,O as r,a as i,h as a,i as o,m as s,p as c,r as l,t as u,x as d}from"./index-7fnC1GIb.js";var f=[{src:`backgrounds/dawn.jpg`,mood:`dawn`,label:`فجر`},{src:`backgrounds/clouds.jpg`,mood:`morning`,label:`صباح`},{src:`backgrounds/mountains.jpg`,mood:`afternoon`,label:`ظهر`},{src:`backgrounds/sunset.jpg`,mood:`sunset`,label:`غروب`},{src:`backgrounds/nightsky.jpg`,mood:`night`,label:`ليل`}];function p(){let e=new Date().getHours();return e>=4&&e<7?f[0]:e>=7&&e<12?f[1]:e>=12&&e<16?f[2]:e>=16&&e<19?f[3]:f[4]}function m(e){return f.find(t=>t.mood===e)||null}function h(){return f[Math.floor(Math.random()*f.length)]}var g=null,_=!0,v=null,y=null,b=[`kenBurns1`,`kenBurns2`,`kenBurns3`,`kenBurns4`,`kenBurns5`];function x(){return b[Math.floor(Math.random()*b.length)]}function S(){if(document.getElementById(`pres-styles`))return;let e=document.createElement(`style`);e.id=`pres-styles`,e.textContent=`
    .presentation-overlay {
      position: fixed; inset: 0; z-index: 5000;
      background: var(--bg-primary, #1a1a2e);
      display: flex; align-items: center; justify-content: center;
      direction: rtl; font-family: 'Scheherazade New', 'Amiri', serif;
      animation: presFadeIn 0.3s ease;
      transition: background-image 1.2s ease;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      overflow: hidden;
    }
    .presentation-overlay.pres-nature,
    .presentation-overlay.pres-auto {
      background-size: cover;
      background-position: center;
    }
    .presentation-overlay.pres-nature::before,
    .presentation-overlay.pres-auto::before {
      content: '';
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.35);
      z-index: 0;
    }
    .presentation-overlay.pres-nature .presentation-inner,
    .presentation-overlay.pres-auto .presentation-inner {
      position: relative; z-index: 1;
    }

    /* ===== ANIMATED MODE ===== */
    .presentation-overlay.pres-animated {
      background-size: cover;
      background-position: center;
    }
    .presentation-overlay.pres-animated::before {
      content: '';
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.3);
      z-index: 1;
    }
    .presentation-overlay.pres-animated::after {
      content: '';
      position: absolute;
      top: -20%; left: -20%;
      width: 140%; height: 140%;
      z-index: 0;
      pointer-events: none;
      background:
        radial-gradient(ellipse 600px 300px at 20% 30%, rgba(255,255,255,0.18) 0%, transparent 70%),
        radial-gradient(ellipse 500px 250px at 70% 50%, rgba(255,255,255,0.12) 0%, transparent 70%),
        radial-gradient(ellipse 700px 350px at 50% 70%, rgba(255,255,255,0.10) 0%, transparent 70%),
        radial-gradient(ellipse 400px 200px at 80% 20%, rgba(255,255,255,0.14) 0%, transparent 70%);
      animation: cloudDrift 25s ease-in-out infinite alternate;
    }
    .presentation-overlay.pres-animated .pres-bg-layer {
      position: absolute; inset: 0;
      background-size: cover;
      background-position: center;
      z-index: 0;
      animation: kenBurns1 24s ease-in-out infinite alternate;
    }
    .presentation-overlay.pres-animated .pres-bg-layer.kb2 { animation-name: kenBurns2; animation-duration: 28s; }
    .presentation-overlay.pres-animated .pres-bg-layer.kb3 { animation-name: kenBurns3; animation-duration: 22s; }
    .presentation-overlay.pres-animated .pres-bg-layer.kb4 { animation-name: kenBurns4; animation-duration: 26s; }
    .presentation-overlay.pres-animated .pres-bg-layer.kb5 { animation-name: kenBurns5; animation-duration: 30s; }
    .presentation-overlay.pres-animated .presentation-inner {
      position: relative; z-index: 2;
    }

    /* Ken Burns keyframes — cinematic slow pan/zoom */
    @keyframes kenBurns1 {
      0%   { transform: scale(1)   translate(0, 0); }
      100% { transform: scale(1.12) translate(3%, -2%); }
    }
    @keyframes kenBurns2 {
      0%   { transform: scale(1.1) translate(2%, 1%); }
      100% { transform: scale(1)    translate(-2%, -1%); }
    }
    @keyframes kenBurns3 {
      0%   { transform: scale(1)   translate(0, 2%); }
      100% { transform: scale(1.08) translate(1%, -3%); }
    }
    @keyframes kenBurns4 {
      0%   { transform: scale(1.1) translate(-1%, -2%); }
      100% { transform: scale(1)    translate(2%, 1%); }
    }
    @keyframes kenBurns5 {
      0%   { transform: scale(1); }
      100% { transform: scale(1.15); }
    }

    /* Floating cloud overlay animation */
    @keyframes cloudDrift {
      0%   { transform: translate(0, 0); }
      33%  { transform: translate(4%, 2%); }
      66%  { transform: translate(-3%, 1%); }
      100% { transform: translate(2%, -1%); }
    }

    /* ===== SCENE MODE (Canvas Animated Background) ===== */
    .presentation-overlay.pres-scene {
      background: #0a0a1a;
    }
    .presentation-overlay.pres-scene .pres-canvas-bg {
      position: absolute; inset: 0;
      z-index: 0;
      width: 100%; height: 100%;
    }
    .presentation-overlay.pres-scene::before {
      content: '';
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.15);
      z-index: 1;
    }
    .presentation-overlay.pres-scene .presentation-inner {
      position: relative; z-index: 2;
    }
    .presentation-overlay.pres-scene .presentation-ayah-text {
      color: #fff;
      text-shadow: 0 2px 16px rgba(0,0,0,0.8), 0 1px 4px rgba(0,0,0,0.6);
    }
    .presentation-overlay.pres-scene .presentation-translation {
      color: rgba(255,255,255,0.85);
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
    }
    .presentation-overlay.pres-scene .presentation-title {
      color: rgba(255,255,255,0.8);
    }
    .presentation-overlay.pres-scene .presentation-ayah-num {
      color: #ffe066;
    }
    .presentation-overlay.pres-scene .presentation-header {
      border-color: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-scene .presentation-footer {
      border-color: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-scene .presentation-counter {
      color: rgba(255,255,255,0.7);
    }
    .presentation-overlay.pres-scene .presentation-header-btn,
    .presentation-overlay.pres-scene .presentation-close-btn {
      color: #fff; background: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-scene .presentation-header-btn:hover,
    .presentation-overlay.pres-scene .presentation-close-btn:hover {
      background: rgba(255,255,255,0.3);
    }

    /* Animated mode text colors (same as nature) */
    .presentation-overlay.pres-animated .presentation-ayah-text {
      color: #fff;
      text-shadow: 0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5);
    }
    .presentation-overlay.pres-animated .presentation-translation {
      color: rgba(255,255,255,0.85);
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
    }
    .presentation-overlay.pres-animated .presentation-title {
      color: rgba(255,255,255,0.8);
    }
    .presentation-overlay.pres-animated .presentation-ayah-num {
      color: #ffe066;
    }
    .presentation-overlay.pres-animated .presentation-header {
      border-color: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-animated .presentation-footer {
      border-color: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-animated .presentation-counter {
      color: rgba(255,255,255,0.7);
    }
    .presentation-overlay.pres-animated .presentation-header-btn,
    .presentation-overlay.pres-animated .presentation-close-btn {
      color: #fff; background: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-animated .presentation-header-btn:hover,
    .presentation-overlay.pres-animated .presentation-close-btn:hover {
      background: rgba(255,255,255,0.3);
    }

    .presentation-overlay.pres-light {
      background: #f5f0e8;
    }
    .presentation-overlay.pres-light .presentation-ayah-text {
      color: #1a1a1a;
    }
    .presentation-overlay.pres-nature .presentation-ayah-text,
    .presentation-overlay.pres-auto .presentation-ayah-text {
      color: #fff;
      text-shadow: 0 2px 12px rgba(0,0,0,0.7), 0 1px 3px rgba(0,0,0,0.5);
    }
    .presentation-overlay.pres-nature .presentation-translation,
    .presentation-overlay.pres-auto .presentation-translation {
      color: rgba(255,255,255,0.85);
      text-shadow: 0 1px 6px rgba(0,0,0,0.5);
    }
    .presentation-overlay.pres-nature .presentation-title,
    .presentation-overlay.pres-auto .presentation-title {
      color: rgba(255,255,255,0.8);
    }
    .presentation-overlay.pres-nature .presentation-ayah-num,
    .presentation-overlay.pres-auto .presentation-ayah-num {
      color: #ffe066;
    }
    .presentation-overlay.pres-nature .presentation-header,
    .presentation-overlay.pres-auto .presentation-header {
      border-color: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-nature .presentation-footer,
    .presentation-overlay.pres-auto .presentation-footer {
      border-color: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-nature .presentation-counter,
    .presentation-overlay.pres-auto .presentation-counter {
      color: rgba(255,255,255,0.7);
    }
    .presentation-overlay.pres-nature .presentation-header-btn,
    .presentation-overlay.pres-auto .presentation-header-btn,
    .presentation-overlay.pres-nature .presentation-close-btn,
    .presentation-overlay.pres-auto .presentation-close-btn {
      color: #fff; background: rgba(255,255,255,0.15);
    }
    .presentation-overlay.pres-nature .presentation-header-btn:hover,
    .presentation-overlay.pres-auto .presentation-header-btn:hover,
    .presentation-overlay.pres-nature .presentation-close-btn:hover,
    .presentation-overlay.pres-auto .presentation-close-btn:hover {
      background: rgba(255,255,255,0.3);
    }
    .presentation-inner {
      display: flex; flex-direction: column;
      width: 100%; height: 100%; max-width: 1200px;
      padding: 20px; box-sizing: border-box;
    }
    .presentation-header {
      display: flex; align-items: center; gap: 12px;
      padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
    }
    .presentation-overlay.pres-light .presentation-header {
      border-color: rgba(0,0,0,0.1);
    }
    .presentation-title {
      font-size: 16px; color: var(--text-muted, #aaa); flex: 1;
    }
    .presentation-overlay.pres-light .presentation-title {
      color: #666;
    }
    .presentation-ayah-num {
      font-size: 18px; color: var(--accent, #ffe066); font-weight: 700;
    }
    .presentation-overlay.pres-light .presentation-ayah-num {
      color: #8b6f5a;
    }
    .presentation-header-btn, .presentation-close-btn {
      background: rgba(255,255,255,0.1); border: none;
      color: #fff; font-size: 22px; padding: 8px 16px;
      border-radius: 8px; cursor: pointer; transition: background 0.2s;
    }
    .presentation-overlay.pres-light .presentation-header-btn,
    .presentation-overlay.pres-light .presentation-close-btn {
      color: #333; background: rgba(0,0,0,0.08);
    }
    .presentation-header-btn:hover, .presentation-close-btn:hover {
      background: rgba(255,255,255,0.2);
    }
    .presentation-overlay.pres-light .presentation-header-btn:hover,
    .presentation-overlay.pres-light .presentation-close-btn:hover {
      background: rgba(0,0,0,0.15);
    }
    .presentation-close-btn {
      font-size: 18px; padding: 8px 14px;
    }

    /* ===== AUTO-HIDE CONTROL BUTTONS ===== */
    .pres-control-btn {
      opacity: 0;
      transition: opacity 0.5s ease, background 0.2s;
      pointer-events: none;
    }
    .presentation-overlay.pres-controls-visible .pres-control-btn {
      opacity: 1;
      pointer-events: auto;
    }
    /* Tajweed toggle always visible — important feature users need to discover */
    .presentation-overlay .pres-tajweed-btn {
      opacity: 1 !important;
      pointer-events: auto !important;
    }
    .presentation-overlay .pres-tajweed-btn.pres-tajweed-off {
      opacity: 0.5 !important;
    }

    /* ===== FULLSCREEN: HIDE ALL UI, SHOW ONLY AYAH ===== */
    .presentation-overlay:fullscreen .presentation-header,
    .presentation-overlay:fullscreen .presentation-footer,
    .presentation-overlay:fullscreen .presentation-translation {
      opacity: 0;
      transition: opacity 0.5s ease;
      pointer-events: none;
    }
    .presentation-overlay:fullscreen.pres-controls-visible .presentation-header,
    .presentation-overlay:fullscreen.pres-controls-visible .presentation-footer {
      opacity: 1;
      pointer-events: auto;
    }
    .presentation-overlay:fullscreen .presentation-body {
      justify-content: center;
    }
    .presentation-overlay:fullscreen .presentation-ayah-text {
      font-size: 80px;
    }
    @media (max-width: 600px) {
      .presentation-overlay:fullscreen .presentation-ayah-text { font-size: 40px; }
    }
    @media (min-width: 1200px) {
      .presentation-overlay:fullscreen .presentation-ayah-text { font-size: 90px; }
    }

    .presentation-body {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 40px 20px; overflow-y: auto;
    }
    .presentation-ayah-text {
      font-size: 60px; line-height: 1.8; text-align: center;
      color: #fff; max-width: 900px;
      word-spacing: 6px;
    }
    .presentation-translation {
      font-size: 24px; line-height: 1.6; text-align: center;
      color: rgba(255,255,255,0.7); margin-top: 24px;
      font-family: 'Segoe UI', Tahoma, sans-serif;
      max-width: 700px;
    }
    .presentation-overlay.pres-light .presentation-translation {
      color: rgba(0,0,0,0.6);
    }
    .presentation-footer {
      display: flex; align-items: center; justify-content: center;
      padding: 12px 0; border-top: 1px solid rgba(255,255,255,0.1);
      flex-shrink: 0;
    }
    .presentation-overlay.pres-light .presentation-footer {
      border-color: rgba(0,0,0,0.1);
    }
    .presentation-counter {
      font-size: 16px; color: var(--text-muted, #aaa);
    }
    .presentation-overlay.pres-light .presentation-counter {
      color: #666;
    }
    @keyframes presFadeIn {
      from { opacity: 0; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    @media (max-width: 600px) {
      .presentation-ayah-text { font-size: 32px; }
      .presentation-body { padding: 20px 12px; }
      .presentation-translation { font-size: 18px; }
    }
    @media (min-width: 1200px) {
      .presentation-ayah-text { font-size: 72px; }
    }
  `,document.head.appendChild(e)}function C(e,t,n){let r=e,i=0;if(t!==1&&n===1){let e=r.replace(/^ب[\u064B-\u065F\u0670]*س[\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*[هة][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*[نث][\u064B-\u065F\u0670]*\s*[إأآٱ][\u064B-\u065F\u0670]*ل[\u064B-\u065F\u0670]*ر[\u064B-\u065F\u0670]*[حخ][\u064B-\u065F\u0670]*[يى][\u064B-\u065F\u0670]*م[\u064B-\u065F\u0670]*\s*/u,``);i=r.length-e.length,r=e}if(!_)return d(r);let o=c(t,n);if(o.length===0)return d(r);let l=s(i>0?o.map(e=>({rule:e.rule,start:e.start-i,end:e.end-i})):o),u=r.split(/\s+/).filter(e=>e.length>0),f=0;return u.map((e,t)=>{let n=a(e,f,l);return f+=e.length+ +(t<u.length-1),n}).join(` `)}function w(e){let t=e.querySelector(`.pres-bg-layer`);t&&t.remove()}function T(e,t){w(e);let n=document.createElement(`div`);n.className=`pres-bg-layer `+x(),n.style.backgroundImage=`url('${t}')`,e.insertBefore(n,e.firstChild)}function E(e){y!==null&&(cancelAnimationFrame(y),y=null);let t=e.querySelector(`.pres-canvas-bg`);if(t){let e=t._cleanupResize;typeof e==`function`&&window.removeEventListener(`resize`,e),t.remove()}}function D(e){let t=e.getContext(`2d`),n=[],r=[],i=0;function a(){let t=e.width,r=e.height;n=[];for(let e=0;e<250;e++)n.push({x:Math.random()*t,y:Math.random()*r,size:Math.random()*2.5+.5,speed:Math.random()*.02+.005,brightness:Math.random(),phase:Math.random()*Math.PI*2})}a();function o(){let a=e.width,s=e.height;i+=.016;let c=t.createLinearGradient(0,0,0,s);c.addColorStop(0,`#05050f`),c.addColorStop(.5,`#0a0a2e`),c.addColorStop(1,`#101030`),t.fillStyle=c,t.fillRect(0,0,a,s);let l=t.createLinearGradient(0,s*.2,0,s*.6);l.addColorStop(0,`rgba(60, 50, 80, 0)`),l.addColorStop(.3,`rgba(80, 60, 120, 0.06)`),l.addColorStop(.5,`rgba(100, 80, 140, 0.08)`),l.addColorStop(.7,`rgba(80, 60, 120, 0.06)`),l.addColorStop(1,`rgba(60, 50, 80, 0)`),t.fillStyle=l,t.fillRect(0,0,a,s);for(let e of n){let n=.5+.5*Math.sin(i*e.speed*60+e.phase),r=e.brightness*n;t.beginPath(),t.arc(e.x,e.y,e.size*(.7+.3*n),0,Math.PI*2),t.fillStyle=`rgba(255, 255, 240, ${r})`,t.fill(),e.size>1.8&&(t.beginPath(),t.arc(e.x,e.y,e.size*3,0,Math.PI*2),t.fillStyle=`rgba(200, 200, 255, ${r*.1})`,t.fill())}Math.random()<.003&&r.push({x:Math.random()*a*.8,y:Math.random()*s*.3,vx:4+Math.random()*4,vy:2+Math.random()*2,life:0,maxLife:30+Math.random()*30,length:40+Math.random()*60});for(let e=r.length-1;e>=0;e--){let n=r[e];n.x+=n.vx,n.y+=n.vy,n.life++;let i=1-n.life/n.maxLife;if(i<=0){r.splice(e,1);continue}t.beginPath(),t.moveTo(n.x,n.y),t.lineTo(n.x-n.vx*n.length/6,n.y-n.vy*n.length/6);let a=t.createLinearGradient(n.x,n.y,n.x-n.vx*n.length/6,n.y-n.vy*n.length/6);a.addColorStop(0,`rgba(255, 255, 255, ${i})`),a.addColorStop(1,`rgba(255, 255, 255, 0)`),t.strokeStyle=a,t.lineWidth=2,t.stroke()}y=requestAnimationFrame(o)}return o(),()=>{y!==null&&(cancelAnimationFrame(y),y=null)}}function O(e){let t=e.getContext(`2d`),n=0,r=[{amplitude:25,frequency:.008,speed:.4,yBase:.45,color:`rgba(10, 60, 120, 0.4)`},{amplitude:20,frequency:.012,speed:.6,yBase:.52,color:`rgba(15, 80, 160, 0.5)`},{amplitude:18,frequency:.015,speed:.8,yBase:.58,color:`rgba(20, 100, 180, 0.6)`},{amplitude:15,frequency:.02,speed:1,yBase:.64,color:`rgba(25, 120, 200, 0.7)`},{amplitude:12,frequency:.025,speed:1.3,yBase:.7,color:`rgba(30, 140, 210, 0.8)`},{amplitude:8,frequency:.03,speed:1.6,yBase:.78,color:`rgba(35, 150, 220, 0.85)`},{amplitude:5,frequency:.04,speed:2,yBase:.85,color:`rgba(40, 160, 230, 0.9)`}];function i(){let a=e.width,o=e.height;n+=.016;let s=t.createLinearGradient(0,0,0,o*.5);s.addColorStop(0,`#0d1b2a`),s.addColorStop(.3,`#1b2838`),s.addColorStop(.6,`#2d4059`),s.addColorStop(.85,`#4a6741`),s.addColorStop(1,`#7a8450`),t.fillStyle=s,t.fillRect(0,0,a,o);let c=a*.75,l=o*.15,u=t.createRadialGradient(c,l,0,c,l,120);u.addColorStop(0,`rgba(255, 255, 200, 0.3)`),u.addColorStop(.3,`rgba(255, 255, 200, 0.08)`),u.addColorStop(1,`rgba(255, 255, 200, 0)`),t.fillStyle=u,t.fillRect(0,0,a,o),t.beginPath(),t.arc(c,l,20,0,Math.PI*2),t.fillStyle=`rgba(255, 255, 220, 0.9)`,t.fill();for(let e of r){t.beginPath();let r=o*e.yBase;t.moveTo(0,o);for(let i=0;i<=a;i+=3){let a=r+Math.sin(i*e.frequency+n*e.speed)*e.amplitude+Math.sin(i*e.frequency*.5+n*e.speed*.7)*e.amplitude*.5;t.lineTo(i,a)}t.lineTo(a,o),t.closePath(),t.fillStyle=e.color,t.fill()}for(let e=0;e<30;e++){let r=e/30*a+Math.sin(n*.5+e)*20,i=o*.44+Math.sin(r*.008+n*.4)*25-5,s=.3+.7*Math.abs(Math.sin(n*2+e*.5));t.beginPath(),t.arc(r,i,1.5,0,Math.PI*2),t.fillStyle=`rgba(255, 255, 255, ${s*.5})`,t.fill()}y=requestAnimationFrame(i)}return i(),()=>{y!==null&&(cancelAnimationFrame(y),y=null)}}function k(e){let t=e.getContext(`2d`),n=0;function r(){let i=e.width,a=e.height;n+=.016;let o=t.createLinearGradient(0,0,0,a);o.addColorStop(0,`#020810`),o.addColorStop(.4,`#050d1a`),o.addColorStop(.7,`#081020`),o.addColorStop(1,`#0c1525`),t.fillStyle=o,t.fillRect(0,0,i,a);for(let e=0;e<80;e++){let r=(Math.sin(e*127.1+311.7)*.5+.5)*i,o=(Math.sin(e*269.5+183.3)*.5+.5)*a*.6,s=.3+.7*Math.abs(Math.sin(n*.5+e));t.beginPath(),t.arc(r,o,1,0,Math.PI*2),t.fillStyle=`rgba(255, 255, 240, ${s*.6})`,t.fill()}let s=[{r:50,g:255,b:100},{r:80,g:200,b:255},{r:150,g:100,b:255},{r:50,g:255,b:180}];for(let e=0;e<4;e++){let r=s[e],o=a*(.15+e*.1),c=a*.15;t.beginPath(),t.moveTo(0,o);for(let r=0;r<=i;r+=5){let i=Math.sin(r*.003+n*.3+e*1.5)*40,a=Math.sin(r*.006+n*.5+e*.8)*25,s=Math.sin(r*.001+n*.15+e*2)*60,c=o+i+a+s;t.lineTo(r,c)}for(let r=i;r>=0;r-=5){let i=Math.sin(r*.003+n*.3+e*1.5)*40,a=Math.sin(r*.006+n*.5+e*.8)*25,s=Math.sin(r*.001+n*.15+e*2)*60,l=o+i+a+s+c;t.lineTo(r,l)}t.closePath();let l=t.createLinearGradient(0,o-c,0,o+c*2);l.addColorStop(0,`rgba(${r.r}, ${r.g}, ${r.b}, 0)`),l.addColorStop(.3,`rgba(${r.r}, ${r.g}, ${r.b}, 0.08)`),l.addColorStop(.5,`rgba(${r.r}, ${r.g}, ${r.b}, 0.12)`),l.addColorStop(.7,`rgba(${r.r}, ${r.g}, ${r.b}, 0.08)`),l.addColorStop(1,`rgba(${r.r}, ${r.g}, ${r.b}, 0)`),t.fillStyle=l,t.fill()}for(let e=0;e<20;e++){let r=e/20*i+Math.sin(n*.3+e*2)*50,o=100+Math.sin(n*.5+e)*50,c=.03+.04*Math.abs(Math.sin(n*.8+e*.7)),l=s[e%s.length],u=t.createLinearGradient(r,a*.1,r,a*.1+o);u.addColorStop(0,`rgba(${l.r}, ${l.g}, ${l.b}, 0)`),u.addColorStop(.5,`rgba(${l.r}, ${l.g}, ${l.b}, ${c})`),u.addColorStop(1,`rgba(${l.r}, ${l.g}, ${l.b}, 0)`),t.beginPath(),t.moveTo(r-15,a*.1),t.lineTo(r+15,a*.1),t.lineTo(r+5,a*.1+o),t.lineTo(r-5,a*.1+o),t.closePath(),t.fillStyle=u,t.fill()}y=requestAnimationFrame(r)}return r(),()=>{y!==null&&(cancelAnimationFrame(y),y=null)}}function A(e){let t=e.getContext(`2d`),n=0,r=[];function i(){let t=e.width,n=e.height;r=[];for(let e=0;e<120;e++)r.push({x:Math.random()*t,y:Math.random()*n,vx:(Math.random()-.5)*.3,vy:-Math.random()*.5-.1,size:Math.random()*3+1,opacity:Math.random()*.5+.2,phase:Math.random()*Math.PI*2})}i();function a(){let i=e.width,o=e.height;n+=.016;let s=t.createRadialGradient(i*.5,o*.4,0,i*.5,o*.4,Math.max(i,o)*.7);s.addColorStop(0,`#1a1510`),s.addColorStop(.5,`#0f0d08`),s.addColorStop(1,`#080604`),t.fillStyle=s,t.fillRect(0,0,i,o);let c=t.createRadialGradient(i*.5,o*.3,0,i*.5,o*.3,i*.4);c.addColorStop(0,`rgba(255, 200, 100, 0.08)`),c.addColorStop(.5,`rgba(255, 180, 80, 0.03)`),c.addColorStop(1,`rgba(255, 150, 50, 0)`),t.fillStyle=c,t.fillRect(0,0,i,o);for(let e of r){e.x+=e.vx+Math.sin(n+e.phase)*.2,e.y+=e.vy,e.y<-10&&(e.y=o+10,e.x=Math.random()*i),e.x<-10&&(e.x=i+10),e.x>i+10&&(e.x=-10);let r=.6+.4*Math.sin(n*1.5+e.phase),a=e.opacity*r,s=t.createRadialGradient(e.x,e.y,0,e.x,e.y,e.size*4);s.addColorStop(0,`rgba(255, 210, 100, ${a*.5})`),s.addColorStop(1,`rgba(255, 180, 50, 0)`),t.fillStyle=s,t.fillRect(e.x-e.size*4,e.y-e.size*4,e.size*8,e.size*8),t.beginPath(),t.arc(e.x,e.y,e.size*r,0,Math.PI*2),t.fillStyle=`rgba(255, 220, 120, ${a})`,t.fill()}y=requestAnimationFrame(a)}return a(),()=>{y!==null&&(cancelAnimationFrame(y),y=null)}}function j(e){let t=e.getContext(`2d`),n=0,r=[],i=0,a=200+Math.random()*400;function o(){let t=e.width,n=e.height;r=[];for(let e=0;e<200;e++)r.push({x:Math.random()*t,y:Math.random()*n,speed:8+Math.random()*8,length:15+Math.random()*20,opacity:.1+Math.random()*.3})}o();function s(){let o=e.width,c=e.height;n+=.016;let l=t.createLinearGradient(0,0,0,c);l.addColorStop(0,`#0a0c12`),l.addColorStop(.3,`#111520`),l.addColorStop(.6,`#1a1e2e`),l.addColorStop(1,`#0d1018`),t.fillStyle=l,t.fillRect(0,0,o,c),n*60>a&&(i=.6,a=n*60+200+Math.random()*500),i>0&&(t.fillStyle=`rgba(180, 190, 255, ${i})`,t.fillRect(0,0,o,c),i*=.85,i<.01&&(i=0));for(let e=0;e<5;e++){let r=e/5*o+Math.sin(n*.1+e*3)*40,i=c*.05+Math.sin(n*.05+e)*20,a=200+Math.sin(e*7.3)*80,s=60+Math.sin(e*4.1)*20,l=t.createRadialGradient(r,i,0,r,i,a*.5);l.addColorStop(0,`rgba(30, 35, 50, 0.6)`),l.addColorStop(1,`rgba(20, 25, 35, 0)`),t.fillStyle=l,t.fillRect(r-a,i-s,a*2,s*2)}t.lineCap=`round`;for(let e of r)e.y+=e.speed,--e.x,e.y>c&&(e.y=-e.length,e.x=Math.random()*o),e.x<-20&&(e.x=o+20),t.beginPath(),t.moveTo(e.x,e.y),t.lineTo(e.x-1.5,e.y+e.length),t.strokeStyle=`rgba(150, 170, 220, ${e.opacity})`,t.lineWidth=1,t.stroke();for(let e=0;e<15;e++){let r=(Math.sin(n*3+e*17.3)*.5+.5)*o,i=c-10-Math.random()*5,a=.2+.2*Math.abs(Math.sin(n*5+e*3.7));t.beginPath(),t.arc(r,i,2,0,Math.PI*2),t.fillStyle=`rgba(150, 170, 220, ${a})`,t.fill()}y=requestAnimationFrame(s)}return s(),()=>{y!==null&&(cancelAnimationFrame(y),y=null)}}var M={stars:D,waves:O,aurora:k,particles:A,rain:j};function N(e,t){E(e);let n=document.createElement(`canvas`);n.className=`pres-canvas-bg`,n.dataset.scene=t,n.width=window.innerWidth,n.height=window.innerHeight,e.insertBefore(n,e.firstChild);let r=M[t];r&&r(n);let i=()=>{n.width=window.innerWidth,n.height=window.innerHeight};window.addEventListener(`resize`,i),n._cleanupResize=i}function P(){let t=e.presentationOverlay;t&&(t.classList.add(`pres-controls-visible`),v&&clearTimeout(v),v=setTimeout(()=>{F()},3e3))}function F(){let t=e.presentationOverlay;t&&t.classList.remove(`pres-controls-visible`)}function I(){let t=e.presPlayPauseBtn;t&&(t.textContent=n.isPlaying?`⏸`:`▶`)}function L(){_=!_;let t=e.presTajweedBtn;t&&t.classList.toggle(`pres-tajweed-off`,!_),B()}function R(){let t=e.presentationOverlay;t&&(document.fullscreenElement||document.webkitFullscreenElement?document.exitFullscreen?document.exitFullscreen().catch(()=>{}):document.webkitExitFullscreen&&document.webkitExitFullscreen().catch(()=>{}):t.requestFullscreen?t.requestFullscreen().catch(()=>{}):t.webkitRequestFullscreen&&t.webkitRequestFullscreen().catch(()=>{}))}function z(){let t=e.presFullscreenBtn;t&&(t.textContent=document.fullscreenElement||document.webkitFullscreenElement?`⤓`:`⛶`)}function B(){if(!n.presentationMode)return;let r=e.presentationOverlay;if(r)if(r.classList.remove(`pres-nature`,`pres-auto`,`pres-animated`,`pres-scene`),n.presBgMode===`nature`){w(r),E(r);let e=h();r.style.backgroundImage=`url('${e.src}')`,r.classList.add(`pres-nature`),r.classList.remove(`pres-light`)}else if(n.presBgMode===`singleNature`){w(r),E(r);let e=m(n.presBgNature)||h();r.style.backgroundImage=`url('${e.src}')`,r.classList.add(`pres-nature`),r.classList.remove(`pres-light`)}else if(n.presBgMode===`auto`){w(r),E(r);let e=p();r.style.backgroundImage=`url('${e.src}')`,r.classList.add(`pres-auto`),r.classList.remove(`pres-light`)}else if(n.presBgMode===`animated`)E(r),r.style.backgroundImage=`none`,T(r,h().src),r.classList.add(`pres-animated`),r.classList.remove(`pres-light`);else if(n.presBgMode===`scene`){w(r),r.style.backgroundImage=`none`;let e=r.querySelector(`.pres-canvas-bg`),t=e?.dataset.scene;(!e||t!==n.presBgScene)&&N(r,n.presBgScene),r.classList.add(`pres-scene`),r.classList.remove(`pres-light`)}else w(r),E(r),r.style.backgroundImage=``,document.body.classList.contains(`night-mode`)||r.classList.add(`pres-light`);let i=n.surahData,a=i?.ayahs?.[n.currentAyahIndex];if(!a){e.presentationAyahText&&(e.presentationAyahText.innerHTML=`—`),e.presentationAyahNum&&(e.presentationAyahNum.textContent=`—`),e.presentationTitle&&(e.presentationTitle.textContent=`—`),e.presentationCounter&&(e.presentationCounter.textContent=`٠ / ٠`),e.presentationTranslation&&(e.presentationTranslation.style.display=`none`);return}e.presentationAyahText&&(e.presentationAyahText.innerHTML=C(a.text,n.currentSurah,a.numberInSurah)),e.presentationAyahNum&&(e.presentationAyahNum.textContent=String(a.numberInSurah));let o=i?.name||``;e.presentationTitle&&(e.presentationTitle.textContent=`${o} — ${t(`ayah`)} ${a.numberInSurah}`);let s=i?.ayahs?.length||0;e.presentationCounter&&(e.presentationCounter.textContent=`${a.numberInSurah} / ${s}`);let c=n.translationData;n.translationEnabled&&c?.ayahs?.[n.currentAyahIndex]?e.presentationTranslation&&(e.presentationTranslation.textContent=c.ayahs[n.currentAyahIndex].text,e.presentationTranslation.style.display=``):e.presentationTranslation&&(e.presentationTranslation.style.display=`none`),g&&clearTimeout(g);let l=e.presentationAyahText;l&&(l.style.transition=`opacity 0.4s ease`,l.style.opacity=`0.7`,g=setTimeout(()=>{l&&(l.style.opacity=`1`)},100)),I()}function V(t){let r=n.surahData;if(!r?.ayahs)return;let a=n.currentAyahIndex+t;if(!(a<0||a>=r.ayahs.length)&&(n.currentAyahIndex=a,B(),n.isPlaying&&u(),i(),e.presentationOverlay)){let t=e.presentationBody;t&&(t.scrollTop=0)}}function H(){n.mushafMode&&r(()=>import(`./mushaf-DJtGvs_r.js`).then(e=>e.toggleMushafMode()),__vite__mapDeps([0,1,2,3]),import.meta.url),n.presentationMode=!0,_=n.tajweedEnabled,S(),e.presentationOverlay&&(e.presentationOverlay.classList.remove(`hidden`),e.presentationOverlay.style.display=``,n.presBgMode===`plain`&&(document.body.classList.contains(`night-mode`)?e.presentationOverlay.classList.remove(`pres-light`):e.presentationOverlay.classList.add(`pres-light`))),e.presTajweedBtn&&e.presTajweedBtn.classList.toggle(`pres-tajweed-off`,!_),document.body.classList.add(`presentation-active`),document.querySelectorAll(`.view-mode-btn`).forEach(e=>{e.classList.toggle(`active`,e.dataset.mode===`presentation`)}),document.addEventListener(`keydown`,W),P(),B()}function U(){n.presentationMode=!1,(document.fullscreenElement||document.webkitFullscreenElement)&&(document.exitFullscreen?document.exitFullscreen().catch(()=>{}):document.webkitExitFullscreen&&document.webkitExitFullscreen().catch(()=>{})),e.presentationOverlay&&(e.presentationOverlay.classList.add(`hidden`),e.presentationOverlay.style.display=`none`,e.presentationOverlay.classList.remove(`pres-controls-visible`),w(e.presentationOverlay),E(e.presentationOverlay)),v&&(clearTimeout(v),v=null),document.body.classList.remove(`presentation-active`),document.removeEventListener(`keydown`,W),document.querySelectorAll(`.view-mode-btn`).forEach(e=>{e.classList.toggle(`active`,e.dataset.mode===`surah`)})}function W(e){if(!(e.target.tagName===`INPUT`||e.target.tagName===`TEXTAREA`||e.target.tagName===`SELECT`))switch(P(),e.key){case`Escape`:document.fullscreenElement||document.webkitFullscreenElement?(e.preventDefault(),document.exitFullscreen?document.exitFullscreen().catch(()=>{}):document.webkitExitFullscreen&&document.webkitExitFullscreen().catch(()=>{})):U();break;case`ArrowRight`:case`ArrowDown`:e.preventDefault(),V(1);break;case`ArrowLeft`:case`ArrowUp`:e.preventDefault(),V(-1);break;case` `:e.preventDefault(),l(),o(),I();break}}function G(){P()}function K(){z();let t=e.presentationOverlay;if(t&&n.presBgMode===`scene`){let e=t.querySelector(`.pres-canvas-bg`);e&&setTimeout(()=>{e.width=window.innerWidth,e.height=window.innerHeight},100)}}function q(){n.presentationMode&&(B(),I())}function J(){S(),e.presentationCloseBtn&&e.presentationCloseBtn.addEventListener(`click`,U),e.presentationPrevBtn&&e.presentationPrevBtn.addEventListener(`click`,()=>V(-1)),e.presentationNextBtn&&e.presentationNextBtn.addEventListener(`click`,()=>V(1)),e.presentationOverlay?.addEventListener(`click`,t=>{let n=!!(document.fullscreenElement||document.webkitFullscreenElement);t.target===e.presentationOverlay&&!n&&U()}),e.presPlayPauseBtn&&e.presPlayPauseBtn.addEventListener(`click`,()=>{l(),o(),I(),P()}),e.presTajweedBtn&&e.presTajweedBtn.addEventListener(`click`,()=>{L(),P()}),e.presFullscreenBtn&&e.presFullscreenBtn.addEventListener(`click`,()=>{R(),P()}),e.presentationOverlay?.addEventListener(`mousemove`,G),e.presentationOverlay?.addEventListener(`touchstart`,G,{passive:!0}),document.addEventListener(`fullscreenchange`,K),document.addEventListener(`webkitfullscreenchange`,K)}export{U as closePresentation,J as initPresentation,H as openPresentation,q as syncPresentation};