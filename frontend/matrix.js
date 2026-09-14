/* Dot Matrix — vanilla WebGL2 adaptation of the supplied Originkit shaders. */
(() => {
  "use strict";
const perlinVertexShader = `#version 300 es
in vec2 uv;
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0., 1.);
}`;
const perlinFragmentShader = `#version 300 es
precision highp float;
uniform float uFrequency;
uniform float uTime;
uniform float uSpeed;
uniform float uValue;
uniform vec2 uResolution;
in vec2 vUv;
out vec4 fragColor;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
  float n_ = 0.142857142857;
  vec3  ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3) ) );
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  uv = (uv - 0.5) * vec2(aspect, 1.0) + 0.5;
  float hue = abs(snoise(vec3(uv * uFrequency, uTime * uSpeed)));
  vec3 rainbowColor = hsv2rgb(vec3(hue, 1.0, uValue));
  fragColor = vec4(rainbowColor, 1.0);
}`;
const dotFragmentShader = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform sampler2D uTexture;
uniform int uPaletteCount;
uniform vec3 uPalette[10];
uniform float uPaletteA[10];
uniform float uCellSize;
uniform float uGamma;
uniform float uPaletteBias;
uniform int uUseGlyphAtlas;
uniform sampler2D uGlyphAtlas;
uniform ivec2 uGlyphGrid;
uniform int uCharCount;
uniform float uHouse;
out vec4 fragColor;

void main() {
  vec2 pix = gl_FragCoord.xy;
  float cell = max(uCellSize, 1.0);

  vec2 cellIdx = floor(pix / cell);
  vec2 cellCenter = (cellIdx + 0.5) * cell;
  vec3 col = texture(uTexture, cellCenter / uResolution.xy).rgb;
  float gray = 0.3 * col.r + 0.59 * col.g + 0.11 * col.b;
  gray = pow(clamp(gray, 0.0001, 1.0), uGamma);

  float mark = 0.0;
  if (uUseGlyphAtlas == 1 && uCharCount > 0 && uGlyphGrid.x > 0 && uGlyphGrid.y > 0) {
    float g = clamp(gray + uPaletteBias, 0.0, 1.0);
    int idx = int(clamp(floor(g * float(uCharCount - 1) + 0.5), 0.0, float(uCharCount - 1)));
    vec2 cellUV = fract(pix / cell);
    vec2 grid = vec2(uGlyphGrid);
    vec2 tileSize = 1.0 / grid;
    float colIdx = float(idx % uGlyphGrid.x);
    float rowIdx = floor(float(idx) / float(uGlyphGrid.x));
    vec2 atlasUV = (vec2(colIdx, rowIdx) + cellUV) * tileSize;
    vec3 glyphSample = texture(uGlyphAtlas, atlasUV).rgb;
    mark = dot(glyphSample, vec3(0.299, 0.587, 0.114));
  } else {
    vec2 cellUV = fract(pix / cell) - 0.5;
    float dist = length(cellUV);
    float radius = clamp(gray + uPaletteBias, 0.0, 1.0) * 0.5;
    float aa = fwidth(dist) + 1e-4;
    mark = 1.0 - smoothstep(radius - aa, radius + aa, dist);
  }

  float g2 = clamp(gray + uPaletteBias, 0.0, 1.0);
  int cnt = max(uPaletteCount, 1);
  vec3 dotCol;
  float dotOpacity;
  if (cnt <= 1) {
    dotCol = uPalette[0];
    dotOpacity = uPaletteA[0];
  } else {
    float scaled = g2 * float(cnt - 1);
    int i0 = int(floor(scaled));
    i0 = clamp(i0, 0, cnt - 2);
    float f = scaled - float(i0);
    dotCol = mix(uPalette[i0], uPalette[i0 + 1], f);
    dotOpacity = mix(uPaletteA[i0], uPaletteA[i0 + 1], f);
  }
  vec2 p = (cellCenter / uResolution - 0.5) * vec2(uResolution.x / uResolution.y, 1.0);
  float walls = step(abs(p.x), 0.24) * step(-0.28, p.y) * step(p.y, 0.08);
  float roof = step(0.08, p.y) * step(p.y, 0.34 - abs(p.x) * 0.9);
  float door = step(abs(p.x), 0.055) * step(p.y, -0.08) * step(-0.28, p.y);
  float house = clamp(walls + roof - door, 0.0, 1.0);
  fragColor = vec4(dotCol, mark * dotOpacity * mix(1.0, house, uHouse));
}`;
const instances = new Map();
const palette = new Float32Array([1,.78,.55, 1,.39,.045, .88,.14,.025, ...Array(21).fill(0)]);
const alpha = new Float32Array([.22,.8,1,...Array(7).fill(0)]);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
function activeScreen(canvas) {
  return document.body.classList.contains('auth-locked') === !!canvas.closest('.auth-screen');
}
// Keep the moving dot field available when WebGL is unsupported or loses its context.
function createFallback(canvas) {
  const ctx=canvas.getContext('2d');
  if(!ctx) return null;
  let frame=0, previous=0, elapsed=0, visible=false, disposed=false;
  const canRun=()=>visible && !disposed && !document.hidden && activeScreen(canvas) && !reduced.matches && window.DskMotion?.enabled!==false;
  function draw(delta=0) {
    if(disposed) return;
    elapsed+=delta;
    if(canvas.hasAttribute('data-matrix-once') && elapsed>=1.35) {dispose();return;}
    ctx.clearRect(0,0,canvas.width,canvas.height);
    const step=Math.max(7,canvas.width/Math.max(1,canvas.clientWidth)*11);
    for(let y=step/2;y<canvas.height;y+=step) for(let x=step/2;x<canvas.width;x+=step) {
      const u=x/Math.max(1,canvas.height), v=y/Math.max(1,canvas.height);
      const wave=(Math.sin(u*5+Math.sin(v*4+elapsed*.35)+elapsed*.3)+Math.sin(v*7-u*3-elapsed*.45)+2)/4;
      if(canvas.dataset.matrix==='proposal') {
        const px=(x-canvas.width/2)/canvas.height, py=.5-v;
        if(!(Math.abs(px)<.24 && py>-.28 && py<.08 || py>=.08 && py<.34-Math.abs(px)*.9)) continue;
      }
      ctx.fillStyle=`rgba(245,${Math.round(135-wave*65)},35,${.2+wave*.8})`;
      ctx.beginPath();ctx.arc(x,y,step*(.08+wave*.39),0,Math.PI*2);ctx.fill();
    }
    canvas.classList.add('matrix-ready');
  }
  function tick(time) {
    frame=0;if(!canRun()){previous=0;return;}
    if(!previous || time-previous>=1000/24) {draw(previous?Math.min((time-previous)/1000,.08):0);previous=time;}
    if(!disposed) frame=requestAnimationFrame(tick);
  }
  function sync(){if(disposed)return;cancelAnimationFrame(frame);previous=0;draw();frame=canRun()?requestAnimationFrame(tick):0;}
  function resize(){const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;const ratio=Math.min(devicePixelRatio||1,1,900/r.width);canvas.width=Math.round(r.width*ratio);canvas.height=Math.round(r.height*ratio);sync();}
  function dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();resizeObserver.disconnect();}
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();});observer.observe(canvas);
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(canvas);
  resize();return {sync,dispose};
}
function useFallback(canvas) {
  // A canvas cannot switch from a WebGL context to a 2D context.
  const replacement=canvas.cloneNode(false);
  replacement.classList.remove('matrix-ready');
  canvas.replaceWith(replacement);
  instances.delete(canvas);
  const instance=createFallback(replacement);
  if(instance) instances.set(replacement,instance);
}
function create(canvas) {
  let gl;
  try { gl=canvas.getContext('webgl2', { alpha:true, antialias:false, premultipliedAlpha:false, depth:false }); }
  catch { return null; }
  if (!gl) return null;
  const programs=[], shaders=[], buffers=[], textures=[];
  let target, frame=0, previous=0, elapsed=0, visible=false, disposed=false, house=0, tone=0;
  function dispose() {
    disposed=true; cancelAnimationFrame(frame); observer?.disconnect(); resizeObserver?.disconnect();
    programs.forEach(p=>gl.deleteProgram(p)); shaders.forEach(s=>gl.deleteShader(s));
    buffers.forEach(b=>gl.deleteBuffer(b)); textures.forEach(t=>gl.deleteTexture(t));
    if(target) gl.deleteFramebuffer(target);
    canvas.removeEventListener('webglcontextlost', lost);
    canvas.classList.remove('matrix-ready');
    if(!gl.isContextLost()) gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  let observer, resizeObserver;
  function program(fragment) {
    const p=gl.createProgram(); programs.push(p);
    for(const [kind,source] of [[gl.VERTEX_SHADER,perlinVertexShader],[gl.FRAGMENT_SHADER,fragment]]) {
      const shader=gl.createShader(kind); shaders.push(shader); gl.shaderSource(shader,source); gl.compileShader(shader);
      if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)) throw new Error('Matrix shader unavailable');
      gl.attachShader(p,shader);
    }
    gl.linkProgram(p); if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error('Matrix program unavailable');
    return {p, u: name=>gl.getUniformLocation(p,name)};
  }
  function lost(event) { event.preventDefault(); dispose(); if(canvas.isConnected) useFallback(canvas); }
  try {
    const noise=program(perlinFragmentShader), dots=program(dotFragmentShader);
    const buffer=gl.createBuffer(); buffers.push(buffer); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const texture=gl.createTexture(); textures.push(texture); gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    target=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,target);
    gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
    // Separate sampler for the unused glyph atlas avoids texture feedback.
    const dummy=gl.createTexture(); textures.push(dummy); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,dummy);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([0,0,0,255]));
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    const use = obj => {
      gl.useProgram(obj.p); gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
      const position=gl.getAttribLocation(obj.p,'position'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
      const uv=gl.getAttribLocation(obj.p,'uv');
      if(uv>=0) { // Vertex shader maps clip coordinates to UV below.
        gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv,2,gl.FLOAT,false,0,0);
      }
    };
    function draw(delta=0) {
      if(disposed || !canvas.width || !canvas.height) return;
      elapsed+=delta;
      if(canvas.hasAttribute('data-matrix-once') && elapsed>=1.35) { dispose(); return; }
      const active = canvas.closest('[data-matrix-tone]')?.dataset.matrixTone === 'risk' ? 1 : 0;
      tone+=(active-tone)*.08;
      const targetHouse=canvas.dataset.matrix==='proposal' ? 1 : 0;
      house=window.DskMotion?.enabled===false ? targetHouse : Math.min(targetHouse,house+delta*1.8);
      gl.viewport(0,0,canvas.width,canvas.height); gl.disable(gl.BLEND);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,target); use(noise);
      gl.uniform2f(noise.u('uResolution'),canvas.width,canvas.height);
      gl.uniform1f(noise.u('uTime'),elapsed); gl.uniform1f(noise.u('uSpeed'),.12+tone*.05);
      gl.uniform1f(noise.u('uFrequency'),.8+tone*.4); gl.uniform1f(noise.u('uValue'),1);
      gl.drawArrays(gl.TRIANGLES,0,6);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null); use(dots); gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.uniform1i(dots.u('uTexture'),0); gl.uniform1i(dots.u('uGlyphAtlas'),1);
      gl.uniform2f(dots.u('uResolution'),canvas.width,canvas.height);
      gl.uniform1i(dots.u('uPaletteCount'),3); gl.uniform3fv(dots.u('uPalette[0]'),palette); gl.uniform1fv(dots.u('uPaletteA[0]'),alpha);
      gl.uniform1f(dots.u('uCellSize'),Math.max(6,canvas.width/canvas.clientWidth*11));
      gl.uniform1f(dots.u('uGamma'),1.9-tone*.4); gl.uniform1f(dots.u('uPaletteBias'),.14);
      gl.uniform1i(dots.u('uUseGlyphAtlas'),0); gl.uniform1f(dots.u('uHouse'),house);
      gl.drawArrays(gl.TRIANGLES,0,6); canvas.classList.add('matrix-ready');
    }
    function canRun() { return visible && !disposed && !document.hidden && activeScreen(canvas) && !reduced.matches && window.DskMotion?.enabled!==false; }
    function tick(time) {
      frame=0; if(disposed || !canRun()) { previous=0; return; }
      if(!previous || time-previous>=1000/30) { draw(previous ? Math.min((time-previous)/1000,.06) : 0); previous=time; }
      if(!disposed) frame=requestAnimationFrame(tick);
    }
    function sync() { if(disposed) return; cancelAnimationFrame(frame); frame=0; previous=0; draw(); if(canRun()) frame=requestAnimationFrame(tick); }
    function resize() {
      const r=canvas.getBoundingClientRect(), ratio=Math.min(devicePixelRatio||1,1.5,1100/Math.max(1,r.width));
      if(!r.width || !r.height) return;
      canvas.width=Math.max(1,Math.round(r.width*ratio)); canvas.height=Math.max(1,Math.round(r.height*ratio));
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,texture);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,canvas.width,canvas.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.bindFramebuffer(gl.FRAMEBUFFER,target);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE) { lost({preventDefault(){}}); return; }
      sync();
    }
    observer=new IntersectionObserver(entries=>{ visible=entries[0].isIntersecting; sync(); }); observer.observe(canvas);
    resizeObserver=new ResizeObserver(resize); resizeObserver.observe(canvas);
    canvas.addEventListener('webglcontextlost',lost);
    resize(); return disposed ? null : {dispose,sync};
  } catch { dispose(); return null; }
}
function mount() {
  for(const [canvas,instance] of instances) if(!canvas.isConnected || (canvas.closest('dialog') && !canvas.closest('dialog').open)) { instance.dispose(); instances.delete(canvas); delete canvas.dataset.attempted; }
  // Mount immediately: the CSS field is already moving while the renderer starts.
  document.querySelectorAll('canvas[data-matrix]').forEach(canvas=>{
    if(canvas.closest('dialog') && !canvas.closest('dialog').open) return;
    if(!instances.has(canvas) && !canvas.dataset.attempted) { canvas.dataset.attempted='true'; const instance=create(canvas); if(instance) instances.set(canvas,instance); else if(canvas.isConnected) useFallback(canvas); }
  });
}
function sync() { instances.forEach(instance=>instance.sync()); }
document.getElementById('dialog')?.addEventListener('close',mount);
document.addEventListener('visibilitychange',sync); reduced.addEventListener('change',sync);
new MutationObserver(sync).observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
window.DskMatrix={mount,sync};
mount();
})();
