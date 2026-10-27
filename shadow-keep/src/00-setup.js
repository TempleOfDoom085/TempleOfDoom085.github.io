const W = 256,
  H = 192,
  T = 16,
  COLS = 16,
  ROWS = 11,
  HUD = 16,
  PH = ROWS * T;
let cv = document.getElementById("game");
const src = document.createElement("canvas");
src.width = W;
src.height = H;
let g = src.getContext("2d");
g.imageSmoothingEnabled = false;
let gl = null,
  glU = {},
  c2 = null;
function useFallback() {
  if (gl) {
    const n = document.createElement("canvas");
    n.id = "game";
    n.setAttribute("aria-label", "Shadow Keep game screen");
    cv.replaceWith(n);
    cv = n;
    gl = null;
  }
  cv.width = W;
  cv.height = H;
  c2 = cv.getContext("2d");
  c2.imageSmoothingEnabled = false;
}
(function initGL() {
  try {
    gl = cv.getContext("webgl", { antialias: false, alpha: false, premultipliedAlpha: false });
  } catch (e) {
    gl = null;
  }
  if (!gl) {
    useFallback();
    return;
  }
  const VS = "attribute vec2 a;varying vec2 uv;void main(){uv=a*.5+.5;gl_Position=vec4(a,0.,1.);}";
  const FS = `precision mediump float;uniform sampler2D t;uniform float time,ab,crt,heat,bloom;varying vec2 uv;
 vec2 curve(vec2 p){p=p*2.-1.;vec2 o=abs(p.yx)/vec2(6.,5.);p=p+p*o*o;return p*.5+.5;}
 vec3 smp(vec2 p){return texture2D(t,p).rgb;}
 void main(){vec2 p=uv;if(crt>.5)p=curve(uv);
if(p.x<0.||p.x>1.||p.y<0.||p.y>1.){gl_FragColor=vec4(0.,0.,0.,1.);return;}
if(heat>.5&&p.y<.92)p.x+=sin(p.y*80.+time*5.)*.0018;
float a=ab*.004+(crt>.5?.0007:0.);
vec3 c=vec3(smp(p+vec2(a,0.)).r,smp(p).g,smp(p-vec2(a,0.)).b);
vec3 b=vec3(0.);vec2 px=vec2(1./256.,1./192.);
for(int i=-2;i<=2;i++)for(int j=-2;j<=2;j++){vec3 s=smp(p+vec2(float(i),float(j))*px*1.6);b+=max(s-.72,0.);}
c+=b/25.*bloom*1.5;
if(crt>.5){float sl=sin(p.y*192.*6.2832)*.5+.5;c*=.84+.16*sl;float v=16.*p.x*p.y*(1.-p.x)*(1.-p.y);c*=pow(v,.2);}
gl_FragColor=vec4(c,1.);}`;
  try {
    const sh = (ty, code) => {
      const o = gl.createShader(ty);
      gl.shaderSource(o, code);
      gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error("shader");
      return o;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error("link");
    gl.useProgram(pr);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    [
      [gl.TEXTURE_MIN_FILTER, gl.NEAREST],
      [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
      [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE],
      [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE],
    ].forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    ["time", "ab", "crt", "heat", "bloom"].forEach((n) => (glU[n] = gl.getUniformLocation(pr, n)));
    cv.width = 1024;
    cv.height = 768;
    gl.viewport(0, 0, 1024, 768);
  } catch (e) {
    useFallback();
  }
})();
function heatOn() {
  return !["title", "intro", "win", "vendor"].includes(S.mode) && room().theme === "arena";
}
function present() {
  if (gl) {
    try {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.uniform1f(glU.time, S.frame / 60);
      gl.uniform1f(glU.ab, calm ? 0 : Math.min(2, S.ab || 0));
      gl.uniform1f(glU.crt, crtOn ? 1 : 0);
      gl.uniform1f(glU.heat, heatOn() ? 1 : 0);
      gl.uniform1f(glU.bloom, 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } catch (e) {
      useFallback();
    }
  }
  if (!gl && c2) c2.drawImage(src, 0, 0);
}
const xrBtn = document.getElementById("xrBtn");
const F8 = '8px "Press Start 2P", monospace',
  F16 = '16px "Press Start 2P", monospace',
  F24 = '24px "Press Start 2P", monospace';
