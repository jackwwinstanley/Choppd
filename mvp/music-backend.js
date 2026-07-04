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
    TTS_DUCK_LEVEL: 0.10, // music fraction while a TTS clip plays (kitchen-tested)
    TTS_DOWN_MS: 150, TTS_UP_MS: 400, TTS_GRACE_MS: 500,
    CHECKPOINT_LEVEL: 0.40, // music fraction while waiting at a checkpoint
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

      init() { if (!this.el) { this.el = new Audio(); this.el.preload = "auto"; } },

      // ---- volume state machine ------------------------------------------------
      // The current gain target from (mode, ttsDucked, base). TTS duck multiplies
      // the checkpoint level (matches the pre-refactor VoiceDuck frac behavior).
      _gainTarget() {
        const stateLevel = (this.mode === "checkpoint" ? T.CHECKPOINT_LEVEL : 1) * this.base;
        return this.ttsDucked ? stateLevel * T.TTS_DUCK_LEVEL : stateLevel;
      },
      // `force` writes even to a paused element (used for the final full restore,
      // so volume can never stick ducked); mid-ramp writes skip paused elements —
      // e.g. the finish voice clip must not duck the already-stopped song.
      _setVol(v, force) {
        if (this.usingYt) { Yt.setVol(Math.round(v * 100)); return; }
        if (this.el && (force || !this.el.paused)) this.el.volume = Math.max(0, Math.min(1, v));
      },
      // setInterval, NOT requestAnimationFrame: rAF freezes in background tabs /
      // locked phones, which would stall a ramp mid-duck. Timers keep ticking
      // (coarser when backgrounded, but the ramp always COMPLETES — volume can
      // never stick ducked).
      _rampVol(ms) {
        if (this._volTimer) { clearInterval(this._volTimer); this._volTimer = null; }
        const target = this._gainTarget();
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
          if (r.ok && !this.loaded) { this.setSrc("audio/freebird.mp3"); return true; }
        } catch (e) { }
        return this.loaded;
      },
      has() { return this.usingYt || this.loaded; },
      play(track) {
        if (track && track.src) this.setSrc(track.src);
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
        if (this.usingYt) { Yt.destroy(); this.usingYt = false; return; }
        if (this.el) { this.el.pause(); try { this.el.currentTime = 0; } catch (e) { } this.el.loop = false; this.el.volume = 1; }
      },
      seek(t) { if (this.usingYt) { Yt.seek(t); return; } if (this.el) try { this.el.currentTime = t; } catch (e) { } },
      rate(r) {
        if (this.usingYt) { Yt.setRate(r); return; }
        if (!this.el) return;
        this.el.preservesPitch = this.el.mozPreservesPitch = this.el.webkitPreservesPitch = true;
        this.el.playbackRate = Math.max(0.5, Math.min(r, 4));
      },
      pos() { return this.usingYt ? Yt.time() : (this.el ? this.el.currentTime : 0); },
      setLoop(on) { this.init(); this.el.loop = !!on; },
      setBaseVolume(v) { this.base = Math.max(0, Math.min(1, v)); this._rampVol(0); },

      // checkpoint treatment — playback NEVER pauses or seeks; idempotent.
      enterCheckpoint() { if (this.mode === "checkpoint") return; this.mode = "checkpoint"; this._rampVol(0); },
      exitCheckpoint() { if (this.mode === "normal") return; this.mode = "normal"; this._rampVol(0); },

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
        };
      },

      // ---- free-tier YouTube embed hooks (official-video path) ----
      setYtMode(on) { this.usingYt = !!on; },
      mountYt(elId, videoId, opts) { Yt.onError = (opts && opts.onError) || null; Yt.create(elId, videoId, (opts && opts.onReady) || null); },
    };
    return B;
  }

  // ---- factory ---------------------------------------------------------------
  // The rest of the app calls getMusicBackend() once and never branches on
  // backend type. (The YouTube backend scaffold lands behind a dev flag in a
  // later commit; HTML5 is the shipped default.)
  let _instance = null;
  window.getMusicBackend = function getMusicBackend() {
    if (!_instance) _instance = createHtml5MusicBackend();
    return _instance;
  };
})();
