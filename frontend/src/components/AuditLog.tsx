import { useState, useEffect } from "react";
import {
  getAuditLogs,
  getAuditStats,
  getSystemSecurity,
} from "../services/api";
import {
  Shield,
  RefreshCw,
  Search,
  Lock,
  Network,
  Key,
  Eye,
  UserCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  FileText,
  Globe,
  Server,
  Database,
  ShieldCheck,
} from "lucide-react";

const ACTION_COLORS: Record<string, string> = {
  create: "text-green-400 bg-green-900/30",
  update: "text-blue-400 bg-blue-900/30",
  delete: "text-red-400 bg-red-900/30",
  read: "text-gray-400 bg-gray-800/50",
};

const SEGMENT_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"];

export default function AuditLog() {
  const [activeTab, setActiveTab] = useState<"audit" | "security" | "sessions" | "settings">("audit");
  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any[]>([]);
  const [security, setSecurity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [searchActor, setSearchActor] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes, secRes] = await Promise.allSettled([
        getAuditLogs({ per_page: 100, action: actionFilter || undefined, entity: entityFilter || undefined, actor: searchActor || undefined }),
        getAuditStats(),
        getSystemSecurity(),
      ]);
      if (logsRes.status === "fulfilled") setLogs(logsRes.value.data);
      if (statsRes.status === "fulfilled") setStats(statsRes.value.data);
      if (secRes.status === "fulfilled") setSecurity(secRes.value.data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [actionFilter, entityFilter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-primary-400" />
          <h2 className="text-lg font-semibold text-white">
            Administration & Security
          </h2>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-3 py-1.5 bg-navy-700 text-gray-400 text-sm rounded hover:text-white flex items-center gap-1.5"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
        {(["audit", "security", "sessions", "settings"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm rounded transition ${
              activeTab === tab
                ? "bg-primary-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "audit" ? "Audit Logs" : tab === "security" ? "Security & Network" : tab === "sessions" ? "Sessions" : "System Settings"}
          </button>
        ))}
      </div>

      {/* ── Audit Logs Tab ───────────────────────────────────────────── */}
      {activeTab === "audit" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
              />
              <input
                value={searchActor}
                onChange={(e) => setSearchActor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadData()}
                placeholder="Search actor..."
                className="pl-9 pr-3 py-2 bg-navy-800 border border-gray-600 rounded-lg text-sm text-white w-48"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="bg-navy-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
            </select>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="bg-navy-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            >
              <option value="">All Entities</option>
              <option value="camera">Camera</option>
              <option value="watchlist">Watchlist</option>
              <option value="alert">Alert</option>
              <option value="user">User</option>
            </select>
          </div>

          {/* Audit Stats */}
          {stats.length > 0 && (
            <div className="grid grid-cols-6 gap-2">
              {stats.slice(0, 6).map((s, i) => (
                <div
                  key={i}
                  className="bg-navy-800 rounded-lg p-3 border border-gray-700"
                >
                  <p className="text-xs text-gray-500 uppercase">
                    {s.action} {s.entity}
                  </p>
                  <p className="text-lg font-bold font-mono text-white">
                    {s.count}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Log Table */}
          <div className="bg-navy-800 rounded-lg border border-gray-700 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-navy-900 text-gray-400 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Actor</th>
                  <th className="px-4 py-3 text-left">Action</th>
                  <th className="px-4 py-3 text-left">Entity</th>
                  <th className="px-4 py-3 text-left">Entity ID</th>
                  <th className="px-4 py-3 text-left">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-navy-700/50">
                    <td className="px-4 py-2 text-gray-400 font-mono text-xs">
                      {new Date(log.created_at).toLocaleString("en-IN", {
                        hour12: false,
                      })}
                    </td>
                    <td className="px-4 py-2 text-white flex items-center gap-1.5">
                      <UserCheck size={12} className="text-gray-500" />
                      {log.actor}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          ACTION_COLORS[log.action] || ""
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-300">{log.entity}</td>
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                      {log.entity_id || "—"}
                    </td>
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                      {log.actor_ip || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No audit logs found
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Security Tab ─────────────────────────────────────────────── */}
      {activeTab === "security" && security && (
        <div className="space-y-4">
          {/* Encryption Status */}
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Lock size={14} className="text-green-400" />
              Encryption Status
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(security.encryption).map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 p-2 rounded bg-navy-900/50"
                >
                  <CheckCircle size={12} className="text-green-400 shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 capitalize">
                      {key.replace(/_/g, " ")}
                    </p>
                    <p className="text-sm text-white font-mono">
                      {String(val)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Network Segmentation */}
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Network size={14} className="text-blue-400" />
              Network Segmentation
            </h3>
            <div className="space-y-3">
              {security.network.segments.map(
                (seg: any, i: number) => (
                  <div
                    key={seg.name}
                    className="p-3 rounded border-l-4 bg-navy-900/50"
                    style={{ borderLeftColor: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white">
                            {seg.name}
                          </span>
                          <span className="text-xs text-gray-500 font-mono">
                            {seg.vlan}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">{seg.description}</p>
                        <div className="flex gap-1.5 mt-1.5 flex-wrap">
                          {seg.services.map((svc: string) => (
                            <span
                              key={svc}
                              className="text-[10px] px-2 py-0.5 rounded bg-navy-700 text-gray-300"
                            >
                              {svc}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Access Control */}
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Key size={14} className="text-yellow-400" />
              Access Control (RBAC)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(security.access_control).map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 p-2 rounded bg-navy-900/50"
                >
                  <ShieldCheck
                    size={12}
                    className="text-yellow-400 shrink-0"
                  />
                  <div>
                    <p className="text-xs text-gray-400 capitalize">
                      {key.replace(/_/g, " ")}
                    </p>
                    <p className="text-sm text-white font-mono">
                      {Array.isArray(val)
                        ? val.join(", ")
                        : String(val)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Network Config */}
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Globe size={14} className="text-purple-400" />
              Network Security
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Server, label: "Reverse Proxy", value: security.network.nginx_reverse_proxy ? "NGINX" : "None" },
                { icon: Lock, label: "SSL Termination", value: security.network.ssl_termination ? "Enabled" : "Disabled" },
                { icon: Globe, label: "HTTPS Redirect", value: security.network.http_to_https_redirect ? "HTTP → HTTPS" : "None" },
                { icon: Shield, label: "HSTS", value: security.network.hsts_enabled ? "Enabled" : "Disabled" },
                { icon: Database, label: "Rate Limiting", value: security.network.rate_limiting },
                { icon: Eye, label: "CORS", value: security.network.cors_origins },
              ].map((item) => (
                <div
                  key={item.label}
                  className="p-3 rounded bg-navy-900/50 border border-gray-700/50"
                >
                  <item.icon size={14} className="text-gray-500 mb-1" />
                  <p className="text-xs text-gray-400">{item.label}</p>
                  <p className="text-sm text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><UserCheck size={14} className="text-blue-400" />Active Sessions</h3>
            <table className="w-full text-sm">
              <thead className="text-gray-400 text-xs uppercase"><tr><th className="text-left py-2">User</th><th className="text-left py-2">IP Address</th><th className="text-left py-2">Login Time</th><th className="text-left py-2">Last Active</th><th className="text-left py-2">Role</th><th className="text-right py-2">Actions</th></tr></thead>
              <tbody className="divide-y divide-gray-700/50">
                {[
                  { user: "admin", ip: "192.168.1.100", login: "2026-09-12 13:20", active: "2026-09-12 13:40", role: "superadmin" },
                  { user: "operator1", ip: "192.168.1.105", login: "2026-09-12 08:00", active: "2026-09-12 13:35", role: "operator" },
                  { user: "viewer_ops", ip: "10.0.2.50", login: "2026-09-12 09:15", active: "2026-09-12 13:38", role: "viewer" },
                ].map(s => (
                  <tr key={s.user} className="hover:bg-navy-700/50">
                    <td className="py-2 text-white font-medium">{s.user}</td>
                    <td className="py-2 text-gray-400 font-mono text-xs">{s.ip}</td>
                    <td className="py-2 text-gray-400 text-xs">{s.login}</td>
                    <td className="py-2 text-gray-400 text-xs">{s.active}</td>
                    <td className="py-2"><span className="text-xs px-2 py-0.5 rounded bg-navy-700 text-gray-300 capitalize">{s.role}</span></td>
                    <td className="py-2 text-right"><button className="text-xs text-red-400 hover:text-red-300">Force Logout</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Session Policies</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Session Timeout", value: "60 minutes", desc: "Auto-logout after inactivity" },
                { label: "Max Concurrent Sessions", value: "3 per user", desc: "Prevents credential sharing" },
                { label: "Force Logout All", value: "Available", desc: "Superadmin can revoke all sessions" },
              ].map(p => (
                <div key={p.label} className="p-3 rounded bg-navy-900/50"><p className="text-xs text-gray-400">{p.label}</p><p className="text-sm text-white font-semibold">{p.value}</p><p className="text-[10px] text-gray-600 mt-1">{p.desc}</p></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Key size={14} className="text-yellow-400" />Global System Settings</h3>
            <div className="space-y-3">
              {[
                { key: "ai.fps_default", label: "AI Frame Sampling Rate", value: "2 FPS", desc: "Frames per second to sample for AI inference" },
                { key: "ai.confidence_threshold", label: "Detection Confidence Threshold", value: "50%", desc: "Minimum confidence to persist a detection" },
                { key: "ai.plate_confidence_threshold", label: "Plate OCR Threshold", value: "60%", desc: "Minimum confidence for plate recognition" },
                { key: "ai.face_similarity_threshold", label: "Face Match Threshold", value: "60%", desc: "Minimum cosine similarity for face match" },
                { key: "ai.max_concurrent_cameras", label: "Max Concurrent Cameras", value: "20", desc: "Maximum cameras for simultaneous AI processing" },
                { key: "alert.push_enabled", label: "Real-time Alert Push", value: "Enabled", desc: "WebSocket broadcast for new alerts" },
                { key: "camera.health_check_interval_seconds", label: "Health Check Interval", value: "30s", desc: "Camera health polling frequency" },
                { key: "camera.reconnect_delays", label: "Reconnect Delays", value: "5, 10, 30, 60s", desc: "Exponential backoff for RTSP reconnection" },
              ].map(s => (
                <div key={s.key} className="flex items-center gap-4 p-3 rounded bg-navy-900/50 border border-gray-700/50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{s.label}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{s.key}</p>
                  </div>
                  <span className="text-sm text-primary-400 font-mono bg-navy-700 px-3 py-1 rounded">{s.value}</span>
                  <p className="text-[10px] text-gray-500 w-48 text-right">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Storage & Retention</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Detection Retention", value: "90 days", icon: "🗄️" },
                { label: "Alert Retention", value: "365 days", icon: "📋" },
                { label: "Audit Log Retention", value: "730 days", icon: "📝" },
                { label: "Snapshot Storage", value: "MinIO (S3)", icon: "💾" },
                { label: "Backup Schedule", value: "Daily 2:00 AM", icon: "🔄" },
                { label: "DR Status", value: "Standby", icon: "🛡️" },
              ].map(s => (
                <div key={s.label} className="p-3 rounded bg-navy-900/50"><p className="text-xs text-gray-400">{s.icon} {s.label}</p><p className="text-sm text-white font-semibold">{s.value}</p></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
