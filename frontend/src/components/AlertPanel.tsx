import { useState, useEffect } from "react";
import { getAlerts, acknowledgeAlert, dismissAlert } from "../services/api";
import {
  Bell,
  Search,
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Circle,
  Eye,
} from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "border-red-500 bg-red-900/20",
  high: "border-orange-500 bg-orange-900/20",
  medium: "border-yellow-500 bg-yellow-900/20",
  low: "border-gray-500 bg-gray-800/30",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-gray-500",
};

interface Props {
  embedded?: boolean;
}

export default function AlertPanel({ embedded }: Props) {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [filter, setFilter] = useState("new");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [detailAlert, setDetailAlert] = useState<any>(null);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 10000);
    return () => clearInterval(interval);
  }, [filter]);

  const loadAlerts = async () => {
    try {
      const { data } = await getAlerts({ status: filter, per_page: 100 });
      setAlerts(Array.isArray(data) ? data : data.items || []);
    } catch {}
  };

  const handleAck = async (id: number) => {
    await acknowledgeAlert(id);
    loadAlerts();
  };

  const handleDismiss = async (id: number) => {
    await dismissAlert(id);
    loadAlerts();
  };

  const filtered = alerts.filter((a) => {
    if (severityFilter !== "all" && a.severity !== severityFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !(a.plate_number || "").toLowerCase().includes(q) &&
        !(a.camera_name || "").toLowerCase().includes(q) &&
        !(a.watchlist_reason || "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const newCount = alerts.filter((a) => a.status === "new").length;
  const ackCount = alerts.filter((a) => a.status === "acknowledged").length;

  if (embedded) {
    return (
      <div className="h-full flex flex-col bg-navy-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-700 shrink-0 flex items-center gap-2">
          <Bell size={14} className="text-primary-400" />
          <h3 className="text-xs font-semibold text-white uppercase">Live Alerts</h3>
        </div>
        <div className="flex-1 overflow-y-auto">
          {alerts.length === 0 && (
            <p className="text-gray-500 text-xs text-center py-6">No alerts</p>
          )}
          {alerts.slice(0, 20).map((alert) => (
            <div
              key={alert.id}
              className="px-3 py-2.5 border-b border-gray-700/50 cursor-pointer hover:bg-navy-700/50 transition"
              onClick={() => setDetailAlert(alert)}
            >
              <div className="flex items-center gap-2 mb-0.5">
                <Circle size={6} fill={alert.severity === 'high' || alert.severity === 'critical' ? '#EF4444' : '#F59E0B'} className={alert.severity === 'high' || alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'} />
                <span className="text-xs font-mono text-gray-400">
                  {new Date(alert.triggered_at).toLocaleTimeString("en-IN", { hour12: false })}
                </span>
              </div>
              <p className="text-sm text-white font-medium font-mono">{alert.plate_number || "—"}</p>
              <p className="text-[10px] text-gray-500 truncate">{alert.camera_name}</p>
              <p className="text-[10px] text-gray-500 truncate">{alert.watchlist_reason}</p>
            </div>
          ))}
        </div>
        {detailAlert && (
          <AlertDetailModal alert={detailAlert} onClose={() => setDetailAlert(null)} onAck={handleAck} onDismiss={handleDismiss} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
          {["new", "acknowledged", "dismissed", "all"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 text-sm rounded flex items-center gap-1.5 ${
                filter === s ? "bg-primary-600 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {s === "new" && <Bell size={12} />}
              {s === "acknowledged" && <CheckCircle size={12} />}
              {s === "dismissed" && <XCircle size={12} />}
              {s.charAt(0).toUpperCase() + s.slice(1)}
              {s === "new" && newCount > 0 && (
                <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                  {newCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="bg-navy-800 border border-gray-600 rounded px-3 py-1.5 text-sm text-white"
        >
          <option value="all">All Severity</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plate, camera..."
            className="pl-9 pr-3 py-1.5 bg-navy-800 border border-gray-600 rounded text-sm text-white w-52 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4">
        <div className="bg-navy-800 rounded-lg px-4 py-2 border border-gray-700 flex items-center gap-2">
          <Circle size={8} fill="#EF4444" className="text-red-500" />
          <span className="text-xs text-gray-400">New</span>
          <span className="text-red-400 font-bold font-mono">{newCount}</span>
        </div>
        <div className="bg-navy-800 rounded-lg px-4 py-2 border border-gray-700 flex items-center gap-2">
          <CheckCircle size={12} className="text-yellow-400" />
          <span className="text-xs text-gray-400">Acknowledged</span>
          <span className="text-yellow-400 font-bold font-mono">{ackCount}</span>
        </div>
        <div className="bg-navy-800 rounded-lg px-4 py-2 border border-gray-700">
          <span className="text-xs text-gray-400">Shown</span>
          <span className="ml-2 text-white font-bold font-mono">{filtered.length}</span>
        </div>
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-gray-500 text-center py-8">No alerts match filters</p>
        )}
        {filtered.map((alert) => (
          <div
            key={alert.id}
            className={`p-4 rounded-lg border-l-4 ${
              SEVERITY_COLORS[alert.severity] || "bg-navy-800 border-gray-500"
            }`}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Circle size={6} fill={alert.severity === 'high' || alert.severity === 'critical' ? '#EF4444' : '#F59E0B'} className={alert.severity === 'high' || alert.severity === 'critical' ? 'text-red-500' : 'text-yellow-500'} />
                  <span className="text-xs font-bold uppercase text-gray-400">{alert.severity}</span>
                  <span className="text-xs text-gray-500">{alert.match_type}</span>
                  <span className="text-xs text-gray-500 font-mono">
                    {new Date(alert.triggered_at).toLocaleString("en-IN")}
                  </span>
                </div>
                <p className="font-medium text-white font-mono">{alert.plate_number || "N/A"}</p>
                <p className="text-sm text-gray-400 mt-0.5">{alert.watchlist_reason || "Alert triggered"}</p>
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Eye size={10} />
                  {alert.camera_name || "Unknown"}
                  {alert.match_confidence && (
                    <span className="ml-2">| {(alert.match_confidence * 100).toFixed(0)}% confidence</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2 ml-4">
                {alert.status === "new" && (
                  <>
                    <button
                      onClick={() => handleAck(alert.id)}
                      className="px-3 py-1 text-xs bg-green-600 hover:bg-green-700 rounded flex items-center gap-1"
                    >
                      <CheckCircle size={12} />
                      Ack
                    </button>
                    <button
                      onClick={() => handleDismiss(alert.id)}
                      className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 rounded flex items-center gap-1"
                    >
                      <XCircle size={12} />
                      Dismiss
                    </button>
                  </>
                )}
                {alert.status === "acknowledged" && (
                  <span className="text-xs text-yellow-400 py-1 flex items-center gap-1">
                    <CheckCircle size={12} />
                    Acknowledged
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {detailAlert && (
        <AlertDetailModal alert={detailAlert} onClose={() => setDetailAlert(null)} onAck={handleAck} onDismiss={handleDismiss} />
      )}
    </div>
  );
}

function AlertDetailModal({
  alert,
  onClose,
  onAck,
  onDismiss,
}: {
  alert: any;
  onClose: () => void;
  onAck: (id: number) => void;
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-navy-800 border border-gray-600 rounded-xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertTriangle size={18} className="text-yellow-400" />
            Alert Details
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-gray-400">Alert ID:</span>
              <span className="ml-2 text-white font-mono">ALT-{alert.id}</span>
            </div>
            <div>
              <span className="text-gray-400">Severity:</span>
              <span className={`ml-2 font-bold uppercase ${alert.severity === 'critical' || alert.severity === 'high' ? 'text-red-400' : 'text-yellow-400'}`}>
                {alert.severity}
              </span>
            </div>
            <div>
              <span className="text-gray-400">Triggered:</span>
              <span className="ml-2 text-white">{new Date(alert.triggered_at).toLocaleString("en-IN")}</span>
            </div>
            <div>
              <span className="text-gray-400">Match Type:</span>
              <span className="ml-2 text-white">{alert.match_type}</span>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-3">
            <p className="text-xs text-gray-400 uppercase mb-2">Vehicle Detected</p>
            <div className="bg-navy-900 rounded-lg p-3">
              <p className="text-white font-mono font-bold text-lg">{alert.plate_number || "N/A"}</p>
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <Eye size={10} />
                {alert.camera_name || "Unknown"}
                {alert.match_confidence && (
                  <span className="ml-2">| Confidence: {(alert.match_confidence * 100).toFixed(0)}%</span>
                )}
              </p>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-3">
            <p className="text-xs text-gray-400 uppercase mb-2">Watchlist Match</p>
            <div className="bg-navy-900 rounded-lg p-3">
              <p className="text-sm text-white">{alert.watchlist_reason || "No reason specified"}</p>
              {alert.watchlist_category && (
                <p className="text-xs text-gray-400 mt-1">Category: {alert.watchlist_category}</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          {alert.status === "new" && (
            <>
              <button
                onClick={() => { onAck(alert.id); onClose(); }}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg flex items-center gap-2"
              >
                <CheckCircle size={14} />
                Acknowledge
              </button>
              <button
                onClick={() => { onDismiss(alert.id); onClose(); }}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded-lg flex items-center gap-2"
              >
                <XCircle size={14} />
                Dismiss
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-navy-700 text-gray-300 text-sm rounded-lg hover:bg-navy-600 ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
