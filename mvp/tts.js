/* ============================================================
   Kokoro TTS — open-source, on-device neural voice.
   Runs the Kokoro-82M model fully in the browser via kokoro-js
   (https://github.com/hexgrad/kokoro). No API key, no server,
   no third-party site — the model itself runs locally.
   Exposes window.Kokoro for the (classic-script) app.js.
   ============================================================ */
(function () {
  "use strict";

  const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";
  // jsDelivr first, esm.sh as a fallback CDN
  const CDNS = [
    "https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1/+esm",
    "https://esm.sh/kokoro-js@1.2.1",
  ];

  // a curated subset of Kokoro's voices (id -> friendly label)
  const VOICES = [
    { id: "af_heart",    label: "Heart · US female (warm)" },
    { id: "af_bella",    label: "Bella · US female" },
    { id: "af_nicole",   label: "Nicole · US female (soft)" },
    { id: "af_sky",      label: "Sky · US female (bright)" },
    { id: "am_michael",  label: "Michael · US male" },
    { id: "am_adam",     label: "Adam · US male" },
    { id: "bf_emma",     label: "Emma · UK female" },
    { id: "bm_george",   label: "George · UK male" },
  ];

  let ttsPromise = null;   // in-flight load
  let tts = null;          // ready model

  async function importKokoro() {
    let lastErr;
    for (const url of CDNS) {
      try { return await import(/* @vite-ignore */ url); }
      catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("kokoro-js import failed");
  }

  async function pickDevice() {
    if (navigator.gpu) {
      try { const a = await navigator.gpu.requestAdapter(); if (a) return "webgpu"; } catch (e) {}
    }
    return "wasm";
  }

  async function load(onProgress) {
    if (tts) return tts;
    if (!ttsPromise) {
      ttsPromise = (async () => {
        const { KokoroTTS } = await importKokoro();
        const device = await pickDevice();
        const dtype = device === "webgpu" ? "fp32" : "q8"; // q8 = small/fast on CPU
        tts = await KokoroTTS.from_pretrained(MODEL_ID, {
          dtype, device,
          progress_callback: onProgress || undefined,
        });
        return tts;
      })().catch((e) => { ttsPromise = null; throw e; });
    }
    return ttsPromise;
  }

  // returns a WAV Blob for the given text
  async function synth(text, voice) {
    const model = await load();
    const audio = await model.generate(text, { voice: voice || "af_heart" });
    return audio.toBlob();
  }

  window.Kokoro = { load, synth, voices: () => VOICES.slice(), isReady: () => !!tts };
  window.dispatchEvent(new Event("kokoro-available"));
})();
