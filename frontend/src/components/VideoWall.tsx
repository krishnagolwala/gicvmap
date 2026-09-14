import { useState, useRef } from "react";
import LazyVideoPlayer from "./LazyVideoPlayer";
import {
  Grid3x3,
  LayoutGrid,
  Columns,
  Square,
  ChevronLeft,
  Maximize,
  Minimize,
  ChevronRight,
} from "lucide-react";

interface RealAlert {
  id: number;
  plate_number: string;
  severity: string;
  camera_name: string;
  triggered_at: string;
  watchlist_reason: string;
  match_confidence: number;
}

interface Props {
  cameras: any[];
  realAlerts?: RealAlert[];
}

/**
 * Batch loading strategy:
 * - Cameras are loaded in batches of BATCH_SIZE (3)
 * - Each batch starts BATCH_INTERVAL_MS after the previous
 * - This prevents hammering MediaMTX with 9+ simultaneous RTSP cold-starts
 */
const BATCH_SIZE = 3;
const BATCH_INTERVAL_MS = 2000; // 2s between batches

function getBatchDelay(idx: number): number {
  const batchIndex = Math.floor(idx / BATCH_SIZE);
  return batchIndex * BATCH_INTERVAL_MS;
}

export default function VideoWall({ cameras, realAlerts = [] }: Props) {
  const [gridCols, setGridCols] = useState(3);
  const [page, setPage] = useState(0);
  const [expandedCamera, setExpandedCamera] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  const onlineCameras = cameras.filter((c) => c.status === "online");
  const perPage = gridCols * gridCols; // 4, 9, 16, or 25
  const totalPages = Math.ceil(onlineCameras.length / perPage);
  const pageCameras = onlineCameras.slice(page * perPage, (page + 1) * perPage);

  const changeGrid = (cols: number) => {
    setGridCols(cols);
    setPage(0);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  // EXPANDED single camera view — uses WebRTC (low-latency)
  if (expandedCamera) {
    return (
      <div className="h-full flex flex-col" ref={containerRef}>
        <div className="flex items-center gap-3 mb-3 shrink-0">
          <button
            onClick={() => setExpandedCamera(null)}
            className="px-3 py-1.5 bg-navy-700 text-gray-400 text-sm rounded hover:text-white flex items-center gap-1.5"
          >
            <ChevronLeft size={14} />
            Back to Wall
          </button>
          <span className="text-white font-medium">{expandedCamera.name}</span>
          <span className="text-xs text-gray-500">{expandedCamera.location_description}</span>
          <span className="text-xs text-blue-400/70 font-mono ml-2">⚡ WebRTC</span>
          <button
            onClick={toggleFullscreen}
            className="ml-auto px-3 py-1.5 bg-navy-700 text-gray-400 text-sm rounded hover:text-white flex items-center gap-1.5"
          >
            {fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
            {fullscreen ? "Exit Fullscreen" : "Fullscreen"}
          </button>
        </div>
        <div className="flex-1 rounded-lg overflow-hidden border border-gray-700 bg-black min-h-0">
          <LazyVideoPlayer
            cameraId={expandedCamera.id}
            cameraName={expandedCamera.name}
            hlsUrl={getHlsUrl(expandedCamera)}
            status={expandedCamera.status}
            locationDescription={expandedCamera.location_description}
            vendor={expandedCamera.vendor}
            resolution={expandedCamera.resolution}
            fps={expandedCamera.fps}
            activeAlert={realAlerts.filter((a) => a.camera_name === expandedCamera.name)}
            expanded={true}   // triggers WebRTC mode
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col" ref={containerRef}>
      {/* CONTROLS BAR */}
      <div className="flex items-center gap-4 mb-3 shrink-0">
        <span className="text-sm text-gray-400">Grid:</span>
        {[
          { cols: 2, icon: LayoutGrid, label: "2×2" },
          { cols: 3, icon: Grid3x3, label: "3×3" },
          { cols: 4, icon: Columns, label: "4×4" },
          { cols: 5, icon: Square, label: "5×5" },
        ].map((g) => (
          <button
            key={g.cols}
            onClick={() => changeGrid(g.cols)}
            className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 ${
              gridCols === g.cols
                ? "bg-primary-600 text-white"
                : "bg-navy-700 text-gray-400 hover:text-white"
            }`}
          >
            <g.icon size={14} />
            {g.label}
          </button>
        ))}
        <button
          onClick={toggleFullscreen}
          className="px-3 py-1.5 text-sm rounded bg-navy-700 text-gray-400 hover:text-white flex items-center gap-1.5"
        >
          {fullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
          {fullscreen ? "Exit" : "Fullscreen"}
        </button>
        <span className="text-sm text-gray-500 ml-auto">
          Page {page + 1}/{Math.max(1, totalPages)} | {perPage} per page |{" "}
          {onlineCameras.length} online — batch-loading {BATCH_SIZE}/group
        </span>
      </div>

      {/* CAMERA GRID */}
      <div className="flex-1 min-h-0">
        <div
          className="grid gap-1 h-full"
          style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}
        >
          {pageCameras.map((cam, idx) => (
            <div
              key={cam.id}
              className="relative bg-black rounded overflow-hidden"
            >
              <LazyVideoPlayer
                cameraId={cam.id}
                cameraName={cam.name}
                hlsUrl={getHlsUrl(cam)}
                status={cam.status}
                locationDescription={cam.location_description}
                vendor={cam.vendor}
                resolution={cam.resolution}
                fps={cam.fps}
                onClick={() => setExpandedCamera(cam)}
                activeAlert={realAlerts.filter((a) => a.camera_name === cam.name)}
                loadDelay={getBatchDelay(idx)}  // batch: 0,0,0,  2000,2000,2000,  4000,...
              />
            </div>
          ))}

          {/* Empty tile fillers */}
          {Array.from({ length: perPage - pageCameras.length }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="bg-[#0a0a0a] rounded border border-gray-700/30 flex items-center justify-center"
              style={{ aspectRatio: "16/9" }}
            >
              <span className="text-gray-800 text-xl">+</span>
            </div>
          ))}
        </div>
      </div>

      {/* PAGINATION BAR */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2 mt-2 shrink-0">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 text-sm rounded bg-navy-700 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
          >
            <ChevronLeft size={14} />
            Prev
          </button>

          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              onClick={() => setPage(i)}
              className={`px-3 py-1 text-sm rounded min-w-[32px] ${
                page === i
                  ? "bg-primary-600 text-white"
                  : "bg-navy-700 text-gray-400 hover:text-white"
              }`}
            >
              {i + 1}
            </button>
          ))}

          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="px-3 py-1 text-sm rounded bg-navy-700 text-gray-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
          >
            Next
            <ChevronRight size={14} />
          </button>

          <span className="text-xs text-gray-500 ml-2">
            Streaming {pageCameras.length} / {onlineCameras.length} cameras
          </span>
        </div>
      )}

      {onlineCameras.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          No online cameras available for video wall
        </div>
      )}
    </div>
  );
}

function getHlsUrl(camera: any): string {
  if (!camera.rtsp_url) return "";
  const match = camera.rtsp_url.match(/stream\/([^/?]+)/);
  if (!match) return "";
  const streamId = match[1];
  return `/sentinel/live/${streamId}/index.m3u8`;
}
