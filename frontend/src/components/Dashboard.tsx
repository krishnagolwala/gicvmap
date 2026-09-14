import { useState, useEffect } from "react";
import { getCameras, getAlertCount } from "../services/api";
import { useAlertWebSocket } from "../hooks/useAlertWebSocket";
import { Circle, Radio, Clock, Search } from "lucide-react";
import Sidebar from "./Sidebar";
import CameraMap from "./CameraMap";
import AlertPanel from "./AlertPanel";
import VideoWall from "./VideoWall";
import VehicleSearch from "./VehicleSearch";
import CameraManagement from "./CameraManagement";
import WatchlistManagement from "./WatchlistManagement";
import Reports from "./Reports";
import AlertToast from "./AlertToast";
import IntegrationsPanel from "./IntegrationsPanel";
import AuditLog from "./AuditLog";
import AIStatusPanel from "./AIStatusPanel";
import AlertRules from "./AlertRules";
import UserManagement from "./UserManagement";

export default function Dashboard() {
  const [screen, setScreen] = useState("map");
  const [cameras, setCameras] = useState<any[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [globalSearch, setGlobalSearch] = useState("");
  const { alerts: realAlerts, connected: wsConnected } = useAlertWebSocket();

  useEffect(() => {
    loadCameras();
    loadAlertCount();
    const interval = setInterval(loadAlertCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadCameras = async () => {
    try {
      const { data } = await getCameras({ per_page: 100 });
      setCameras(data);
    } catch {}
  };

  const loadAlertCount = async () => {
    try {
      const { data } = await getAlertCount("new");
      setAlertCount(data.count);
    } catch {}
  };

  const onlineCount = cameras.filter((c) => c.status === "online").length;
  const offlineCount = cameras.filter((c) => c.status === "offline").length;
  const degradedCount = cameras.filter((c) => c.status === "degraded").length;

  return (
    <div className="flex h-screen bg-navy-900 overflow-hidden">
      {/* Sidebar */}
      <Sidebar active={screen} onSelect={setScreen} alertCount={alertCount} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top status bar */}
        <header className="h-11 bg-navy-800 border-b border-gray-700 flex items-center px-4 justify-between shrink-0">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <Circle size={8} fill="#22C55E" className="text-green-500" />
              <span className="text-gray-400">Online:</span>
              <span className="text-white font-mono">{onlineCount}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Circle size={8} fill="#EF4444" className="text-red-500" />
              <span className="text-gray-400">Offline:</span>
              <span className="text-white font-mono">{offlineCount}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Circle size={8} fill="#F59E0B" className="text-yellow-500" />
              <span className="text-gray-400">Degraded:</span>
              <span className="text-white font-mono">{degradedCount}</span>
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">
              Total: <span className="text-white font-mono">{cameras.length}</span>
            </span>
            <span className="text-gray-600">|</span>
            <span className="text-gray-400">
              Streams: <span className="text-white font-mono">{onlineCount}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            {alertCount > 0 && (
              <span className="bg-red-600 text-white px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                <Radio size={10} />
                {alertCount}
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-full font-mono flex items-center gap-1 ${
                wsConnected
                  ? "bg-green-900/50 text-green-400"
                  : "bg-red-900/50 text-red-400"
              }`}
            >
              <Circle size={6} fill={wsConnected ? "#22C55E" : "#EF4444"} />
              {wsConnected ? "LIVE" : "OFFLINE"}
            </span>
            <span className="text-gray-500 font-mono flex items-center gap-1">
              <Clock size={12} />
              {new Date().toLocaleTimeString("en-IN", { hour12: false })} IST
            </span>
          </div>
        </header>

        {/* Global Quick Search Bar */}
        <div className="px-4 py-2 bg-navy-850 border-b border-gray-700/50 shrink-0">
          <div className="relative max-w-2xl">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && globalSearch.trim()) {
                  setScreen("search");
                }
              }}
              placeholder="Quick search: vehicle plate, camera name, alert..."
              className="w-full pl-9 pr-4 py-1.5 bg-navy-800 border border-gray-600 rounded-lg text-xs text-white focus:outline-none focus:border-primary-500 placeholder-gray-500"
            />
          </div>
        </div>

        {/* Content area */}
        <main className="flex-1 overflow-auto p-4">
          {screen === "map" && (
            <div className="h-full flex gap-4">
              <div className="flex-[7] min-w-0">
                <CameraMap cameras={cameras} />
              </div>
              <div className="flex-[3] min-w-0">
                <AlertPanel embedded />
              </div>
            </div>
          )}
          {screen === "video" && <VideoWall cameras={cameras} realAlerts={realAlerts} />}
          {screen === "search" && <VehicleSearch />}
          {screen === "alerts" && <AlertPanel />}
          {screen === "cameras" && <CameraManagement />}
          {screen === "watchlist" && <WatchlistManagement />}
          {screen === "ai-status" && <AIStatusPanel />}
          {screen === "alert-rules" && <AlertRules />}
          {screen === "integrations" && <IntegrationsPanel />}
          {screen === "users" && <UserManagement />}
          {screen === "admin" && <AuditLog />}
          {screen === "reports" && <Reports />}
        </main>
      </div>

      {/* Real-time alert toast */}
      <AlertToast alerts={realAlerts} />
    </div>
  );
}
