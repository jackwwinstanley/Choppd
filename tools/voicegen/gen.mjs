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
function toMp3(f32, sr){ const i16=new Int16Array(f32.length); for(let i=0;i<f32.length;i++){const s=Math.max(-1,Math.min(1,f32[i]));i16[i]=s<0?s*0x8000:s*0x7FFF;} const enc=new lamejs.Mp3Encoder(1,sr,64); const ch=[]; const bs=1152; for(let i=0;i<i16.length;i+=bs){const b=enc.encodeBuffer(i16.subarray(i,i+bs)); if(b.length)ch.push(Buffer.from(b));} const e=enc.flush(); if(e.length)ch.push(Buffer.from(e)); return Buffer.concat(ch); }

const data = JSON.parse(fs.readFileSync("voice-lines.json","utf8"));
const lines = data.lines || data;
console.log(`voice=${VOICE}  lines=${lines.length}  force=${FORCE}  out=${OUT}`);
const tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", { dtype:"q8", device:"cpu" });
const manifest = {}; let gen=0, skip=0, total=0;
for (const text of lines) {
  const h = voiceHash(text); manifest[h] = text; const fp = path.join(OUT, h + ".mp3");
  if (!FORCE && fs.existsSync(fp)) { skip++; total += fs.statSync(fp).size; }
  else { const audio = await tts.generate(text, { voice: VOICE }); const mp3 = toMp3(audio.audio, audio.sampling_rate); fs.writeFileSync(fp, mp3); gen++; total += mp3.length; }
  process.stdout.write(`\r  ${gen+skip}/${lines.length}  generated=${gen} skipped=${skip}   `);
}
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest));
console.log(`\nDone. generated=${gen} skipped=${skip} total=${lines.length} files, ${Math.round(total/1024)} KB (${(total/1048576).toFixed(2)} MB)`);
