import { useState, useEffect } from "react";
import {
  getIntegrationStatus,
  getAdapters,
  vahanLookup,
  sarthiAlerts,
  egujcopFirs,
  correlateEvents,
} from "../services/api";
import {
  Plug,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Link,
  Database,
  Shield,
  Wifi,
  Car,
  User,
  FileText,
  Fingerprint,
  ChevronRight,
  Globe,
  Send,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  connected: "text-green-400 bg-green-900/30",
  mock: "text-yellow-400 bg-yellow-900/30",
  degraded: "text-orange-400 bg-orange-900/30",
  disconnected: "text-red-400 bg-red-900/30",
  active: "text-green-400 bg-green-900/30",
  available: "text-gray-400 bg-gray-800/50",
};

const SYSTEM_ICONS: Record<string, any> = {
  VAHAN: Database,
  SARTHI: User,
  eGujCop: FileText,
  AFIS: Fingerprint,
  NAFIS: Shield,
  SENTINEL: Wifi,
};

export default function IntegrationsPanel() {
  const [statuses, setStatuses] = useState<any[]>([]);
  const [adapters, setAdapters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "vahan" | "sarthi" | "egujcop" | "correlate" | "api-gateway" | "webhooks"
  >("overview");

  // VAHAN lookup
  const [vahanPlate, setVahanPlate] = useState("");
  const [vahanResult, setVahanResult] = useState<any>(null);
  const [vahanLoading, setVahanLoading] = useState(false);

  // SARTHI alerts
  const [sarthiData, setSarthiData] = useState<any[]>([]);
  const [sarthiLoading, setSarthiLoading] = useState(false);

  // eGujCop FIRs
  const [egujcopData, setEgujcopData] = useState<any[]>([]);
  const [egujcopLoading, setEgujcopLoading] = useState(false);

  // Correlation
  const [corrPlate, setCorrPlate] = useState("");
  const [corrResult, setCorrResult] = useState<any>(null);
  const [corrLoading, setCorrLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.allSettled([
        getIntegrationStatus(),
        getAdapters(),
      ]);
      if (sRes.status === "fulfilled") setStatuses(sRes.value.data);
      if (aRes.status === "fulfilled") setAdapters(aRes.value.data);
    } catch {}
    setLoading(false);
  };

  const handleVahan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vahanPlate.trim()) return;
    setVahanLoading(true);
    try {
      const { data } = await vahanLookup(vahanPlate);
      setVahanResult(data);
    } catch {
      setVahanResult(null);
    }
    setVahanLoading(false);
  };

  const handleSarthi = async () => {
    setSarthiLoading(true);
    try {
      const { data } = await sarthiAlerts();
      setSarthiData(data);
    } catch {
      setSarthiData([]);
    }
    setSarthiLoading(false);
  };

  const handleEgujcop = async () => {
    setEgujcopLoading(true);
    try {
      const { data } = await egujcopFirs();
      setEgujcopData(data);
    } catch {
      setEgujcopData([]);
    }
    setEgujcopLoading(false);
  };

  const handleCorrelate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corrPlate.trim()) return;
    setCorrLoading(true);
    try {
      const { data } = await correlateEvents(corrPlate);
      setCorrResult(data);
    } catch {
      setCorrResult(null);
    }
    setCorrLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plug size={20} className="text-primary-400" />
          <h2 className="text-lg font-semibold text-white">
            Integrations & APIs
          </h2>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="px-3 py-1.5 bg-navy-700 text-gray-400 text-sm rounded hover:text-white flex items-center gap-1.5"
        >
          <RefreshCw
            size={14}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
        {(
          ["overview", "vahan", "sarthi", "egujcop", "correlate", "api-gateway", "webhooks"] as const
        ).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-sm rounded transition ${
              activeTab === tab
                ? "bg-primary-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab === "overview"
              ? "Overview"
              : tab === "vahan"
              ? "VAHAN"
              : tab === "sarthi"
              ? "SARTHI"
              : tab === "egujcop"
              ? "eGujCop"
              : tab === "correlate"
              ? "Cross-System"
              : tab === "api-gateway"
              ? "API Gateway"
              : "Webhooks"}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Integration Status Cards */}
          <div className="grid grid-cols-3 gap-3">
            {statuses.map((s) => {
              const Icon = SYSTEM_ICONS[s.system] || Plug;
              return (
                <div
                  key={s.system}
                  className="bg-navy-800 rounded-lg border border-gray-700 p-4"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-navy-700 flex items-center justify-center">
                      <Icon size={20} className="text-primary-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {s.name}
                      </p>
                      <p className="text-[10px] text-gray-500">
                        {s.adapter_type.toUpperCase()} · v{s.api_version}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        STATUS_COLORS[s.status] || STATUS_COLORS.disconnected
                      }`}
                    >
                      {s.status === "connected" ? (
                        <CheckCircle size={10} className="inline mr-1" />
                      ) : s.status === "mock" ? (
                        <AlertTriangle size={10} className="inline mr-1" />
                      ) : (
                        <XCircle size={10} className="inline mr-1" />
                      )}
                      {s.status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {s.records_synced} records
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-2 line-clamp-2">
                    {s.description}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Adapter Registry */}
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Link size={14} className="text-primary-400" />
              VMS Adapter Registry
            </h3>
            <div className="space-y-2">
              {adapters.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-3 px-3 py-2 rounded bg-navy-900/50"
                >
                  <Wifi size={14} className="text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white">{a.name}</p>
                    <p className="text-[10px] text-gray-500">
                      {a.vendor} · {a.protocol}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      STATUS_COLORS[a.status] || ""
                    }`}
                  >
                    {a.status}
                  </span>
                  <ChevronRight size={14} className="text-gray-600" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VAHAN Tab */}
      {activeTab === "vahan" && (
        <div className="space-y-4">
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Database size={14} className="text-blue-400" />
              VAHAN Vehicle Registration Lookup
            </h3>
            <form onSubmit={handleVahan} className="flex gap-3">
              <input
                value={vahanPlate}
                onChange={(e) => setVahanPlate(e.target.value.toUpperCase())}
                placeholder="Enter plate number (e.g. GJ01AB1234)"
                className="flex-1 bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono"
              />
              <button
                type="submit"
                disabled={vahanLoading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded flex items-center gap-2 disabled:opacity-50"
              >
                <Search size={14} />
                {vahanLoading ? "Looking up..." : "Lookup"}
              </button>
            </form>

            {vahanResult && (
              <div className="mt-4 bg-navy-900 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Car size={20} className="text-primary-400" />
                  <div>
                    <p className="text-white font-mono font-bold text-lg">
                      {vahanResult.plate_number}
                    </p>
                    <p className="text-xs text-gray-400">
                      {vahanResult.manufacturer} {vahanResult.model} ·{" "}
                      {vahanResult.fuel_type}
                    </p>
                  </div>
                  <span
                    className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                      vahanResult.status === "stolen"
                        ? "bg-red-900/50 text-red-400"
                        : "bg-green-900/50 text-green-400"
                    }`}
                  >
                    {vahanResult.status.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Owner", vahanResult.owner_name],
                    ["Father", vahanResult.owner_father_name],
                    ["Class", vahanResult.vehicle_class],
                    ["RTO", vahanResult.rto_code],
                    ["Registered", vahanResult.registration_date],
                    ["Fitness Upto", vahanResult.fitness_upto],
                    ["Insurance Upto", vahanResult.insurance_upto],
                    ["PUCC Upto", vahanResult.pucc_upto],
                  ].map(([label, val]) => (
                    <div key={label}>
                      <span className="text-gray-500">{label}:</span>{" "}
                      <span className="text-white">{val || "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SARTHI Tab */}
      {activeTab === "sarthi" && (
        <div className="space-y-4">
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <User size={14} className="text-purple-400" />
                SARTHI Person Alert System
              </h3>
              <button
                onClick={handleSarthi}
                disabled={sarthiLoading}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded flex items-center gap-1.5"
              >
                <RefreshCw
                  size={12}
                  className={sarthiLoading ? "animate-spin" : ""}
                />
                Fetch Alerts
              </button>
            </div>

            {sarthiData.length > 0 && (
              <div className="space-y-2">
                {sarthiData.map((a) => (
                  <div
                    key={a.person_id}
                    className="p-3 rounded bg-navy-900/50 border border-gray-700/50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          a.severity === "high"
                            ? "bg-red-900/50 text-red-400"
                            : "bg-yellow-900/50 text-yellow-400"
                        }`}
                      >
                        {a.alert_type.toUpperCase()}
                      </span>
                      <span className="text-sm text-white font-medium">
                        {a.name}
                      </span>
                      <span className="text-xs text-gray-500 ml-auto">
                        {a.district}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{a.description}</p>
                    {a.source_case && (
                      <p className="text-[10px] text-gray-600 mt-1">
                        Case: {a.source_case}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {sarthiData.length === 0 && !sarthiLoading && (
              <p className="text-gray-500 text-sm text-center py-6">
                Click "Fetch Alerts" to query SARTHI
              </p>
            )}
          </div>
        </div>
      )}

      {/* eGujCop Tab */}
      {activeTab === "egujcop" && (
        <div className="space-y-4">
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <FileText size={14} className="text-orange-400" />
                eGujCop FIR System
              </h3>
              <button
                onClick={handleEgujcop}
                disabled={egujcopLoading}
                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded flex items-center gap-1.5"
              >
                <RefreshCw
                  size={12}
                  className={egujcopLoading ? "animate-spin" : ""}
                />
                Fetch FIRs
              </button>
            </div>

            {egujcopData.length > 0 && (
              <div className="space-y-2">
                {egujcopData.map((f) => (
                  <div
                    key={f.fir_number}
                    className="p-3 rounded bg-navy-900/50 border border-gray-700/50"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-white font-mono font-bold">
                        {f.fir_number}
                      </span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          f.status === "under_investigation"
                            ? "bg-yellow-900/50 text-yellow-400"
                            : f.status === "chargesheeted"
                            ? "bg-green-900/50 text-green-400"
                            : "bg-blue-900/50 text-blue-400"
                        }`}
                      >
                        {f.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs mt-2">
                      <div>
                        <span className="text-gray-500">District:</span>{" "}
                        <span className="text-white">{f.district}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">PS:</span>{" "}
                        <span className="text-white">{f.police_station}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">IPC:</span>{" "}
                        <span className="text-white">{f.ipc_sections}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Date:</span>{" "}
                        <span className="text-white">
                          {f.date_of_occurrence}
                        </span>
                      </div>
                    </div>
                    {f.vehicle_involved && (
                      <p className="text-[10px] text-gray-500 mt-1">
                        Vehicle:{" "}
                        <span className="text-orange-400 font-mono">
                          {f.vehicle_involved}
                        </span>
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {egujcopData.length === 0 && !egujcopLoading && (
              <p className="text-gray-500 text-sm text-center py-6">
                Click "Fetch FIRs" to query eGujCop
              </p>
            )}
          </div>
        </div>
      )}

      {/* Cross-System Correlation Tab */}
      {activeTab === "correlate" && (
        <div className="space-y-4">
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Shield size={14} className="text-primary-400" />
              Cross-System Event Correlation
            </h3>
            <p className="text-xs text-gray-400 mb-3">
              Query a vehicle plate across all connected systems (VAHAN, SARTHI,
              eGujCop, AFIS, NAFIS) and view a unified event timeline.
            </p>
            <form onSubmit={handleCorrelate} className="flex gap-3">
              <input
                value={corrPlate}
                onChange={(e) => setCorrPlate(e.target.value.toUpperCase())}
                placeholder="Enter plate number (e.g. GJ01AB1234)"
                className="flex-1 bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono"
              />
              <button
                type="submit"
                disabled={corrLoading}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm rounded flex items-center gap-2 disabled:opacity-50"
              >
                <Search size={14} />
                {corrLoading ? "Correlating..." : "Correlate"}
              </button>
            </form>

            {corrResult && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <Car size={16} className="text-primary-400" />
                  <span className="text-white font-mono font-bold">
                    {corrResult.plate_number}
                  </span>
                  <span className="text-gray-500">
                    · {corrResult.total_events} events across{" "}
                    {corrResult.systems_queried.length} systems
                  </span>
                </div>

                <div className="space-y-2">
                  {corrResult.events.map((ev: any, i: number) => (
                    <div
                      key={i}
                      className={`p-3 rounded border-l-4 ${
                        ev.severity === "critical"
                          ? "border-red-500 bg-red-900/10"
                          : ev.severity === "high"
                          ? "border-orange-500 bg-orange-900/10"
                          : ev.severity === "medium"
                          ? "border-yellow-500 bg-yellow-900/10"
                          : "border-gray-600 bg-navy-900/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white bg-navy-700 px-2 py-0.5 rounded">
                          {ev.source}
                        </span>
                        <span className="text-xs text-gray-500 uppercase">
                          {ev.event_type.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-gray-600 ml-auto font-mono">
                          {ev.timestamp}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300">{ev.details}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Gateway Tab */}
      {activeTab === "api-gateway" && (
        <div className="space-y-4">
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Globe size={14} className="text-blue-400" />API Gateway Configuration</h3>
            <div className="space-y-3">
              {[{ key: "gk_primary", name: "Primary API Key", status: "active", requests: "12,847", rate: "30 req/s", created: "2026-08-15" }, { key: "gk_partner", name: "Partner API Key", status: "active", requests: "3,291", rate: "10 req/s", created: "2026-09-01" }, { key: "gk_test", name: "Test/Demo Key", status: "active", requests: "1,024", rate: "5 req/s", created: "2026-09-10" }].map(k => (
                <div key={k.key} className="flex items-center gap-3 p-3 rounded bg-navy-900/50 border border-gray-700/50">
                  <div className="flex-1"><p className="text-sm text-white font-medium">{k.name}</p><p className="text-[10px] text-gray-500 font-mono">{k.key}</p></div>
                  <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">{k.status}</span>
                  <div className="text-right"><p className="text-xs text-gray-400">{k.requests} req</p><p className="text-[10px] text-gray-500">{k.rate}</p></div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">API Endpoints (Public)</h3>
            <div className="space-y-2 font-mono text-xs">
              {["POST /api/v1/auth/login", "GET /api/v1/cameras", "POST /api/v1/vehicles/search", "GET /api/v1/alerts", "GET /api/v1/stats/detections", "POST /api/v1/integrations/vahan/lookup", "GET /api/v1/integrations/status"].map(ep => (
                <div key={ep} className="flex items-center gap-2 p-2 rounded bg-navy-900/50"><span className={`w-12 text-center ${ep.startsWith("POST") ? "text-green-400" : "text-blue-400"}`}>{ep.split(" ")[0]}</span><span className="text-gray-300">{ep.split(" ")[1]}</span></div>
              ))}
            </div>
          </div>
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Data Sync Status</h3>
            <div className="grid grid-cols-3 gap-3">
              {[{ system: "VAHAN", lastSync: "5 min ago", status: "ok", records: 1247 }, { system: "SARTHI", lastSync: "12 min ago", status: "ok", records: 89 }, { system: "eGujCop", lastSync: "20 min ago", status: "ok", records: 342 }, { system: "Sentinel", lastSync: "30 sec ago", status: "connected", records: 30 }, { system: "AFIS", lastSync: "1 hr ago", status: "mock", records: 0 }, { system: "NAFIS", lastSync: "2 hr ago", status: "mock", records: 0 }].map(s => (
                <div key={s.system} className="p-3 rounded bg-navy-900/50"><div className="flex items-center gap-2"><span className="text-sm text-white font-medium">{s.system}</span><span className={`text-[10px] px-1.5 py-0.5 rounded ${s.status === "connected" || s.status === "ok" ? "bg-green-900/30 text-green-400" : "bg-yellow-900/30 text-yellow-400"}`}>{s.status}</span></div><p className="text-[10px] text-gray-500 mt-1">Last sync: {s.lastSync}</p><p className="text-[10px] text-gray-500">{s.records} records</p></div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Webhooks Tab */}
      {activeTab === "webhooks" && (
        <div className="space-y-4">
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Send size={14} className="text-purple-400" />Webhook & Event Push Configuration</h3>
            <div className="space-y-3">
              {[{ url: "https:// GujaratPolice-Webhook endpoint.gov.in/alerts", events: ["alert.new", "alert.acknowledged"], status: "active", lastPush: "2 min ago" }, { url: "https://analytics.example.gov.in/events", events: ["detection.vehicle", "detection.person"], status: "active", lastPush: "5 min ago" }, { url: "https://backup.example.gov.in/sync", events: ["*"], status: "paused", lastPush: "1 day ago" }].map((wh, i) => (
                <div key={i} className="p-3 rounded bg-navy-900/50 border border-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0"><p className="text-sm text-white font-mono truncate">{wh.url}</p><div className="flex gap-1.5 mt-1.5 flex-wrap">{wh.events.map(e => <span key={e} className="text-[10px] px-2 py-0.5 rounded bg-navy-700 text-gray-400">{e}</span>)}</div></div>
                    <span className={`text-xs px-2 py-0.5 rounded ${wh.status === "active" ? "bg-green-900/30 text-green-400" : "bg-yellow-900/30 text-yellow-400"}`}>{wh.status}</span>
                    <span className="text-[10px] text-gray-500">Last: {wh.lastPush}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
