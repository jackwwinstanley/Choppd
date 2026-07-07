// Generate cue voiceover MP3s with Kokoro. Re-runnable: default skips existing
// (unchanged lines keep their hash → skipped; edited/new lines → new hash → generated).
// Flags: --voice=am_michael (default), --force (regenerate all).
// Reads voice-lines.json (produced by the app's __voiceLines collector).
import fs from "node:fs";
import path from "node:path";
import lamejs from "@breezystack/lamejs";
import { KokoroTTS } from "kokoro-js";

const arg = (p, d) => { const a = process.argv.find(x => x.startsWith(p+"=")); return a ? a.split("=")[1] : d; };
const VOICE = arg("--voice", "am_michael");
const FORCE = process.argv.includes("--force");
const OUT = path.resolve(process.cwd(), "../../mvp/audio/voice/" + VOICE);
fs.mkdirSync(OUT, { recursive: true });

// cyrb53 — MUST stay byte-identical to voiceHash() in mvp/app.js
function voiceHash(str){ let h1=0xdeadbeef,h2=0x41c6ce57; for(let i=0,ch;i<str.length;i++){ch=str.charCodeAt(i);h1=Math.imul(h1^ch,2654435761);h2=Math.imul(h2^ch,1597334677);} h1=Math.imul(h1^(h1>>>16),2246822507);h1^=Math.imul(h2^(h2>>>13),3266489909); h2=Math.imul(h2^(h2>>>16),2246822507);h2^=Math.imul(h1^(h1>>>13),3266489909); return (4294967296*(2097151&h2)+(h1>>>0)).toString(36); }
// ---- loudness normalization (Rule 5, 2026-07-07): every clip lands at ≈ -16 LUFS ----
// BS.1770 K-weighted integrated loudness (mono), gain applied on the raw float32
// before encoding; sample-peak ceiling -1.5 dBFS. Permanent for all future clips.
const TARGET_LUFS = -16;
function kFilters(fs){
  let f0=1681.9744509555319, G=3.99984385397, Q=0.7071752369554193;
  let K=Math.tan(Math.PI*f0/fs), Vh=Math.pow(10,G/20), Vb=Math.pow(Vh,0.499666774155);
  const a0=1+K/Q+K*K;
  const b1=[(Vh+Vb*K/Q+K*K)/a0, 2*(K*K-Vh)/a0, (Vh-Vb*K/Q+K*K)/a0];
  const a1=[1, 2*(K*K-1)/a0, (1-K/Q+K*K)/a0];
  f0=38.13547087613982; Q=0.5003270373253953; K=Math.tan(Math.PI*f0/fs);
  const a2d=1+K/Q+K*K;
  const a2=[1, 2*(K*K-1)/a2d, (1-K/Q+K*K)/a2d];
  const b2=[1,-2,1];
  return [[b1,a1],[b2,a2]];
}
function biquad(x,[b,a]){ const y=new Float64Array(x.length); let x1=0,x2=0,y1=0,y2=0;
  for(let i=0;i<x.length;i++){ const xi=x[i]; const yi=b[0]*xi+b[1]*x1+b[2]*x2-a[1]*y1-a[2]*y2; x2=x1;x1=xi;y2=y1;y1=yi;y[i]=yi; } return y; }
function integratedLufs(f32, fs){
  const [s1,s2]=kFilters(fs); const y=biquad(biquad(f32,s1),s2);
  const bs=Math.round(0.4*fs), hop=Math.round(0.1*fs); const blocks=[];
  for(let st=0; st+bs<=y.length; st+=hop){ let ms=0; for(let i=st;i<st+bs;i++) ms+=y[i]*y[i]; blocks.push(ms/bs); }
  if(!blocks.length){ let ms=0; for(let i=0;i<y.length;i++) ms+=y[i]*y[i]; blocks.push(ms/Math.max(1,y.length)); }
  const lk=blocks.map(ms=>ms>0?-0.691+10*Math.log10(ms):-200);
  const abs=blocks.filter((_,i)=>lk[i]>-70);
  if(!abs.length) return -70;
  const ref=-0.691+10*Math.log10(abs.reduce((a,b)=>a+b,0)/abs.length)-10;
  const rel=blocks.filter((_,i)=>lk[i]>ref);
  const use=rel.length?rel:abs;
  return -0.691+10*Math.log10(use.reduce((a,b)=>a+b,0)/use.length);
}
function normalize(f32, sr){
  const lufs=integratedLufs(f32,sr);
  const gain=Math.pow(10,(TARGET_LUFS-lufs)/20);
  // full gain to target, then a soft-knee limiter absorbs the peaks (speech
  // crest factor otherwise clamps the gain ~5 dB short of target — measured).
  const T=0.80, CEIL=0.94;                               // knee start, absolute ceiling (≈-0.54 dBFS)
  const out=new Float32Array(f32.length);
  for(let i=0;i<f32.length;i++){
    const x=f32[i]*gain, ax=Math.abs(x);
    out[i] = ax<=T ? x : Math.sign(x)*(T+(CEIL-T)*Math.tanh((ax-T)/(CEIL-T)));
  }
  return { out, from:lufs.toFixed(1), gainDb:(20*Math.log10(gain)).toFixed(1) };
}
function toMp3(f32, sr){ const i16=new Int16Array(f32.length); for(let i=0;i<f32.length;i++){const s=Math.max(-1,Math.min(1,f32[i]));i16[i]=s<0?s*0x8000:s*0x7FFF;} const enc=new lamejs.Mp3Encoder(1,sr,64); const ch=[]; const bs=1152; for(let i=0;i<i16.length;i+=bs){const b=enc.encodeBuffer(i16.subarray(i,i+bs)); if(b.length)ch.push(Buffer.from(b));} const e=enc.flush(); if(e.length)ch.push(Buffer.from(e)); return Buffer.concat(ch); }

const data = JSON.parse(fs.readFileSync("voice-lines.json","utf8"));
const lines = data.lines || data;
console.log(`voice=${VOICE}  lines=${lines.length}  force=${FORCE}  out=${OUT}`);
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype:"q8", device:"cpu" });
const manifest = {}; let gen=0, skip=0, total=0;
for (const text of lines) {
  const h = voiceHash(text); manifest[h] = text; const fp = path.join(OUT, h + ".mp3");
  if (!FORCE && fs.existsSync(fp)) { skip++; total += fs.statSync(fp).size; }
  else { const audio = await tts.generate(text, { voice: VOICE }); const norm = normalize(audio.audio, audio.sampling_rate); const mp3 = toMp3(norm.out, audio.sampling_rate); fs.writeFileSync(fp, mp3); gen++; total += mp3.length; }
  process.stdout.write(`\r  ${gen+skip}/${lines.length}  generated=${gen} skipped=${skip}   `);
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest));
console.log(`\nDone. generated=${gen} skipped=${skip} total=${lines.length} files, ${Math.round(total/1024)} KB (${(total/1048576).toFixed(2)} MB)`);
