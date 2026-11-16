(()=>{"use strict";if(window.DeepSeekWidget)return;let e=new URL("index.html",document.currentScript?.src||location.href).href,t=null;window.DeepSeekWidget={mount(a={}){if(t)return t;let r="card"===a.mode;if(a.mode&&!["card","floating"].includes(a.mode))throw Error("Widget mode must be card or floating.");let n=r?"string"==typeof a.container?document.querySelector(a.container):a.container:document.body;if(!(n instanceof HTMLElement))throw Error("Card mode requires an existing container element.");if(r&&"static"===getComputedStyle(n).position)throw Error("Card container must have position: relative, absolute or fixed.");let i=new URL(a.src||e,location.href);if(!["https:","http:"].includes(i.protocol))throw Error("Widget src must use HTTP or HTTPS.");if(a.namespace&&!/^[a-zA-Z0-9_.:@-]{1,128}$/.test(a.namespace))throw Error("Invalid widget namespace. Use 1–128 letters, digits, _, ., :, @ or -.");i.searchParams.set("mode","embed"),i.searchParams.set("parentOrigin",location.origin),r&&i.searchParams.set("presentation","card"),"screen"===a.theme&&i.searchParams.set("chatTheme","screen"),a.namespace&&i.searchParams.set("namespace",a.namespace);let s=document.createElement("div");s.setAttribute("data-deepseek-widget",""),s.dataset.mode=r?"card":"floating","screen"===a.theme&&(s.dataset.theme="screen"),s.style.cssText=`all:initial;position:${r?"absolute":"fixed"};inset:0;pointer-events:none;z-index:${r?"10":"2147483000"};`;let o=s.attachShadow({mode:"open"}),d=document.createElement("style");d.textContent=`
        :host { color-scheme: light; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        * { box-sizing: border-box; }
        [hidden] { display: none !important; }
        button { font: inherit; cursor: pointer; }
        button:focus-visible, iframe:focus-visible { outline: 3px solid #6f98ff; outline-offset: 3px; }
        .launcher { position: absolute; right: 24px; bottom: 24px; pointer-events: auto;
          display: flex; align-items: center; gap: 10px; padding: 0 20px; height: 52px;
          border: 1px solid #ffffff40; border-radius: 28px; color: white; background: #365cf5;
          box-shadow: 0 6px 24px #274ac938; transition: transform .18s, background .18s; }
        .launcher:hover { background: #294cda; transform: translateY(-2px); }
        .mark { font-size: 22px; line-height: 1; }
        .panel { position: absolute; right: 24px; bottom: 88px; width: min(440px, calc(100vw - 32px));
          height: min(680px, calc(100dvh - 112px)); display: flex; flex-direction: column;
          pointer-events: auto; overflow: hidden; border: 1px solid #dfe5f0; border-radius: 20px;
          background: #fff; box-shadow: 0 18px 72px #17265326, 0 2px 12px #1726530d; }
        .bar { display: flex; flex: 0 0 58px; align-items: center; gap: 10px; padding: 0 16px 0 20px;
          color: #19243c; background: #fff; border-bottom: 1px solid #edf0f6; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #365cf5; }
        .title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
        .minimize { display: grid; place-items: center; width: 32px; height: 32px; border: 0;
          border-radius: 9px; background: transparent; color: #66718a; font-size: 22px; }
        .minimize:hover { background: #f0f3fa; }
        iframe { display: block; flex: 1; min-height: 0; width: 100%; border: 0; background: #fff; }
        @media (max-width: 600px) {
          .launcher[aria-expanded="true"] { display: none; }
          .launcher { right: 16px; bottom: max(16px, env(safe-area-inset-bottom)); }
          .panel { inset: 0; width: 100%; height: 100%; border-radius: 0; border: 0; }
          .bar { padding-top: env(safe-area-inset-top); flex-basis: calc(58px + env(safe-area-inset-top)); }
        }
        :host([data-mode="card"]) .panel {
          inset: auto 0 0; width: 100%; height: min(var(--assistant-card-height, 285px), 100%);
          border-radius: 12px; transition: height 240ms ease; box-shadow: 0 8px 28px #06132233;
        }
        :host([data-mode="card"]) .panel[data-expanded="true"] { height: 100%; }
        :host([data-mode="card"]) .launcher { display: none; }
        :host([data-mode="card"]) .bar { flex-basis: 44px; padding: 0 14px; }
        :host([data-theme="screen"]) { color-scheme: dark; }
        :host([data-theme="screen"]) .panel {
          border-color: var(--assistant-border, #69c6e847);
          background: var(--assistant-surface, rgba(16, 45, 64, .64));
          -webkit-backdrop-filter: blur(var(--assistant-blur, 18px)) saturate(120%);
          backdrop-filter: blur(var(--assistant-blur, 18px)) saturate(120%);
          box-shadow: inset 0 0 18px #62b8f010, 0 8px 28px #06132255;
        }
        :host([data-theme="screen"]) .bar {
          color: var(--assistant-text, #eaf6ff); background: transparent; border-color: #69c6e82b;
        }
        :host([data-theme="screen"]) .dot { background: var(--assistant-accent, #35c6b4); box-shadow: 0 0 10px #35c6b450; }
        :host([data-theme="screen"]) .title { color: var(--assistant-accent, #35c6b4); }
        :host([data-theme="screen"]) .minimize { color: #9ecbdc; }
        :host([data-theme="screen"]) .minimize:hover { background: #a3d3ed14; }
        :host([data-theme="screen"]) iframe { background: transparent; color-scheme: normal; }
        @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
          :host([data-theme="screen"]) .panel { background: var(--assistant-fallback-surface, #102d40f5); }
        }
        @media (prefers-reduced-motion: reduce) { .launcher, .panel { transition: none; } }
      `;let l=document.createElement("button");l.type="button",l.className="launcher",l.setAttribute("aria-expanded","false"),l.setAttribute("aria-controls","assistant-panel"),l.setAttribute("aria-label",a.title||"智能助手");let c=document.createElement("span");c.className="mark",c.setAttribute("aria-hidden","true"),c.textContent="✦";let p=document.createElement("span");p.textContent=a.title||"智能助手",l.append(c,p);let m=document.createElement("section");m.id="assistant-panel",m.className="panel",m.hidden=!r,m.dataset.expanded="false",m.setAttribute("role","region"),m.setAttribute("aria-label",a.title||"智能助手");let h=document.createElement("div");h.className="bar";let u=document.createElement("span");u.className="dot";let b=document.createElement("span");b.className="title",b.textContent=a.title||"智能助手";let x=document.createElement("button");x.type="button",x.className="minimize",x.textContent=r?"⛶":"−",x.setAttribute("aria-label",r?"en-US"===a.locale?"Expand chat":"展开聊天":"en-US"===a.locale?"Minimize chat":"最小化聊天"),h.append(u,b,x),m.append(h),o.append(d,m,l);let f=null,g=!1,v=!1,w=!1;r&&(x.setAttribute("aria-expanded","false"),x.setAttribute("aria-controls",m.id));let k=e=>{r&&!v&&e!==w&&(w=e,m.dataset.expanded=String(e),x.setAttribute("aria-expanded",String(e)),x.setAttribute("aria-label","en-US"===a.locale?e?"Restore chat":"Expand chat":e?"恢复聊天":"展开聊天"),x.textContent=e?"⊡":"⛶",s.dispatchEvent(new CustomEvent("assistant:expand-change",{bubbles:!0,detail:{expanded:e}})))},y=e=>f?.contentWindow?.postMessage(e,i.origin),E=e=>{f&&e.source===f.contentWindow&&e.origin===i.origin&&e.data?.type==="assistant:ready"&&(y({type:"assistant:init",locale:a.locale,theme:a.theme}),y({type:"assistant:visibility",visible:g}))},S=()=>{!v&&(g=!0,m.hidden=!1,l.setAttribute("aria-expanded","true"),f||((f=document.createElement("iframe")).title=a.title||"智能助手",f.allow="microphone",f.src=i.href,m.append(f)),y({type:"assistant:visibility",visible:!0}),r||x.focus({preventScroll:!0}))},A=()=>{if(!v){if(r)return void k(!1);g=!1,y({type:"assistant:visibility",visible:!1}),m.hidden=!0,l.setAttribute("aria-expanded","false"),l.focus({preventScroll:!0})}};return l.addEventListener("click",()=>g?A():S()),x.addEventListener("click",()=>r?k(!w):A()),o.addEventListener("keydown",e=>{"Escape"===e.key&&g&&A()}),window.addEventListener("message",E),n.append(s),t={open:S,close:A,expand:()=>k(!0),collapse:()=>k(!1),toggleExpanded:()=>k(!w),destroy(){v||(y({type:"assistant:visibility",visible:!1}),v=!0,window.removeEventListener("message",E),s.remove(),t=null)}},r&&S(),t}}})();