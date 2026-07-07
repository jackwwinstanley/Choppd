/*
 * MusicBackend — the ONE module that touches music playback and music gain.
 * Everything else in the app talks to the backend returned by
 * window.getMusicBackend(); nothing outside this file may reach the <audio>
 * element or a player's volume.
 *
 * Interface (both backends):
 *   init(), play(track?), pause(), resume(), stop(),
 *   setBaseVolume(0–1),
 *   enterCheckpoint() / exitCheckpoint()   — the checkpoint treatment (idempotent)
 *   duckForTTS() / restoreFromTTS()        — voice-cue duck; restore is driven by
 *                                            the clip's 'ended' event upstream
 *   getState()                             — { playing, position, checkpointed, ducked }
 * plus the app-level extras the cook engine needs (same semantics as before the
 * refactor): setSrc, loadFile, tryBundled, has, loaded, seek, rate, pos,
 * setLoop, duck/unduck (instant seek-mask dip), and the YT-embed hooks
 * (setYtMode, mountYt) for the free-tier official-video path.
 */
(() => {
  // ---- YouTube IFrame player (free-tier embed: licensed playback via YT) ----
  const Yt = {
    player: null, ready: false, apiLoading: false, vol: 100, onPlaying: null, onError: null,
    loadApi(cb) {
      if (window.YT && window.YT.Player) { cb(); return; }
      if (!this.apiLoading) {
        this.apiLoading = true;
        const tag = document.createElement("script");
        tag.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(tag);
      }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) try { prev(); } catch (e) { } cb(); };
    },
    create(elId, videoId, onReady) {
      this.destroy();
      this.loadApi(() => {
        try {
          this.player = new window.YT.Player(elId, {
            width: "100%", height: "100%", videoId,
            host: "https://www.youtube.com",
            // autoplay off — playback (and the whole cook) starts on the user's tap.
            // origin = our real web origin (legit API config, not a spoofed domain).
            playerVars: { autoplay: 0, playsinline: 1, modestbranding: 1, rel: 0, controls: 1, enablejsapi: 1, origin: location.origin },
            events: {
              onReady: (e) => { this.ready = true; try { e.target.setVolume(this.vol); } catch (_) { } if (onReady) onReady(); },
              onStateChange: (e) => { if (e.data === 1 && this.onPlaying) this.onPlaying(); }, // 1 = PLAYING
              onError: (e) => { if (this.onError) this.onError(e.data); }, // 101/150 = embedding blocked
            },
          });
        } catch (e) { }
      });
    },
    play() { try { this.player && this.player.playVideo(); } catch (e) { } },
    pause() { try { this.player && this.player.pauseVideo(); } catch (e) { } },
    seek(t) { try { this.player && this.player.seekTo(t, true); } catch (e) { } },
    setVol(v) { this.vol = v; try { this.player && this.player.setVolume(v); } catch (e) { } },
    setRate(r) { try { this.player && this.player.setPlaybackRate(Math.max(1, Math.min(r, 2))); } catch (e) { } },
    time() { try { return this.player ? this.player.getCurrentTime() : 0; } catch (e) { return 0; } },
    destroy() { try { if (this.player && this.player.destroy) this.player.destroy(); } catch (e) { } this.player = null; this.ready = false; },
  };

  // ---- tunables (single source of truth for the voice/music balance) --------
  const T = {
    TTS_DUCK_LEVEL: 0.10, // music gain while a TTS clip plays (kitchen-tested)
    TTS_DOWN_MS: 150, TTS_UP_MS: 400, TTS_GRACE_MS: 500,
    // checkpoint "muffle": music keeps playing but sounds blotted/underwater —
    // lowpass cutoff drops to MUFFLE_CUTOFF_HZ and gain to MUFFLE_GAIN.
    MUFFLE_CUTOFF_HZ: 300,
    MUFFLE_GAIN: 0.40,
    RAMP_IN_MS: 300,        // entering a checkpoint
    RAMP_OUT_FAST_MS: 400,  // fast exit: skip navigation + every non-continue path
    // Checkpoint-CONTINUE off-ramp (tune by ear on-device): after the re-sync
    // seek lands, HOLD at full muffle so the corrected position "settles",
    // then open the filter exponentially with the gain rising behind it.
    POST_SEEK_HOLD_MS: 500,
    RAMP_OUT_MS: 1200,      // the shaped off-ramp (filter exp + gain linear)
    GAIN_STAGGER_MS: 300,   // gain starts this long after the filter; both land together
    NEUTRAL_CUTOFF_HZ: 20000, // transparent — audibly identical to no filter
  };
  window.MUSIC_TUNABLES = T;

  // ---- HTML5 backend (the shipped default) ----------------------------------
  function createHtml5MusicBackend() {
    const B = {
      el: null, loaded: false, usingYt: false,
      base: 1,            // setBaseVolume target (guided-cook bg loop uses 0.5)
      mode: "normal",    // 'normal' | 'checkpoint'
      ttsDucked: false,
      _volTimer: null, _upTimer: null,
      _graph: null, _graphFailed: false,   // { ctx, src, filter, gain } once built

      init() { if (!this.el) { this.el = new Audio(); this.el.preload = "auto"; } },

      // ---- Web Audio graph: <audio> → lowpass → gain → speakers -----------------
      // Built INSIDE the existing start-cook tap (the same gesture that unlocks
      // iOS audio) — no second gesture. All sources are same-origin (bundled
      // mp3s / blob URLs), so MediaElementSource is safe. Neutral state
      // (cutoff 20 kHz, gain = base) is audibly identical to the plain element.
      // A MediaElementSource can only ever be created once per element, and on
      // failure we fall back to element-volume control (no filter, same levels).
      initGraph() {
        this.init();
        if (this._graph || this._graphFailed) { this._resumeCtx(); return; }
        try {
          const Ctx = window.AudioContext || window.webkitAudioContext;
          if (!Ctx) { this._graphFailed = true; return; }
          const ctx = new Ctx();
          const src = ctx.createMediaElementSource(this.el);
          const filter = ctx.createBiquadFilter();
          filter.type = "lowpass"; filter.frequency.value = T.NEUTRAL_CUTOFF_HZ; filter.Q.value = 0.7071;
          const gain = ctx.createGain(); gain.gain.value = this._gainTarget();
          src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
          this._graph = { ctx, src, filter, gain };
          this.el.volume = 1;   // the gain node owns loudness from here on
        } catch (e) { this._graphFailed = true; }
        this._resumeCtx();
      },
      _resumeCtx() { const g = this._graph; if (g && g.ctx.state === "suspended") { try { g.ctx.resume(); } catch (e) { } } },
      // linearRampToValueAtTime — audio-clock driven, so ramps complete even in
      // background tabs / locked phones; no clicks, no instant jumps.
      _gainRamp(target, ms) {
        const g = this._graph.gain.gain, now = this._graph.ctx.currentTime;
        g.cancelScheduledValues(now); g.setValueAtTime(g.value, now);
        g.linearRampToValueAtTime(target, now + Math.max(1, ms) / 1000);
      },
      // EXPONENTIAL, never linear: frequency perception is logarithmic — a
      // linear cutoff sweep spends nearly all its audible change in the first
      // ~100ms and reads as a switch. Values are pinned ≥40 Hz (an exponential
      // ramp can never start from or target 0).
      _filterRamp(hz, ms) {
        if (!this._graph) return;   // no graph → volume-only degrade (no filter)
        const f = this._graph.filter.frequency, now = this._graph.ctx.currentTime;
        f.cancelScheduledValues(now); f.setValueAtTime(Math.max(40, f.value), now);
        f.exponentialRampToValueAtTime(Math.max(40, hz), now + Math.max(1, ms) / 1000);
      },
      // Checkpoint-continue OFF-RAMP, scheduled entirely on the audio clock
      // (sample-accurate, keeps running in background tabs, and any later
      // cancelScheduledValues — stop(), enterCheckpoint(), a TTS duck — kills
      // the whole plan at once; no zombie JS timers):
      //   t=0 ................ HOLD at full muffle (song settles at the corrected spot)
      //   t=+HOLD ............ filter opens exponentially over RAMP_OUT_MS
      //   t=+HOLD+STAGGER .... gain rises linearly behind it
      //   t=+HOLD+RAMP_OUT ... both land together (20 kHz / base volume)
      _scheduleSmoothOffRamp() {
        const { ctx, filter, gain } = this._graph;
        const now = ctx.currentTime;
        const hold = T.POST_SEEK_HOLD_MS / 1000, ramp = T.RAMP_OUT_MS / 1000, stag = T.GAIN_STAGGER_MS / 1000;
        const f = filter.frequency, g = gain.gain;
        const f0 = Math.max(40, f.value);
        f.cancelScheduledValues(now);
        f.setValueAtTime(f0, now);
        f.setValueAtTime(f0, now + hold);
        f.exponentialRampToValueAtTime(T.NEUTRAL_CUTOFF_HZ, now + hold + ramp);
        g.cancelScheduledValues(now);
        g.setValueAtTime(g.value, now);
        g.setValueAtTime(g.value, now + hold + stag);
        g.linearRampToValueAtTime(this._gainTarget(), now + hold + ramp);
      },

      // ---- volume state machine ------------------------------------------------
      _gainTarget() {
        // TTS duck is ABSOLUTE (0.10) whatever state we're in; otherwise the
        // state decides: checkpoint muffle gain, or plain base volume.
        if (this.ttsDucked) return T.TTS_DUCK_LEVEL * this.base;
        return (this.mode === "checkpoint" ? T.MUFFLE_GAIN : 1) * this.base;
      },
      // `force` writes even to a paused element (used for the final full restore,
      // so volume can never stick ducked); mid-ramp writes skip paused elements —
      // e.g. the finish voice clip must not duck the already-stopped song.
      _setVol(v, force) {
        if (this.usingYt) { Yt.setVol(Math.round(v * 100)); return; }
        if (this._graph) { this._gainRamp(Math.max(0, Math.min(1, v)), 16); return; }
        if (this.el && (force || !this.el.paused)) this.el.volume = Math.max(0, Math.min(1, v));
      },
      // setInterval, NOT requestAnimationFrame: rAF freezes in background tabs /
      // locked phones, which would stall a ramp mid-duck. Timers keep ticking
      // (coarser when backgrounded, but the ramp always COMPLETES — volume can
      // never stick ducked).
      _rampVol(ms) {
        if (this._volTimer) { clearInterval(this._volTimer); this._volTimer = null; }
        const target = this._gainTarget();
        if (this._graph && !this.usingYt) { this._gainRamp(target, ms); return; }
        if (!ms) { this._setVol(target, true); return; }
        const from = this.usingYt ? Yt.vol / 100 : (this.el ? this.el.volume : 1);
        const start = performance.now();
        this._volTimer = setInterval(() => {
          const k = Math.max(0, Math.min(1, (performance.now() - start) / ms));
          const full = !this.ttsDucked && this.mode === "normal";
          this._setVol(from + (this._gainTarget() - from) * k, k >= 1 && full);
          if (k >= 1) { clearInterval(this._volTimer); this._volTimer = null; }
        }, 33);
      },

      // ---- interface -------------------------------------------------------------
      setSrc(src) { this.init(); this.el.src = src; this.loaded = true; },
      loadFile(file) { this.setSrc(URL.createObjectURL(file)); },
      async tryBundled() {
        try {
          const r = await fetch("audio/freebird.mp3", { method: "HEAD" });
          // the SPA catch-all serves 200 text/html for missing files — only accept real audio
          if (r.ok && /audio|octet-stream/.test(r.headers.get("content-type") || "") && !this.loaded) { this.setSrc("audio/freebird.mp3"); return true; }
        } catch (e) { }
        return this.loaded;
      },
      has() { return this.usingYt || this.loaded; },
      play(track) {
        if (track && track.src) this.setSrc(track.src);
        this._resumeCtx();
        if (this.usingYt) { Yt.setVol(Math.round(this._gainTarget() * 100)); Yt.play(); return; }
        if (this.el) this.el.play().catch(() => { });
      },
      resume() { this.play(); },
      pause() { if (this.usingYt) { Yt.pause(); return; } if (this.el) this.el.pause(); },
      // End-of-cook / quit: the song stops IMMEDIATELY — a clean cut, not a fade.
      // Cancels any in-flight ramp + pending TTS restore and resets the whole
      // state machine so the next cook starts clean at full volume. The voice
      // element is separate, so a finish voice line stays fully audible.
      stop() {
        if (this._upTimer) { clearTimeout(this._upTimer); this._upTimer = null; }
        if (this._volTimer) { clearInterval(this._volTimer); this._volTimer = null; }
        this.ttsDucked = false; this.mode = "normal"; this.base = 1;
        if (this._graph) {
          const now = this._graph.ctx.currentTime;
          this._graph.gain.gain.cancelScheduledValues(now); this._graph.gain.gain.setValueAtTime(1, now);
          this._graph.filter.frequency.cancelScheduledValues(now); this._graph.filter.frequency.setValueAtTime(T.NEUTRAL_CUTOFF_HZ, now);
        }
        if (this.usingYt) { Yt.destroy(); this.usingYt = false; return; }
        if (this.el) { this.el.pause(); try { this.el.currentTime = 0; } catch (e) { } this.el.loop = false; this.el.volume = 1; }
      },
      // Optional onLanded fires once the seek has actually COMPLETED (the
      // element's one-shot 'seeked' event), so callers can sequence work
      // strictly after the position jump — e.g. the checkpoint re-sync lifts
      // the muffle only after the rewind lands, never concurrently. A safety
      // timeout guarantees the callback even if 'seeked' never fires.
      seek(t, onLanded) {
        if (this.usingYt) { Yt.seek(t); if (onLanded) setTimeout(onLanded, 250); return; }
        if (!this.el) { if (onLanded) onLanded(); return; }
        if (onLanded) {
          let done = false;
          const fire = () => { if (done) return; done = true; this.el.removeEventListener("seeked", fire); onLanded(); };
          this.el.addEventListener("seeked", fire);
          setTimeout(fire, 400);
        }
        try { this.el.currentTime = t; } catch (e) { }
      },
      rate(r) {
        if (this.usingYt) { Yt.setRate(r); return; }
        if (!this.el) return;
        this.el.preservesPitch = this.el.mozPreservesPitch = this.el.webkitPreservesPitch = true;
        this.el.playbackRate = Math.max(0.5, Math.min(r, 4));
      },
      pos() { return this.usingYt ? Yt.time() : (this.el ? this.el.currentTime : 0); },
      setLoop(on) { this.init(); this.el.loop = !!on; },
      setBaseVolume(v) { this.base = Math.max(0, Math.min(1, v)); this._rampVol(0); },

      // checkpoint treatment — the MUFFLE. Playback NEVER pauses or seeks (the
      // position keeps advancing under the blot); idempotent both ways. With the
      // graph: lowpass sweeps to MUFFLE_CUTOFF_HZ + gain to MUFFLE_GAIN; without
      // it (or on the YT embed): volume-only at the same levels.
      enterCheckpoint() {
        if (this.mode === "checkpoint") return;
        this.mode = "checkpoint";
        // (also cancels any in-flight continue off-ramp — the ramps below start
        // with cancelScheduledValues, so a new checkpoint always wins instantly)
        this._filterRamp(T.MUFFLE_CUTOFF_HZ, T.RAMP_IN_MS);
        this._rampVol(T.RAMP_IN_MS);
      },
      // opts.smooth = the checkpoint-continue path (post-seek hold + shaped
      // staggered off-ramp). Default = the fast exit used by skip navigation
      // and every other leave-checkpoint path — separate timing constants.
      exitCheckpoint(opts) {
        if (this.mode === "normal") return;
        this.mode = "normal";
        if (opts && opts.smooth && this._graph && !this.usingYt) { this._scheduleSmoothOffRamp(); return; }
        this._filterRamp(T.NEUTRAL_CUTOFF_HZ, T.RAMP_OUT_FAST_MS);
        this._rampVol(T.RAMP_OUT_FAST_MS);
      },

      // TTS duck — down() on clip 'play', restore on clip 'ended' (+grace so
      // back-to-back clips don't pump). Restore lands on the CURRENT state's
      // level: checkpoint level if still checkpointed, base volume if not.
      duckForTTS() {
        if (this._upTimer) { clearTimeout(this._upTimer); this._upTimer = null; }
        this.ttsDucked = true; this._rampVol(T.TTS_DOWN_MS);
      },
      restoreFromTTS() {
        if (this._upTimer) clearTimeout(this._upTimer);
        this._upTimer = setTimeout(() => { this._upTimer = null; this.ttsDucked = false; this._rampVol(T.TTS_UP_MS); }, T.TTS_GRACE_MS);
      },

      // instant micro-dip to mask a seek jump (preview driver); respects state.
      duck() { this._setVol(0.22 * this._gainTarget()); },
      unduck() { this._setVol(this._gainTarget()); },

      getState() {
        return {
          playing: this.usingYt ? !!Yt.player : !!(this.el && !this.el.paused && this.loaded),
          position: this.pos(),
          checkpointed: this.mode === "checkpoint",
          ducked: this.ttsDucked,
          muffleActive: !!this._graph,   // filter available (graph built) vs volume-only degrade
        };
      },

      // ---- free-tier YouTube embed hooks (official-video path) ----
      setYtMode(on) { this.usingYt = !!on; },
      mountYt(elId, videoId, opts) { Yt.onError = (opts && opts.onError) || null; Yt.create(elId, videoId, (opts && opts.onReady) || null); },
    };
    return B;
  }

  // ============================================================================
  // YouTubeMusicBackend — SCAFFOLD ONLY (dev flag, ships inert; NOT active)
  // ============================================================================
  // KNOWN CONSTRAINTS for the future migration (unresolved product questions —
  // deliberately out of this task's scope):
  //   · ToS: the player must remain VISIBLE (no display:none / 0×0 tricks).
  //   · iOS pauses embeds that scroll off-viewport and when the screen locks —
  //     a locked-phone kitchen cook cannot rely on iframe audio.
  //   · Audio control is volume-only (setVolume). NO muffle/filtering is
  //     possible: the media lives cross-origin inside the iframe, so Web Audio
  //     can never touch it. Checkpoint treatment = a stepped volume ramp to
  //     YT_CHECKPOINT_VOL instead (the IFrame API has no native ramps).
  //   · Every track needs a videoId sourced/licensed (song.videoId — an
  //     OPTIONAL field on the track schema, null for all current tracks).
  // Enable in dev: localStorage.setItem("seartune_music_backend", "youtube")
  // then reload. Default OFF — getMusicBackend() returns the HTML5 backend.
  const YT_CHECKPOINT_VOL = 12;   // % — the volume-only stand-in for the muffle
  function createYouTubeMusicBackend() {
    const B = {
      loaded: false, usingYt: true, base: 1,
      mode: "normal", ttsDucked: false,
      _player: null, _ready: false, _volTimer: null, _upTimer: null, _pendingId: null,

      _targetPct() {
        if (this.ttsDucked) return Math.round(T.TTS_DUCK_LEVEL * 100 * this.base);
        return Math.round((this.mode === "checkpoint" ? YT_CHECKPOINT_VOL : 100) * this.base);
      },
      // manual stepped ramp — the IFrame API has no native volume ramps
      _stepTo(ms) {
        if (this._volTimer) { clearInterval(this._volTimer); this._volTimer = null; }
        const from = this._player && this._ready ? (() => { try { return this._player.getVolume(); } catch (e) { return 100; } })() : 100;
        const start = performance.now();
        this._volTimer = setInterval(() => {
          const k = Math.max(0, Math.min(1, (performance.now() - start) / Math.max(1, ms)));
          const v = Math.round(from + (this._targetPct() - from) * k);
          try { this._player && this._player.setVolume(v); } catch (e) { }
          if (k >= 1) { clearInterval(this._volTimer); this._volTimer = null; }
        }, 30);
      },

      // lazily injects the IFrame API; the player mounts into a small VISIBLE
      // fixed container (ToS — see constraints above).
      init() {
        if (document.getElementById("ytBackendPlayer")) return;
        const d = document.createElement("div");
        d.id = "ytBackendPlayer";
        d.style.cssText = "position:fixed;right:10px;bottom:10px;width:240px;height:135px;z-index:9999;border-radius:10px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.5)";
        document.body.appendChild(d);
      },
      initGraph() { },   // no-op: no Web Audio possible cross-origin
      play(track) {
        this.init();
        const id = track && track.videoId ? track.videoId : this._pendingId;
        if (!id) return;
        if (this._player && this._pendingId === id) { try { this._player.playVideo(); } catch (e) { } return; }
        this._pendingId = id; this.loaded = true;
        Yt.loadApi(() => {
          try {
            this._player = new window.YT.Player("ytBackendPlayer", {
              width: "100%", height: "100%", videoId: id,
              playerVars: { autoplay: 1, playsinline: 1, enablejsapi: 1, origin: location.origin },
              events: { onReady: (e) => { this._ready = true; try { e.target.setVolume(this._targetPct()); e.target.playVideo(); } catch (_) { } } },
            });
          } catch (e) { }
        });
      },
      resume() { try { this._player && this._player.playVideo(); } catch (e) { } },
      pause() { try { this._player && this._player.pauseVideo(); } catch (e) { } },
      stop() {
        if (this._volTimer) { clearInterval(this._volTimer); this._volTimer = null; }
        if (this._upTimer) { clearTimeout(this._upTimer); this._upTimer = null; }
        this.ttsDucked = false; this.mode = "normal"; this.base = 1;
        try { this._player && this._player.destroy(); } catch (e) { }
        this._player = null; this._ready = false; this._pendingId = null; this.loaded = false;
        const d = document.getElementById("ytBackendPlayer"); if (d) d.remove();
      },
      setBaseVolume(v) { this.base = Math.max(0, Math.min(1, v)); this._stepTo(50); },
      enterCheckpoint() { if (this.mode === "checkpoint") return; this.mode = "checkpoint"; this._stepTo(T.RAMP_IN_MS); },
      exitCheckpoint() { if (this.mode === "normal") return; this.mode = "normal"; this._stepTo(T.RAMP_OUT_FAST_MS); },
      duckForTTS() {
        if (this._upTimer) { clearTimeout(this._upTimer); this._upTimer = null; }
        this.ttsDucked = true; this._stepTo(T.TTS_DOWN_MS);
      },
      restoreFromTTS() {
        if (this._upTimer) clearTimeout(this._upTimer);
        this._upTimer = setTimeout(() => { this._upTimer = null; this.ttsDucked = false; this._stepTo(T.TTS_UP_MS); }, T.TTS_GRACE_MS);
      },
      getState() {
        let pos = 0, playing = false;
        try { pos = this._player ? this._player.getCurrentTime() : 0; playing = this._player ? this._player.getPlayerState() === 1 : false; } catch (e) { }
        return { playing, position: pos, checkpointed: this.mode === "checkpoint", ducked: this.ttsDucked };
      },

      // cook-engine extras — inert stubs so the dev flag can't crash the app;
      // the future migration decides what these mean for iframe playback.
      setSrc() { }, loadFile() { }, async tryBundled() { return this.loaded; },
      has() { return this.loaded; },
      seek(t) { try { this._player && this._player.seekTo(t, true); } catch (e) { } },
      rate(r) { try { this._player && this._player.setPlaybackRate(Math.max(1, Math.min(r, 2))); } catch (e) { } },
      pos() { return this.getState().position; },
      setLoop() { }, duck() { }, unduck() { },
      setYtMode() { }, mountYt() { },
    };
    return B;
  }

  // ---- factory ---------------------------------------------------------------
  // The rest of the app calls getMusicBackend() once and NEVER branches on
  // backend type. HTML5 is the shipped default; the YouTube scaffold only
  // activates behind the dev flag above (default OFF → inert).
  let _instance = null;
  window.getMusicBackend = function getMusicBackend() {
    if (!_instance) {
      let dev = null; try { dev = localStorage.getItem("seartune_music_backend"); } catch (e) { }
      _instance = dev === "youtube" ? createYouTubeMusicBackend() : createHtml5MusicBackend();
    }
    return _instance;
  };
})();
