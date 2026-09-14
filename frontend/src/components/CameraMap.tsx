import { useState, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Camera, Layers, Info, X } from "lucide-react";

// Department color palette
const DEPT_COLORS: Record<number, string> = {
  1: "#3B82F6", // Home/Police — blue
  2: "#F59E0B", // RTO — amber
  3: "#10B981", // Municipal — green
  4: "#8B5CF6", // Civil Supplies — purple
  5: "#06B6D4", // Transport — cyan
  6: "#EF4444", // Revenue — red
};

const DEPT_NAMES: Record<number, string> = {
  1: "Home / Police",
  2: "RTO",
  3: "Municipal Corp",
  4: "Food & Civil Sup.",
  5: "Transport",
  6: "Revenue",
};

const STATUS_COLORS: Record<string, string> = {
  online: "#22C55E",
  offline: "#EF4444",
  degraded: "#F59E0B",
  unknown: "#6B7280",
  maintenance: "#6B7280",
};

/** Simple geographic grid clustering — groups cameras within ~500m */
const CLUSTER_GRID = 0.005; // ~500m in degrees

function getClusterKey(lat: number, lng: number): string {
  return `${Math.round(lat / CLUSTER_GRID)}_${Math.round(lng / CLUSTER_GRID)}`;
}

interface Cluster {
  key: string;
  lat: number;
  lng: number;
  cameras: any[];
  deptId: number;
}

function clusterCameras(cameras: any[], zoom: number): Cluster[] {
  // At high zoom levels (≥14) show individual cameras
  if (zoom >= 14) {
    return cameras.map((c) => ({
      key: c.id,
      lat: c.lat,
      lng: c.lng,
      cameras: [c],
      deptId: c.department_id ?? 0,
    }));
  }

  const grid: Record<string, any[]> = {};
  cameras.forEach((c) => {
    const key = getClusterKey(c.lat, c.lng);
    if (!grid[key]) grid[key] = [];
    grid[key].push(c);
  });

  return Object.entries(grid).map(([key, cams]) => {
    const lat = cams.reduce((s, c) => s + c.lat, 0) / cams.length;
    const lng = cams.reduce((s, c) => s + c.lng, 0) / cams.length;
    // Dominant department in this cluster
    const deptCount: Record<number, number> = {};
    cams.forEach((c) => {
      deptCount[c.department_id ?? 0] = (deptCount[c.department_id ?? 0] || 0) + 1;
    });
    const deptId = Number(
      Object.entries(deptCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0
    );
    return { key, lat, lng, cameras: cams, deptId };
  });
}

function clusterIcon(cluster: Cluster): L.DivIcon {
  const count = cluster.cameras.length;
  const color = DEPT_COLORS[cluster.deptId] || "#6B7280";
  const statusColor =
    cluster.cameras.some((c) => c.status === "online")
      ? STATUS_COLORS.online
      : STATUS_COLORS.offline;

  if (count === 1) {
    const cam = cluster.cameras[0];
    const sc = STATUS_COLORS[cam.status] || "#6B7280";
    return L.divIcon({
      className: "",
      html: `
        <div style="
          width:14px;height:14px;border-radius:50%;
          background:${color};border:2px solid ${sc};
          box-shadow:0 0 6px rgba(0,0,0,0.6);
        "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
    });
  }

  const size = count >= 20 ? 40 : count >= 10 ? 34 : 28;
  return L.divIcon({
    className: "",
    html: `
      <div style="
        width:${size}px;height:${size}px;border-radius:50%;
        background:${color};border:3px solid ${statusColor};
        box-shadow:0 0 10px rgba(0,0,0,0.5);
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:${size <= 28 ? 11 : 13}px;font-weight:bold;
        font-family:monospace;
      ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Component to capture zoom level changes */
function ZoomTracker({ onZoom }: { onZoom: (z: number) => void }) {
  const map = useMap();
  map.on("zoomend", () => onZoom(map.getZoom()));
  return null;
}

interface Props {
  cameras: any[];
}

export default function CameraMap({ cameras }: Props) {
  const center: [number, number] = [23.041, 72.5645]; // Ahmedabad
  const [zoom, setZoom] = useState(12);
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null);
  const [showLegend, setShowLegend] = useState(true);
  const [deptFilter, setDeptFilter] = useState<number | null>(null);

  const filtered = useMemo(
    () =>
      deptFilter
        ? cameras.filter((c) => c.department_id === deptFilter)
        : cameras,
    [cameras, deptFilter]
  );

  const clusters = useMemo(() => clusterCameras(filtered, zoom), [filtered, zoom]);

  const onlineCount = cameras.filter((c) => c.status === "online").length;
  const offlineCount = cameras.filter((c) => c.status === "offline").length;

  // Unique departments in camera list
  const departments = useMemo(() => {
    const seen = new Set<number>();
    cameras.forEach((c) => { if (c.department_id) seen.add(c.department_id); });
    return Array.from(seen);
  }, [cameras]);

  return (
    <div className="h-full rounded-lg overflow-hidden border border-gray-700 relative">
      {/* Overlay stats bar */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-full px-4 py-1.5 text-xs font-mono pointer-events-none">
        <span className="text-green-400">● {onlineCount} online</span>
        <span className="text-gray-500">|</span>
        <span className="text-red-400">● {offlineCount} offline</span>
        <span className="text-gray-500">|</span>
        <span className="text-gray-300">{cameras.length} total</span>
      </div>

      {/* Dept filter buttons — top right */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1">
        <div className="bg-black/70 backdrop-blur-sm rounded-lg p-2 space-y-1">
          <p className="text-[9px] text-gray-400 font-mono uppercase mb-1">Dept Filter</p>
          <button
            onClick={() => setDeptFilter(null)}
            className={`w-full text-left px-2 py-0.5 rounded text-[10px] font-mono ${
              deptFilter === null
                ? "bg-primary-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            All ({cameras.length})
          </button>
          {departments.map((dId) => {
            const count = cameras.filter((c) => c.department_id === dId).length;
            return (
              <button
                key={dId}
                onClick={() => setDeptFilter(deptFilter === dId ? null : dId)}
                className={`w-full text-left px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1.5 ${
                  deptFilter === dId
                    ? "bg-navy-600 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full inline-block"
                  style={{ background: DEPT_COLORS[dId] || "#6B7280" }}
                />
                {DEPT_NAMES[dId] || `Dept ${dId}`} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend toggle */}
      <div className="absolute bottom-6 left-3 z-[1000]">
        <button
          onClick={() => setShowLegend((v) => !v)}
          className="bg-black/70 backdrop-blur-sm rounded px-2 py-1 text-xs text-gray-400 hover:text-white flex items-center gap-1"
        >
          <Layers size={12} />
          Legend
        </button>
        {showLegend && (
          <div className="mt-1 bg-black/80 backdrop-blur-sm rounded-lg p-3 w-44">
            <p className="text-[9px] text-gray-400 uppercase font-mono mb-2">Status</p>
            {Object.entries(STATUS_COLORS).slice(0, 4).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                <span className="text-[10px] text-gray-300 capitalize">{status}</span>
              </div>
            ))}
            <p className="text-[9px] text-gray-400 uppercase font-mono mt-2 mb-1">
              Cluster = multiple cameras
            </p>
            <p className="text-[9px] text-gray-500">Zoom in (≥14) to see individual cams</p>
          </div>
        )}
      </div>

      {/* Camera detail panel when cluster selected */}
      {selectedCluster && (
        <div className="absolute top-12 left-3 z-[1000] bg-black/85 backdrop-blur-sm rounded-lg border border-gray-700 w-64 max-h-[60vh] flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Camera size={12} className="text-primary-400" />
              <span className="text-xs text-white font-semibold">
                {selectedCluster.cameras.length} Camera
                {selectedCluster.cameras.length > 1 ? "s" : ""}
              </span>
            </div>
            <button
              onClick={() => setSelectedCluster(null)}
              className="text-gray-500 hover:text-white"
            >
              <X size={12} />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 px-2 py-1">
            {selectedCluster.cameras.map((cam) => (
              <div
                key={cam.id}
                className="py-2 border-b border-gray-700/50 last:border-0"
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ background: STATUS_COLORS[cam.status] || "#6B7280" }}
                  />
                  <span className="text-xs text-white font-medium">{cam.name}</span>
                </div>
                <p className="text-[10px] text-gray-500 ml-3.5">
                  {cam.location_description || `${cam.lat?.toFixed(4)}, ${cam.lng?.toFixed(4)}`}
                </p>
                <p className="text-[10px] text-gray-600 ml-3.5">
                  {DEPT_NAMES[cam.department_id] || `Dept ${cam.department_id}`} •{" "}
                  {cam.camera_type?.toUpperCase()}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <MapContainer
        center={center}
        zoom={zoom}
        className="h-full w-full"
        style={{ background: "#0f172a" }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomTracker onZoom={setZoom} />

        {clusters.map((cluster) => (
          <Marker
            key={cluster.key}
            position={[cluster.lat, cluster.lng]}
            icon={clusterIcon(cluster)}
            eventHandlers={{
              click: () => setSelectedCluster(cluster),
            }}
          >
            {cluster.cameras.length === 1 && (
              <Popup>
                <div className="text-sm min-w-[180px]">
                  <p className="font-bold text-gray-900">{cluster.cameras[0].name}</p>
                  <p className="text-gray-600 text-xs mt-0.5">
                    {cluster.cameras[0].location_description || cluster.cameras[0].status}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Dept: {DEPT_NAMES[cluster.cameras[0].department_id] || cluster.cameras[0].department_id}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        background:
                          STATUS_COLORS[cluster.cameras[0].status] || "#6B7280",
                      }}
                    />
                    <span className="text-xs capitalize">{cluster.cameras[0].status}</span>
                  </div>
                </div>
              </Popup>
            )}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
