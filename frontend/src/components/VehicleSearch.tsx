import { useState, useEffect, useCallback } from "react";
import { searchVehicle, vehicleTimeline, getRecentVehicles, exportVehicleCsv } from "../services/api";
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, FileDown, FileText, Car, MapPin, RefreshCw, Radar } from "lucide-react";

function createNumberIcon(num: number, color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="width:24px;height:24px;border-radius:50%;background:${color};color:white;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4)">${num}</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

const startIcon = createNumberIcon(1, "#22C55E");
const endIcon = createNumberIcon(99, "#EF4444");

/** Auto-fits map bounds to include all provided points */
function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 14);
      return;
    }
    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [points, map]);
  return null;
}

export default function VehicleSearch() {
  const [plate, setPlate] = useState("");
  const [result, setResult] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const loadRecent = useCallback(async () => {
    setLoadingRecent(true);
    try {
      const res = await getRecentVehicles(30);
      setRecent(res.data || []);
    } catch {
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim()) return;
    setLoading(true);
    setSearched(true);
    setSelectedIdx(null);
    try {
      const [routeRes, timeRes] = await Promise.all([
        searchVehicle({ plate_number: plate }),
        vehicleTimeline(plate),
      ]);
      setResult(routeRes.data);
      setTimeline(timeRes.data);
    } catch {
      setResult(null);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    if (!plate.trim()) return;
    try {
      const res = await exportVehicleCsv(plate);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = `${plate.replace(/\s/g, "")}_sightings.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  };

  const searchRoutePoints = timeline.filter((t) => t.camera_lat && t.camera_lng);
  const recentPoints = recent
    .map((r) => ({ ...r, id: r.detection_id ?? r.id }))
    .filter((t) => t.camera_lat && t.camera_lng);
  const routePoints = searched ? searchRoutePoints : recentPoints;

  const polylinePositions: [number, number][] = routePoints.map((t) => [
    t.camera_lat,
    t.camera_lng,
  ]);

  const mapCenter: [number, number] =
    routePoints.length > 0
      ? [routePoints[0].camera_lat, routePoints[0].camera_lng]
      : [23.041, 72.5645];

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-3 shrink-0">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="Enter Vehicle Registration Number (e.g. GJ01AB1234)"
            className="w-full pl-10 pr-4 py-2.5 bg-navy-800 border border-gray-600 rounded-lg focus:outline-none focus:border-primary-500 text-white uppercase font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 rounded-lg font-medium text-sm disabled:opacity-50 transition flex items-center gap-2"
        >
          <Search size={16} />
          {loading ? "Searching..." : "Search Vehicle"}
        </button>
      </form>

      {/* Plate search results — summary bar */}
      {searched && result && (
        <>
          {/* Summary bar */}
          <div className="bg-navy-800 rounded-lg p-4 border border-gray-700 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Car size={20} className="text-primary-400" />
                <div>
                  <h3 className="text-white font-bold text-lg font-mono">{result.plate_number}</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {result.total_sightings} sightings | First:{" "}
                    {result.first_seen ? new Date(result.first_seen).toLocaleString("en-IN") : "N/A"}{" "}
                    | Last:{" "}
                    {result.last_seen ? new Date(result.last_seen).toLocaleString("en-IN") : "N/A"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-navy-700 text-gray-400 text-xs rounded hover:text-white flex items-center gap-1.5">
                  <FileText size={12} />
                  Export PDF
                </button>
                <button onClick={handleExportCsv} className="px-3 py-1.5 bg-navy-700 text-gray-400 text-xs rounded hover:text-white flex items-center gap-1.5">
                  <FileDown size={12} />
                  Export CSV
                </button>
              </div>
            </div>
          </div>

        </>
      )}

      {/* Live detections header (no search yet) */}
      {!searched && recentPoints.length > 0 && (
        <div className="bg-navy-800 rounded-lg p-4 border border-gray-700 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Radar size={20} className="text-emerald-400" />
            <div>
              <h3 className="text-white font-bold text-lg">Live Vehicle Detections</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {recentPoints.length} recent detections from AI processing — live camera data
              </p>
            </div>
          </div>
          <button
            onClick={loadRecent}
            disabled={loadingRecent}
            className="px-3 py-1.5 bg-navy-700 text-gray-400 text-xs rounded hover:text-white flex items-center gap-1.5 disabled:opacity-50 transition"
          >
            <RefreshCw size={12} className={loadingRecent ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      )}

      {/* Map + Timeline split — shared by search results and live detections */}
      {(searched && result && result.total_sightings > 0) ||
      (!searched && recentPoints.length > 0) ? (
        <div className="flex-1 flex gap-4 min-h-0">
            {/* Map 60% */}
            <div className="flex-[6] min-w-0 rounded-lg overflow-hidden border border-gray-700">
              <MapContainer
                center={mapCenter}
                zoom={12}
                className="h-full w-full"
                style={{ background: "#0f172a" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {polylinePositions.length > 0 && (
                  <FitBounds points={polylinePositions} />
                )}
                {polylinePositions.length > 1 && (
                  <Polyline
                    positions={polylinePositions}
                    pathOptions={{ color: "#3b82f6", weight: 3, opacity: 0.8 }}
                  />
                )}
                {routePoints.map((t, i) => (
                  <Marker
                    key={t.id}
                    position={[t.camera_lat, t.camera_lng]}
                    icon={
                      i === 0
                        ? startIcon
                        : i === routePoints.length - 1
                        ? endIcon
                        : createNumberIcon(i + 1, "#3b82f6")
                    }
                    eventHandlers={{ click: () => setSelectedIdx(i) }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold">{t.camera_name}</p>
                        <p className="text-gray-600">
                          {new Date(t.detected_at).toLocaleString("en-IN")}
                        </p>
                        {t.plate_confidence && (
                          <p className="text-xs text-gray-500">
                            Confidence: {(t.plate_confidence * 100).toFixed(0)}%
                          </p>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* Timeline 40% */}
            <div className="flex-[4] min-w-0 bg-navy-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-gray-700 shrink-0">
                <h4 className="text-sm font-semibold text-white">
                  Route Timeline ({routePoints.length} points)
                </h4>
              </div>
              <div className="flex-1 overflow-y-auto">
                {routePoints.map((t, i) => (
                  <div
                    key={t.id}
                    onClick={() => setSelectedIdx(i)}
                    className={`px-4 py-3 border-b border-gray-700/50 cursor-pointer transition ${
                      selectedIdx === i
                        ? "bg-primary-600/10 border-l-2 border-l-primary-500"
                        : "hover:bg-navy-700/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{
                          background:
                            i === 0 ? "#22C55E" : i === routePoints.length - 1 ? "#EF4444" : "#3b82f6",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">
                        {new Date(t.detected_at).toLocaleTimeString("en-IN")}
                      </span>
                    </div>
                    <p className="text-sm text-white ml-7">{t.camera_name}</p>
                    <p className="text-xs text-gray-500 ml-7 flex items-center gap-1">
                      <MapPin size={10} />
                      {t.camera_location || ""}
                      {t.plate_confidence && (
                        <span className="ml-2">
                          | {(t.plate_confidence * 100).toFixed(0)}%
                        </span>
                      )}
                    </p>
                  </div>
                ))}
                {routePoints.length === 0 && (
                  <div className="text-center text-gray-500 py-8 text-sm">
                    No route data with coordinates
                  </div>
                )}
              </div>
            </div>
        </div>
      ) : null}
      {!searched && loadingRecent && recentPoints.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-gray-600">
          <div className="text-center">
            <Radar size={48} className="mx-auto mb-4 text-gray-600 animate-pulse" />
            <p className="text-lg">Loading live detections…</p>
            <p className="text-sm mt-2 text-gray-500">Fetching the latest AI detections from cameras</p>
          </div>
        </div>
      )}

      {searched && (!result || result.total_sightings === 0) && !loading && (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Search size={48} className="mx-auto mb-4 text-gray-600" />
            <p className="text-lg">No sightings found</p>
            <p className="text-sm mt-2 text-gray-500">Try a different plate number</p>
          </div>
        </div>
      )}

      {!searched && recentPoints.length === 0 && !loadingRecent && (
        <div className="flex-1 flex items-center justify-center text-gray-600">
          <div className="text-center">
            <Car size={48} className="mx-auto mb-4 text-gray-600" />
            <p className="text-lg">Enter a vehicle registration number to track its route</p>
            <p className="text-sm mt-2 text-gray-500">
              The system will show all camera detections and plot the route on the map
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
