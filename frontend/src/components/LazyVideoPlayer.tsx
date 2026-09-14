import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { AlertTriangle, Maximize, RefreshCw, Wifi } from "lucide-react";

interface Props {
  cameraId: string;
  cameraName: string;
  hlsUrl: string;
  status: string;
  locationDescription?: string;
  vendor?: string;
  resolution?: string;
  fps?: number;
  onClick?: () => void;
  activeAlert?: any;
  loadDelay?: number;       // ms delay before starting load (for staggered batching)
  expanded?: boolean;       // when true, use WebRTC instead of HLS
}

// Reduced from 20s — fail fast and hand over to the auto-reconnect loop
const CONNECTING_TIMEOUT_MS = 8000;
// Auto-reconnect with exponential backoff (Sentinel integrator guidance: ~2s → cap ~30s)
const RECONNECT_BASE_MS = 2000;
const RECONNECT_MAX_MS = 30000;
// After this many silent reconnect attempts, surface the error card (still auto-retrying)
const ERROR_PHASE_ATTEMPTS = 3;

/** Derive WebRTC URL from HLS URL: /sentinel/live/camXX/index.m3u8 → ws://host:8889/camXX */
function getWebRtcUrl(hlsUrl: string): string {
  const match = hlsUrl.match(/\/sentinel\/live\/([^/]+)\//);
  if (!match) return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  return `${proto}//${host}:8889/${match[1]}`;
}

export default function LazyVideoPlayer({
  cameraId,
  cameraName,
  hlsUrl,
  status,
  locationDescription,
  vendor,
  resolution,
  fps,
  onClick,
  activeAlert,
  loadDelay = 0,
  expanded = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const connectingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isVisibleRef = useRef(false);

  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [useWebRtc, setUseWebRtc] = useState(false);

  // IntersectionObserver — lazy-load when tile enters viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          isVisibleRef.current = e.isIntersecting;
          setIsVisible(e.isIntersecting);
        }),
      { threshold: 0.05, rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (connectingTimerRef.current) clearTimeout(connectingTimerRef.current);
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, []);

  // When expanded, switch to WebRTC
  useEffect(() => {
    setUseWebRtc(expanded);
  }, [expanded]);

  const unloadStream = useCallback(() => {
    if (connectingTimerRef.current) {
      clearTimeout(connectingTimerRef.current);
      connectingTimerRef.current = null;
    }
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    // Tear down HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    // Tear down WebRTC
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.srcObject = null;
      videoRef.current.load();
    }
    setIsLoaded(false);
    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  /** WebRTC WHEP-style connection to MediaMTX :8889 */
  const loadWebRtc = useCallback(async () => {
    if (isLoaded || isLoading) return;
    const wsUrl = getWebRtcUrl(hlsUrl);
    if (!wsUrl) {
      setHasError(true);
      setErrorMsg("No WebRTC URL");
      return;
    }

    setIsLoading(true);
    setHasError(false);
    setErrorMsg("");

    const video = videoRef.current;
    if (!video) { setIsLoading(false); return; }

    try {
      // MediaMTX exposes a WHEP endpoint at http(s)://host:8889/streamId/whep
      const streamId = hlsUrl.match(/\/sentinel\/live\/([^/]+)\//)?.[1];
      if (!streamId) throw new Error("No stream ID");

      const whepUrl = `${window.location.protocol}//${window.location.hostname}:8889/${streamId}/whep`;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      });
      pcRef.current = pc;

      pc.addTransceiver("video", { direction: "recvonly" });
      pc.addTransceiver("audio", { direction: "recvonly" });

      pc.ontrack = (event) => {
        if (event.track.kind === "video") {
          video.srcObject = event.streams[0];
          video.play()
            .then(() => {
              setIsPlaying(true);
              setIsLoaded(true);
              setIsLoading(false);
              reconnectAttemptRef.current = 0;
              setReconnectAttempt(0);
              if (connectingTimerRef.current) {
                clearTimeout(connectingTimerRef.current);
                connectingTimerRef.current = null;
              }
            })
            .catch(() => {});
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
          if (connectingTimerRef.current) {
            clearTimeout(connectingTimerRef.current);
            connectingTimerRef.current = null;
          }
          scheduleReload("WebRTC connection lost");
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Send SDP offer to MediaMTX WHEP endpoint
      const resp = await fetch(whepUrl, {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp,
      });

      if (!resp.ok) throw new Error(`WHEP ${resp.status}`);
      const answerSdp = await resp.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

      // Timeout fallback
      connectingTimerRef.current = setTimeout(() => {
        connectingTimerRef.current = null;
        if (!isLoaded) {
          pc.close();
          pcRef.current = null;
          scheduleReload("WebRTC timeout");
        }
      }, CONNECTING_TIMEOUT_MS);
    } catch (err: any) {
      scheduleReload(err?.message || "WebRTC error");
    }
  }, [isLoaded, isLoading, hlsUrl]);

  /** Standard HLS load via hls.js */
  const loadHls = useCallback(() => {
    if (isLoaded || isLoading) return;
    if (!hlsUrl) {
      setHasError(true);
      setErrorMsg("No stream URL");
      return;
    }

    setIsLoading(true);
    setHasError(false);
    setErrorMsg("");

    const video = videoRef.current;
    if (!video) { setIsLoading(false); return; }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,          // enable LL-HLS (pairs with hlsPartDuration in mediamtx)
        backBufferLength: 3,           // was 5 — keep less back-buffer
        maxBufferLength: 6,            // was 10 — load less ahead
        maxMaxBufferLength: 12,        // was 20
        startLevel: 0,
        manifestLoadingTimeOut: 6000,  // was 10000 — fail faster
        manifestLoadingMaxRetry: 2,    // was 3
        manifestLoadingRetryDelay: 500,
        levelLoadingTimeOut: 6000,
        levelLoadingMaxRetry: 2,
        fragLoadingTimeOut: 8000,      // was 15000
        fragLoadingMaxRetry: 2,
        fragLoadingRetryDelay: 500,
      });

      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (connectingTimerRef.current) {
          clearTimeout(connectingTimerRef.current);
          connectingTimerRef.current = null;
        }
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
        video.play().then(() => setIsPlaying(true)).catch(() => {});
        setIsLoaded(true);
        setIsLoading(false);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return; // hls.js recovers non-fatal errors internally
        if (connectingTimerRef.current) {
          clearTimeout(connectingTimerRef.current);
          connectingTimerRef.current = null;
        }
        // Any fatal error — network, manifest, or media (incl.
        // mediaSourceRequiresReset) — tears down and re-enters the
        // auto-reconnect loop with backoff.
        scheduleReload(data.details || data.type || "Playback error");
      });

      hlsRef.current = hls;

      // Fast-fail timeout: 8s — hand over to the auto-reconnect loop
      connectingTimerRef.current = setTimeout(() => {
        connectingTimerRef.current = null;
        if (!isLoaded) {
          scheduleReload("Connection timeout");
        }
      }, CONNECTING_TIMEOUT_MS);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = hlsUrl;
      connectingTimerRef.current = setTimeout(() => {
        connectingTimerRef.current = null;
        if (!isLoaded) {
          scheduleReload("Connection timeout");
        }
      }, CONNECTING_TIMEOUT_MS);

      video.addEventListener("loadedmetadata", () => {
        if (connectingTimerRef.current) {
          clearTimeout(connectingTimerRef.current);
          connectingTimerRef.current = null;
        }
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
        video.play().then(() => setIsPlaying(true)).catch(() => {});
        setIsLoaded(true);
        setIsLoading(false);
      });
      video.addEventListener("error", () => {
        if (connectingTimerRef.current) {
          clearTimeout(connectingTimerRef.current);
          connectingTimerRef.current = null;
        }
        scheduleReload("Stream error");
      });
    } else {
      setHasError(true);
      setErrorMsg("HLS not supported");
      setIsLoading(false);
    }
  }, [isLoaded, isLoading, hlsUrl]);

  /**
   * Auto-reconnect loop: tear down the failed stream and schedule a fresh
   * load with exponential backoff (2s → 30s). Keeps retrying forever while
   * the tile is visible and the camera is online, so transient upstream
   * stalls (RTP loss, muxer restart, mediaSourceRequiresReset) self-heal.
   *
   * Declared as a plain function after both loaders (they call it, it calls
   * them — only at call time, so ordering is safe).
   */
  const scheduleReload = (reason: string) => {
    if (reloadTimerRef.current) return; // one reconnect pending already

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch {
        /* already closed */
      }
      pcRef.current = null;
    }
    if (connectingTimerRef.current) {
      clearTimeout(connectingTimerRef.current);
      connectingTimerRef.current = null;
    }

    const attempt = reconnectAttemptRef.current + 1;
    reconnectAttemptRef.current = attempt;
    setReconnectAttempt(attempt);
    const delay = Math.min(
      RECONNECT_BASE_MS * Math.pow(2, attempt - 1),
      RECONNECT_MAX_MS
    );

    setIsLoaded(false);
    setIsPlaying(false);

    // A few silent retries first; then surface the card while still retrying
    if (attempt >= ERROR_PHASE_ATTEMPTS) {
      setIsLoading(false);
      setHasError(true);
      setErrorMsg(`${reason} — auto-reconnecting (attempt ${attempt})`);
    } else {
      setHasError(false);
      setIsLoading(true);
    }

    reloadTimerRef.current = setTimeout(() => {
      reloadTimerRef.current = null;
      // Stop if we scrolled away or the camera went offline during backoff
      if (!isVisibleRef.current || status !== "online") return;
      if (useWebRtc) {
        loadWebRtc();
      } else {
        loadHls();
      }
    }, delay);
  };

  // Main load effect — triggered by visibility, status, expanded mode
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (isVisible && !isLoaded && !hasError && status === "online") {
      const doLoad = () => {
        if (useWebRtc) {
          loadWebRtc();
        } else {
          loadHls();
        }
      };

      if (loadDelay > 0) {
        timer = setTimeout(doLoad, loadDelay);
      } else {
        doLoad();
      }
    } else if (!isVisible && isLoaded) {
      unloadStream();
    }

    return () => {
      if (timer) clearTimeout(timer);
      // Don't unload on re-render — only on actual visibility change
    };
  }, [isVisible, status, useWebRtc, loadHls, loadWebRtc, unloadStream]);

  // When switching between expanded/grid mode, reload with appropriate protocol
  useEffect(() => {
    if (isLoaded || isLoading) {
      unloadStream();
      // Give a tick for cleanup before reload
      const t = setTimeout(() => {
        if (status === "online") {
          useWebRtc ? loadWebRtc() : loadHls();
        }
      }, 300);
      return () => clearTimeout(t);
    }
  }, [useWebRtc]);

  const retryLoad = () => {
    if (reloadTimerRef.current) {
      clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    setHasError(false);
    setIsLoading(false);
    setIsLoaded(false);
    setTimeout(() => {
      useWebRtc ? loadWebRtc() : loadHls();
    }, 300);
  };

  const hasAlert = activeAlert && activeAlert.length > 0;
  const sevColor: string = hasAlert
    ? activeAlert[0].severity === "critical"
      ? "#ff0000"
      : activeAlert[0].severity === "high"
      ? "#ff6600"
      : "#ffaa00"
    : "#ffaa00";

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#0a0a0a] rounded border border-gray-700/50 overflow-hidden cursor-pointer group"
      onClick={onClick}
      style={{ aspectRatio: expanded ? undefined : "16/9" }}
    >
      {/* VIDEO */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        muted
        autoPlay
        playsInline
        style={{ display: isLoaded && isPlaying ? "block" : "none" }}
      />

      {/* LOADING STATE */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f0f0f] gap-2">
          <div className="w-7 h-7 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-500 text-[11px] font-mono">
            {useWebRtc ? "WebRTC connecting..." : "Connecting..."}
          </p>
          <p className="text-gray-600 text-[9px] font-mono">{cameraName}</p>
          {reconnectAttempt > 0 && (
            <p className="text-yellow-600/70 text-[9px] font-mono">
              Reconnecting… attempt {reconnectAttempt}
            </p>
          )}
        </div>
      )}

      {/* NOT YET LOADED — placeholder */}
      {!isVisible && !isLoaded && !isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a] gap-2">
          <div className="w-8 h-8 rounded bg-gray-800/50 flex items-center justify-center">
            <span className="text-gray-600 text-xs">📷</span>
          </div>
          <p className="text-gray-600 text-[11px] font-mono">{cameraName}</p>
          <p className="text-gray-700 text-[9px]">Scroll to load</p>
        </div>
      )}

      {/* ERROR STATE */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a0a00] gap-2">
          <AlertTriangle size={20} className="text-red-500/60" />
          <p className="text-red-400/70 text-[11px] font-mono">Stream Error</p>
          {errorMsg && (
            <p className="text-red-400/50 text-[9px] font-mono">{errorMsg}</p>
          )}
          {useWebRtc && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUseWebRtc(false);
                retryLoad();
              }}
              className="mt-1 px-3 py-1 bg-blue-900/60 hover:bg-blue-800 text-white text-[10px] rounded"
            >
              Try HLS instead
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              retryLoad();
            }}
            className="mt-1 px-3 py-1 bg-blue-700/80 hover:bg-blue-600 text-white text-[10px] rounded flex items-center gap-1"
          >
            <RefreshCw size={10} /> Retry
          </button>
        </div>
      )}

      {/* OFFLINE */}
      {status !== "online" && !isLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#1a0000]/80 gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <p className="text-red-400/60 text-[11px] font-mono">Camera Offline</p>
          <p className="text-gray-600 text-[9px] font-mono">{cameraName}</p>
        </div>
      )}

      {/* TOP BAR */}
      <div className="absolute top-0 left-0 right-0 h-6 bg-black/60 flex items-center px-2 justify-between z-10">
        <span className="text-white text-[10px] font-mono font-bold truncate">{cameraName}</span>
        <div className="flex items-center gap-1.5">
          {useWebRtc && isPlaying && (
            <span className="text-[8px] text-blue-400 font-mono flex items-center gap-0.5">
              <Wifi size={8} />
              RTC
            </span>
          )}
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isPlaying
                ? "bg-green-500"
                : hasError
                ? "bg-red-500"
                : isLoading
                ? "bg-yellow-500"
                : "bg-gray-600"
            }`}
          />
          <span className="text-white/50 text-[8px] font-mono">
            {isPlaying ? "LIVE" : hasError ? "ERR" : isLoading ? "CONN" : "IDLE"}
          </span>
        </div>
      </div>

      {/* REC indicator */}
      {isPlaying && (
        <div className="absolute top-7 left-2 flex items-center gap-1 z-10">
          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[8px] text-white/60 font-mono font-bold">REC</span>
        </div>
      )}

      {/* ALERT OVERLAY */}
      {hasAlert && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <div
            className="absolute top-6 left-0 right-0 h-5 flex items-center px-2"
            style={{ backgroundColor: sevColor }}
          >
            <span className="text-white text-[9px] font-mono font-bold flex items-center gap-1">
              <AlertTriangle size={9} /> WATCHLIST: {activeAlert[0].plate_number}
            </span>
          </div>
          <div className="absolute bottom-6 left-0 right-0 h-6 bg-black/80 flex items-center px-2">
            <span className="text-[8px] font-mono" style={{ color: sevColor }}>
              PLATE: {activeAlert[0].plate_number} |{" "}
              {(activeAlert[0].match_confidence * 100).toFixed(0)}% |{" "}
              {activeAlert[0].watchlist_reason}
            </span>
          </div>
          <div
            className="absolute inset-0 border-2 animate-pulse"
            style={{ borderColor: sevColor }}
          />
        </div>
      )}

      {/* BOTTOM BAR */}
      <div className="absolute bottom-0 left-0 right-0 h-5 bg-black/50 flex items-center justify-between px-2 z-10">
        <span className="text-white/30 text-[8px] font-mono">
          {locationDescription?.substring(0, 20) || ""}
        </span>
        <span className="text-white/30 text-[8px] font-mono">
          {resolution || "1080p"} | {fps || 25}fps
        </span>
      </div>

      {/* HOVER expand icon */}
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 z-10">
        <div className="bg-black/60 rounded-full p-2">
          <Maximize size={14} className="text-white" />
        </div>
      </div>
    </div>
  );
}
