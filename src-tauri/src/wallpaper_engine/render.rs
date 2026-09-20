// render — extracted from wallpaper_engine.rs (V2 pillar 2, zero behavior change).
use super::scenes::SceneConfig;
use serde_json::json;

// ---------------------------------------------------------------------------
// Scene HTML
// ---------------------------------------------------------------------------

pub fn scene_html(scene: &SceneConfig) -> String {
    // A6.2 — deterministic seed: the scene id hashes to a fixed rng seed, so a
    // saved scene always renders identically across sessions.
    let seed = scene
        .id
        .bytes()
        .fold(2166136261u32, |h, b| (h ^ b as u32).wrapping_mul(16777619));
    let cfg = json!({
        "kind": scene.kind,
        "speed": scene.speed,
        "density": scene.density,
        "colors": scene.colors,
        "seed": seed,
    });
    // Script-context hardening (S3.6): serde_json doesn't escape < >, so a
    // hostile custom scene (kind/colors are free-form from the frontend) could
    // close the inline <script> block. \u003C/\u003E are valid JSON escapes.
    let cfg_json = serde_json::to_string(&cfg)
        .unwrap_or_else(|_| "{}".into())
        .replace('<', "\\u003C")
        .replace('>', "\\u003E");
    format!(
        r#"<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;padding:0;overflow:hidden;background:#0b1026;width:100%;height:100%}}
canvas{{display:block;width:100vw;height:100vh}}
</style></head><body>
<canvas id="c"></canvas>
<script>
const CFG = {};
const c = document.getElementById('c');
const ctx = c.getContext('2d');
let W=0,H=0,DPR=1;
let paused = false;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
window.__setPaused = (p) => {{ paused = !!p; }};
function resize(){{ DPR = Math.min(2, window.devicePixelRatio||1); W = innerWidth; H = innerHeight; c.width = W*DPR; c.height = H*DPR; ctx.setTransform(DPR,0,0,DPR,0,0); }}
addEventListener('resize', resize); resize();
const COL = CFG.colors.map(hex2rgb);
function hex2rgb(h){{ h=h.replace('#',''); if(h.length===3) h=h.split('').map(x=>x+x).join(''); return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }}
function rgba(c,a){{ return `rgba(${{c[0]}},${{c[1]}},${{c[2]}},${{a}})`; }}
function rand(a,b){{ return a + Math.random()*(b-a); }}
// A6.2 — seeded deterministic rng (mulberry32). Every scene with the same id
// and params renders the same picture, every time.
const RNG = (()=>{{ let s = CFG.seed>>>0 || 1; return ()=>{{ s = (s + 0x6D2B79F5)|0; let t = Math.imul(s ^ (s>>>15), 1|s); t = (t + Math.imul(t ^ (t>>>7), 61|t)) ^ t; return ((t ^ (t>>>14))>>>0)/4294967296; }}; }})();
const rnd=(a,b)=>a+RNG()*(b-a);
const S = CFG.speed, D = CFG.density;
let t = 0;
const TAU = Math.PI*2;

// ---- particles ---- (initial layout uses the seeded rnd so every scene with
// the same id + params renders the same picture, every time)
function mkParticles(n){{ const ps=[]; for(let i=0;i<n;i++) ps.push({{x:rnd(0,W),y:rnd(0,H),r:rnd(1,3.2)*D,rx:rnd(-0.4,0.4)*S,ry:rnd(-0.5,0.15)*S,a:rnd(0.25,0.9),c:COL[i%COL.length]}}); return ps; }}
// ---- stars ----
function mkStars(n){{ const st=[]; for(let i=0;i<n;i++) st.push({{x:rnd(0,W),y:rnd(0,H),r:rnd(0.4,1.8),tw:rnd(0.5,2)*S,ph:rnd(0,TAU),vx:rnd(-0.2,0.2)*S,vy:rnd(0.05,0.35)*S,c:COL[i%COL.length]}}); return st; }}
// ---- matrix ----
function mkMatrix(n){{ const cols=[]; const cw=18; for(let x=0;x<W;x+=cw) cols.push({{x,y:rnd(-H,0),sp:rnd(0.35,1.4)*S,len:rnd(8,26)}}); return cols; }}
// ---- embers ----
function mkEmbers(n){{ const es=[]; for(let i=0;i<n;i++) es.push({{x:rnd(0,W),y:rnd(H*0.3,H),r:rnd(1,2.6)*D,vy:rnd(-0.8,-0.25)*S,vx:rnd(-0.25,0.25)*S,ph:rnd(0,TAU),c:COL[i%COL.length]}}); return es; }}
// A6.1 — new kinds
function mkRain(n){{ const rs=[]; for(let i=0;i<n;i++) rs.push({{x:rnd(0,W),y:rnd(-H,H),len:rnd(10,24)*D,sp:rnd(6,13)*S,c:COL[i%COL.length]}}); return rs; }}
function mkFireflies(n){{ const fs=[]; for(let i=0;i<n;i++) fs.push({{x:rnd(0,W),y:rnd(0,H),r:rnd(0.8,2.2)*D,ph:rnd(0,TAU),tw:rnd(0.5,1.6)*S,vx:rnd(-0.15,0.15)*S,vy:rnd(-0.1,0.1)*S,homex:rnd(0,W),homey:rnd(0,H),c:COL[i%COL.length]}}); return fs; }}
function mkSnow(n){{ const ss=[]; for(let i=0;i<n;i++) ss.push({{x:rnd(0,W),y:rnd(-H,0),r:rnd(0.8,2.6)*D,ph:rnd(0,TAU),tw:rnd(0.5,1.5)*S,vy:rnd(0.4,1.1)*S,c:COL[i%COL.length]}}); return ss; }}
function mkBokeh(n){{ const bs=[]; for(let i=0;i<n;i++) bs.push({{x:rnd(0,W),y:rnd(H*0.4,H),r:rnd(18,64)*D,vy:rnd(-0.25,-0.08)*S,vx:rnd(-0.1,0.1)*S,ph:rnd(0,TAU),a:rnd(0.05,0.14),c:COL[i%COL.length]}}); return bs; }}
function mkSmoke(n){{ const ms=[]; for(let i=0;i<n;i++) ms.push({{x:rnd(0,W),y:rnd(H*0.7,H),r:rnd(6,20)*D,vy:rnd(-0.5,-0.15)*S,vx:rnd(-0.2,0.2)*S,ph:rnd(0,TAU),life:rnd(0,1),c:COL[i%COL.length]}}); return ms; }}

let parts = mkParticles(Math.floor(90*D));
let stars = mkStars(Math.floor(220*D));
let mat = mkMatrix(0);
let embers = mkEmbers(Math.floor(70*D));
let rain = mkRain(Math.floor(110*D));
let fireflies = mkFireflies(Math.floor(26*D));
let snow = mkSnow(Math.floor(130*D));
let bokeh = mkBokeh(Math.floor(14*D));
let smoke = mkSmoke(Math.floor(18*D));

function drawParticles(){{
  ctx.clearRect(0,0,W,H);
  for(const p of parts){{
    p.x+=p.rx; p.y+=p.ry;
    if(p.y<-8){{p.y=H+8; p.x=rand(0,W);}}
    if(p.x<-8)p.x=W+8; if(p.x>W+8)p.x=-8;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,TAU);
    ctx.fillStyle=rgba(p.c,p.a); ctx.fill();
  }}
}}
function drawStars(){{
  ctx.clearRect(0,0,W,H);
  for(const s of stars){{
    s.x+=s.vx; s.y+=s.vy;
    if(s.y>H+4){{s.y=-4; s.x=rand(0,W);}}
    if(s.x<-4)s.x=W+4; if(s.x>W+4)s.x=-4;
    const tw=0.5+0.5*Math.sin(t*s.tw+s.ph);
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,TAU);
    ctx.fillStyle=rgba(s.c,0.35+0.65*tw); ctx.fill();
  }}
}}
function drawWaves(){{
  ctx.clearRect(0,0,W,H);
  const layers=3+Math.floor(D*2);
  for(let l=0;l<layers;l++){{
    const col=COL[l%COL.length];
    const amp=H*(0.05+0.03*l), base=H*(0.45+0.22*l), f=0.0016*(l+1)*S, ph=t*(0.02+0.008*l);
    ctx.beginPath(); ctx.moveTo(0,H);
    for(let x=0;x<=W;x+=8){{
      const y=base+Math.sin(x*f+ph)*amp+Math.sin(x*f*1.7+ph*1.3)*amp*0.4;
      ctx.lineTo(x,y);
    }}
    ctx.lineTo(W,H); ctx.closePath();
    ctx.fillStyle=rgba(col,0.28/(l+1)); ctx.fill();
  }}
}}
function drawGeometric(){{
  ctx.clearRect(0,0,W,H);
  const size=Math.max(60,120*D), gap=size*0.5;
  const off=t*0.05*S;
  for(let y=-size;y<H+size;y+=size+gap){{
    for(let x=-size;x<W+size;x+=size+gap){{
      const px=x+Math.sin(t*0.02*S+y*0.01)*gap*0.5;
      const py=y+Math.cos(t*0.02*S+x*0.01)*gap*0.5;
      const rot=t*0.05*S+((x+y)*0.0004);
      ctx.save(); ctx.translate(px+off,py); ctx.rotate(rot);
      const sides=3+((Math.round((x+y)/120)%3+3)%3);
      ctx.beginPath();
      for(let i=0;i<sides;i++){{
        const a=(i/sides)*TAU;
        const px2=Math.cos(a)*size*0.28, py2=Math.sin(a)*size*0.28;
        if(i===0)ctx.moveTo(px2,py2); else ctx.lineTo(px2,py2);
      }}
      ctx.closePath();
      ctx.strokeStyle=rgba(COL[(Math.round(x/120)+Math.round(y/120))%COL.length],0.35);
      ctx.lineWidth=1.5; ctx.stroke();
      ctx.restore();
    }}
  }}
}}
function drawAurora(){{
  const grad=ctx.createLinearGradient(0,0,0,H);
  grad.addColorStop(0,'#050816'); grad.addColorStop(1,'#0b1026');
  ctx.fillStyle=grad; ctx.fillRect(0,0,W,H);
  const blobs=3+Math.floor(D*2);
  for(let b=0;b<blobs;b++){{
    const col=COL[b%COL.length];
    const bx=W*0.2+b*(W*0.3)+Math.sin(t*0.004*S+b*2.1)*W*0.25;
    const by=H*(0.25+0.2*Math.sin(t*0.003*S+b));
    const r=Math.max(W,H)*(0.22+0.1*Math.sin(t*0.002*S+b*1.3));
    const g=ctx.createRadialGradient(bx,by,0,bx,by,r);
    g.addColorStop(0,rgba(col,0.16)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H);
  }}
  for(let i=0;i<60;i++){{
    const yy=H*(0.1+0.8*Math.random());
    ctx.fillStyle=rgba([226,232,240],0.5);
    ctx.fillRect(Math.random()*W,yy,1,1);
  }}
}}
function drawMatrix(){{
  ctx.fillStyle='rgba(4,8,20,0.22)'; ctx.fillRect(0,0,W,H);
  const chars='アイウエオカキクケコサシスセソタチツテト0123456789ABCDEF';
  for(const col of mat){{
    ctx.font='14px monospace';
    for(let i=0;i<col.len;i++){{
      const yy=col.y-i*16;
      if(yy<0||yy>H) continue;
      ctx.fillStyle=rgba(COL[i%COL.length],0.7-0.5*(i/col.len));
      ctx.fillText(chars[(Math.random()*chars.length)|0],col.x,yy);
    }}
    col.y+=col.sp;
    if(col.y>H+40){{col.y=-40; col.x=rand(0,W);}}
  }}
}}
function drawEmbers(){{
  ctx.fillStyle='#0c0a1d'; ctx.fillRect(0,0,W,H);
  for(const e of embers){{
    e.y+=e.vy; e.x+=e.vx+Math.sin(t*0.01+e.ph)*0.3;
    if(e.y<-10){{e.y=H+10; e.x=rand(0,W);}}
    const tw=0.6+0.4*Math.sin(t*0.02*S+e.ph);
    const g=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,e.r*3);
    g.addColorStop(0,rgba(e.c,0.8*tw)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(e.x,e.y,e.r*3,0,TAU); ctx.fill();
  }}
}}
function drawParallax(){{
  const layers=4+Math.floor(D*2);
  for(let l=0;l<layers;l++){{
    const col=COL[l%COL.length];
    const speed=(0.2+l*0.14)*S;
    const n=Math.floor(8+l*6*D);
    for(let i=0;i<n;i++){{
      const seed=(l*100+i)*13.37;
      const px=((seed*7919)%1000)/1000*W;
      const drift=((seed*104729)%2000)/1000;
      const x=px+(drift*W*0.3+Math.sin(t*speed*0.001+seed)*W*0.12)%(W*0.6);
      const size=(6+l*7)*(0.6+((seed*1543)%1000)/1000);
      ctx.beginPath(); ctx.arc(x,((seed*3571)%1000)/1000*H,size,0,TAU);
      ctx.fillStyle=rgba(col,0.16+l*0.05); ctx.fill();
    }}
  }}
}}
function drawRain(){{
  ctx.fillStyle='rgba(5,10,25,0.35)'; ctx.fillRect(0,0,W,H);
  ctx.lineCap='round';
  for(const r of rain){{
    const grad=ctx.createLinearGradient(r.x,r.y,r.x,r.y+r.len);
    grad.addColorStop(0,rgba(r.c,0.15)); grad.addColorStop(1,rgba(r.c,0.85));
    ctx.strokeStyle=grad; ctx.lineWidth=1.2;
    ctx.beginPath(); ctx.moveTo(r.x,r.y); ctx.lineTo(r.x,r.y+r.len); ctx.stroke();
    r.y+=r.sp;
    if(r.y>H+30){{r.y=-30; r.x=rnd(0,W); r.len=rnd(10,24)*D;}}
  }}
}}
function drawFireflies(){{
  ctx.fillStyle='#0a1220'; ctx.fillRect(0,0,W,H);
  for(const f of fireflies){{
    const a=0.25+0.65*(0.5+0.5*Math.sin(t*0.03*f.tw+f.ph));
    f.x+=(f.homex-f.x)*0.002*f.tw+f.vx; f.y+=(f.homey-f.y)*0.002*f.tw+f.vy;
    if(f.x<0)f.x=W; if(f.x>W)f.x=0; if(f.y<0)f.y=H; if(f.y>H)f.y=0;
    const g=ctx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r*4);
    g.addColorStop(0,rgba(f.c,a)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(f.x,f.y,f.r*4,0,TAU); ctx.fill();
  }}
}}
function drawSnow(){{
  ctx.clearRect(0,0,W,H);
  for(const s of snow){{
    s.x+=Math.sin(t*0.02*s.tw+s.ph)*0.6*S; s.y+=s.vy;
    if(s.y>H+6){{s.y=-6; s.x=rnd(0,W);}}
    if(s.x<-6)s.x=W+6; if(s.x>W+6)s.x=-6;
    ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,TAU);
    ctx.fillStyle=rgba(s.c,0.55+0.3*Math.sin(t*0.03*s.tw+s.ph)); ctx.fill();
  }}
}}
function drawBokeh(){{
  ctx.fillStyle='#070a18'; ctx.fillRect(0,0,W,H);
  for(const b of bokeh){{
    b.y+=b.vy; b.x+=b.vx+Math.sin(t*0.005+b.ph)*0.4;
    if(b.y<-80){{b.y=H+80; b.x=rnd(0,W);}}
    const g=ctx.createRadialGradient(b.x,b.y,0,b.x,b.y,b.r);
    g.addColorStop(0,rgba(b.c,b.a)); g.addColorStop(0.6,rgba(b.c,b.a*0.5)); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(b.x,b.y,b.r,0,TAU); ctx.fill();
  }}
}}
function drawSmoke(){{
  ctx.fillStyle='rgba(10,8,16,0.08)'; ctx.fillRect(0,0,W,H);
  for(const m of smoke){{
    m.life+=0.004*S; m.y+=m.vy; m.x+=m.vx+Math.sin(t*0.01+m.ph)*0.3;
    const grow=1+m.life*2;
    if(m.y<-60||m.life>2){{m.y=H+rnd(0,H*0.3); m.x=rnd(0,W); m.life=0; m.r=rnd(6,20)*D;}}
    const g=ctx.createRadialGradient(m.x,m.y,0,m.x,m.y,m.r*grow);
    g.addColorStop(0,rgba(m.c,0.16*(1-m.life/2.2))); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(m.x,m.y,m.r*grow,0,TAU); ctx.fill();
  }}
}}
function drawWaves3d(){{
  ctx.fillStyle='#04070f'; ctx.fillRect(0,0,W,H);
  const layers=5;
  for(let l=layers-1;l>=0;l--){{
    const depth=1-l/layers;
    const amp=H*(0.03+depth*0.09), base=H*(0.35+l*0.14), f=0.0018*(l+1)*S, ph=t*(0.02+0.01*l)+l*1.7;
    const col=COL[l%COL.length];
    ctx.beginPath(); ctx.moveTo(0,H);
    for(let x=-20;x<=W+20;x+=6){{
      const y=base+Math.sin(x*f+ph)*amp*(1+depth)+Math.sin(x*f*1.6+ph*1.4)*amp*0.35;
      ctx.lineTo(x,y);
    }}
    ctx.lineTo(W,H); ctx.closePath();
    ctx.fillStyle=rgba(col,0.1+depth*0.22); ctx.fill();
  }}
}}

// A6.3 — perf discipline: pause when the tab is hidden (wallpaper window is
// occluded by the desktop shell, but the webview may still tick); cap the
// frame rate to ~20fps when the document is hidden to save GPU.
let lastFrame = 0;
const FPS_CAP = 60, HIDDEN_CAP = 20;
document.addEventListener('visibilitychange', ()=>{{ paused = document.hidden; }});
document.addEventListener('webkitvisibilitychange', ()=>{{ paused = document.hidden; }});

function drawScene(){{
  t++;
  switch(CFG.kind){{
    case 'particles': drawParticles(); break;
    case 'waves': drawWaves(); break;
    case 'geometric': drawGeometric(); break;
    case 'parallax': drawParallax(); break;
    case 'aurora': drawAurora(); break;
    case 'stars': drawStars(); break;
    case 'matrix': drawMatrix(); break;
    case 'embers': drawEmbers(); break;
    case 'rain': drawRain(); break;
    case 'fireflies': drawFireflies(); break;
    case 'snowfall-wind': drawSnow(); break;
    case 'bokeh': drawBokeh(); break;
    case 'smoke': drawSmoke(); break;
    case 'waves-3d': drawWaves3d(); break;
  }}
}}
function frame(ts){{
  // S13.2 — Win11 motion spec: with prefers-reduced-motion on, the scene
  // renders exactly one static frame and the rAF loop stops (no GPU burn).
  if(REDUCED){{ drawScene(); return; }}
  if(paused){{
    // frozen/fullscreen/hidden — don't burn GPU; wake up on a slow timer so a
    // resume via __setPaused picks the loop back up within ~half a second
    setTimeout(()=>requestAnimationFrame(frame), 500);
    return;
  }}
  const cap = document.hidden ? HIDDEN_CAP : FPS_CAP;
  if(ts-lastFrame < 1000/cap){{ requestAnimationFrame(frame); return; }}
  lastFrame = ts;
  drawScene();
  requestAnimationFrame(frame);
}}
requestAnimationFrame(frame);
</script></body></html>"#,
        cfg_json
    )
}

/// Build a 2s crossfade document for scene→scene switches (E4.7). The old
/// scene is re-rendered deterministically (A6.2 seeded) on canvas c0 while
/// the new one fades in on c1 — a genuine crossfade, not a fade from black.
/// `prefers-reduced-motion: reduce` skips the fade entirely.
pub fn scene_html_transition(from: &SceneConfig, to: &SceneConfig) -> String {
    fn script_body(html: &str) -> String {
        let s = html
            .find("<script>")
            .map(|i| i + "<script>".len())
            .unwrap_or(0);
        let e = html.find("</script>").unwrap_or(html.len());
        html[s..e].to_string()
    }
    let from_script =
        script_body(&scene_html(from)).replace("getElementById('c')", "getElementById('c0')");
    let to_script =
        script_body(&scene_html(to)).replace("getElementById('c')", "getElementById('c1')");
    format!(
        r#"<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;padding:0;overflow:hidden;background:#0b1026;width:100%;height:100%}}
canvas{{display:block;position:absolute;inset:0;width:100vw;height:100vh}}
</style></head><body>
<canvas id="c0"></canvas><canvas id="c1" style="opacity:0"></canvas>
<script>(function(){{ {from_script} }})();</script>
<script>(function(){{ {to_script} }})();</script>
<script>
(function(){{
  const c0 = document.getElementById('c0'), c1 = document.getElementById('c1');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {{ c1.style.opacity = 1; c0.remove(); return; }}
  c1.style.transition = 'opacity 2000ms ease';
  requestAnimationFrame(() => requestAnimationFrame(() => {{ c1.style.opacity = 1; }}));
  setTimeout(() => c0.remove(), 2100);
}})();
</script>
</body></html>"#,
        from_script = from_script,
        to_script = to_script,
    )
}

#[cfg(test)]
mod tests {
    use super::super::scenes::default_scene;
    use super::*;

    #[test]
    fn scene_html_escapes_hostile_config() {
        let mut scene = default_scene();
        scene.kind = "</script><script>alert(1)</script>".into();
        scene.colors = vec!["#fff\"></script><script>alert(2)</script>".into()];
        let html = scene_html(&scene);
        assert!(
            !html.contains("</script><script>alert"),
            "scene config must not close the inline script block"
        );
        assert!(
            html.contains("\\u003C/script\\u003E"),
            "kind must be \\u-escaped in the embedded JSON"
        );
    }

    #[test]
    fn scene_html_embeds_config_json() {
        let html = scene_html(&default_scene());
        assert!(
            html.contains("\"kind\":\"aurora\""),
            "config JSON must be embedded"
        );
        assert!(html.contains("<canvas id=\"c\"></canvas>"));
    }

    // ---- S13.2: reduced-motion freezes the scene ----

    #[test]
    fn scene_html_freezes_under_reduced_motion() {
        let html = scene_html(&default_scene());
        assert!(
            html.contains(
                "const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;"
            ),
            "the scene must read the OS reduced-motion setting"
        );
        assert!(
            html.contains("if(REDUCED){ drawScene(); return; }"),
            "reduced motion renders one static frame and stops the rAF loop"
        );
    }

    // ---- E4.7: animated transitions ----

    #[test]
    fn transition_html_has_two_stacked_canvases() {
        let to = default_scene();
        let mut from = default_scene();
        from.id = "from-scene".into();
        from.kind = "matrix".into();
        let html = scene_html_transition(&from, &to);
        assert!(html.contains("<canvas id=\"c0\">"), "old scene on c0");
        assert!(
            html.contains("<canvas id=\"c1\" style=\"opacity:0\">"),
            "new scene fades in on c1"
        );
        assert!(
            html.contains("getElementById('c0')"),
            "old scene script targets c0"
        );
        assert!(
            html.contains("getElementById('c1')"),
            "new scene script targets c1"
        );
        assert!(
            html.contains("\"kind\":\"matrix\""),
            "old scene cfg embedded"
        );
        assert!(
            html.contains("\"kind\":\"aurora\""),
            "new scene cfg embedded"
        );
    }

    #[test]
    fn transition_respects_reduced_motion() {
        let html = scene_html_transition(&default_scene(), &default_scene());
        assert!(
            html.contains("prefers-reduced-motion: reduce"),
            "the html must check the OS reduced-motion setting"
        );
        assert!(
            html.contains("if (reduce)"),
            "reduced motion skips the 2s fade (instant swap)"
        );
        assert!(html.contains("2000ms"), "full motion crossfades over 2s");
    }

    #[test]
    fn transition_does_not_escape_hostile_configs() {
        let mut evil = default_scene();
        evil.kind = "</script><script>alert(1)</script>".into();
        let html = scene_html_transition(&evil, &default_scene());
        assert!(
            !html.contains("</script><script>alert"),
            "transition embeds both configs \\u-escaped (S3.6 hardening)"
        );
    }
}
