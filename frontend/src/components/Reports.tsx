import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  getDetectionStats,
  getCameraStats,
  getAlerts,
  getCameras,
  getGapAnalysis,
  getUtilisation,
  getAnalyticsQuality,
  getScalability,
} from "../services/api";
import {
  BarChart3,
  Camera,
  Bell,
  Car,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  Target,
  Gauge,
  Sparkles,
  TrendingDown,
  Cpu,
  HardDrive,
  Zap,
  Shield,
  Server,
} from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#EF4444",
  high: "#F97316",
  medium: "#EAB308",
  low: "#6B7280",
};

const STATUS_COLORS: Record<string, string> = {
  online: "#22C55E",
  offline: "#EF4444",
  degraded: "#F59E0B",
  unknown: "#6B7280",
};

const DEPT_COLORS = ["#3B82F6", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444", "#06B6D4"];

const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: "#1e293b",
    border: "1px solid #374151",
    borderRadius: "8px",
    color: "#f9fafb",
    fontSize: "12px",
  },
};

export default function Reports() {
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [timeRange, setTimeRange] = useState<24 | 48 | 168>(24);
  const [activeTab, setActiveTab] = useState<"analytics" | "gap" | "utilisation" | "quality" | "scalability">("analytics");

  // Analytics data
  const [detectionData, setDetectionData] = useState<any[]>([]);
  const [alertSeverityData, setAlertSeverityData] = useState<any[]>([]);
  const [cameraStatusData, setCameraStatusData] = useState<any[]>([]);
  const [alertTrendData, setAlertTrendData] = useState<any[]>([]);
  const [deptData, setDeptData] = useState<any[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    totalCameras: 0, onlineCameras: 0, totalAlerts: 0, criticalAlerts: 0, totalDetections: 0,
  });

  // Section 9 data
  const [gapData, setGapData] = useState<any>(null);
  const [utilData, setUtilData] = useState<any[]>([]);
  const [qualityData, setQualityData] = useState<any>(null);
  const [scaleData, setScaleData] = useState<any>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [detRes, camStatsRes, alertsRes, camRes] = await Promise.allSettled([
        getDetectionStats(timeRange),
        getCameraStats(),
        getAlerts({ per_page: 200 }),
        getCameras({ per_page: 200 }),
      ]);

      if (detRes.status === "fulfilled") {
        const raw = detRes.value.data;
        if (Array.isArray(raw)) {
          setDetectionData(raw.slice(-24).map((d: any) => ({
            hour: d.hour ?? d.bucket ?? d.time_bucket ?? "—",
            detections: d.count ?? d.total ?? 0,
            anpr: d.anpr_count ?? 0,
            persons: d.person_count ?? 0,
          })));
          setSummaryStats((s) => ({ ...s, totalDetections: raw.reduce((acc: number, d: any) => acc + (d.count ?? d.total ?? 0), 0) }));
        }
      }

      if (camStatsRes.status === "fulfilled") {
        const raw = camStatsRes.value.data;
        const byStatus: Record<string, number> = {};
        (Array.isArray(raw) ? raw : []).forEach((r: any) => { byStatus[r.status] = (byStatus[r.status] || 0) + (r.count ?? 1); });
        setCameraStatusData(Object.entries(byStatus).map(([name, value]) => ({ name, value })));
      }

      if (camRes.status === "fulfilled") {
        const cams: any[] = camRes.value.data || [];
        setSummaryStats((s) => ({ ...s, totalCameras: cams.length, onlineCameras: cams.filter((c) => c.status === "online").length }));
        if (camStatsRes.status !== "fulfilled") {
          const byStatus: Record<string, number> = {};
          cams.forEach((c) => { byStatus[c.status ?? "unknown"] = (byStatus[c.status ?? "unknown"] || 0) + 1; });
          setCameraStatusData(Object.entries(byStatus).map(([name, value]) => ({ name, value })));
        }
        const byDept: Record<string, number> = {};
        cams.forEach((c) => { const label = deptLabel(c.department_id); byDept[label] = (byDept[label] || 0) + 1; });
        setDeptData(Object.entries(byDept).map(([name, value]) => ({ name, value })));
      }

      if (alertsRes.status === "fulfilled") {
        const alerts: any[] = alertsRes.value.data?.items ?? alertsRes.value.data ?? [];
        setSummaryStats((s) => ({ ...s, totalAlerts: alerts.length, criticalAlerts: alerts.filter((a) => a.severity === "critical" || a.severity === "high").length }));
        const bySev: Record<string, number> = {};
        alerts.forEach((a) => { bySev[a.severity ?? "unknown"] = (bySev[a.severity ?? "unknown"] || 0) + 1; });
        setAlertSeverityData(Object.entries(bySev).map(([name, value]) => ({ name, value })));
        const nowMs = Date.now();
        const trendBuckets: Record<string, number> = {};
        for (let i = 11; i >= 0; i--) { trendBuckets[`${new Date(nowMs - i * 3600000).getHours()}:00`] = 0; }
        alerts.forEach((a) => {
          if (!a.triggered_at) return;
          const ts = new Date(a.triggered_at);
          if (nowMs - ts.getTime() > 12 * 3600000) return;
          const label = `${ts.getHours()}:00`;
          trendBuckets[label] = (trendBuckets[label] ?? 0) + 1;
        });
        setAlertTrendData(Object.entries(trendBuckets).map(([time, count]) => ({ time, count })));
      }
    } catch {}

    // Section 9: load all report data
    try {
      const [gapRes, utilRes, qualRes, scaleRes] = await Promise.allSettled([
        getGapAnalysis(),
        getUtilisation(timeRange),
        getAnalyticsQuality(timeRange),
        getScalability(),
      ]);
      if (gapRes.status === "fulfilled") setGapData(gapRes.value.data);
      if (utilRes.status === "fulfilled") setUtilData(utilRes.value.data);
      if (qualRes.status === "fulfilled") setQualityData(qualRes.value.data);
      if (scaleRes.status === "fulfilled") setScaleData(scaleRes.value.data);
    } catch {}

    setLoading(false);
    setLastRefreshed(new Date());
  };

  useEffect(() => { load(); }, [timeRange]);

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-primary-400" />
          <h2 className="text-lg font-semibold text-white">Reports & Analytics</h2>
          {lastRefreshed && <span className="text-xs text-gray-500">Updated: {lastRefreshed.toLocaleTimeString("en-IN")}</span>}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
            {([24, 48, 168] as const).map((h) => (
              <button key={h} onClick={() => setTimeRange(h)} className={`px-3 py-1 text-xs rounded ${timeRange === h ? "bg-primary-600 text-white" : "text-gray-400 hover:text-white"}`}>
                {h === 24 ? "24h" : h === 48 ? "48h" : "7d"}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading} className="px-3 py-1.5 bg-navy-700 text-gray-400 text-sm rounded hover:text-white flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-800 rounded-lg p-1 overflow-x-auto">
        {([
          { key: "analytics", label: "Detection Analytics", icon: BarChart3 },
          { key: "gap", label: "Gap Analysis", icon: Target },
          { key: "utilisation", label: "Utilisation", icon: Gauge },
          { key: "quality", label: "Analytics Quality", icon: Sparkles },
          { key: "scalability", label: "Scalability", icon: TrendingUp },
        ] as const).map((tab) => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`px-4 py-1.5 text-sm rounded flex items-center gap-1.5 whitespace-nowrap ${activeTab === tab.key ? "bg-primary-600 text-white" : "text-gray-400 hover:text-white"}`}>
            <tab.icon size={14} /> {tab.label}
          </button>
        ))}
      </div>

      {/* ── Detection Analytics Tab ──────────────────────────────────── */}
      {activeTab === "analytics" && <AnalyticsTab loading={loading} summaryStats={summaryStats} detectionData={detectionData} alertTrendData={alertTrendData} cameraStatusData={cameraStatusData} alertSeverityData={alertSeverityData} deptData={deptData} />}

      {/* ── Gap Analysis Tab ─────────────────────────────────────────── */}
      {activeTab === "gap" && <GapAnalysisTab loading={loading} data={gapData} />}

      {/* ── Utilisation Tab ──────────────────────────────────────────── */}
      {activeTab === "utilisation" && <UtilisationTab loading={loading} data={utilData} />}

      {/* ── Quality Tab ──────────────────────────────────────────────── */}
      {activeTab === "quality" && <QualityTab loading={loading} data={qualityData} />}

      {/* ── Scalability Tab ──────────────────────────────────────────── */}
      {activeTab === "scalability" && <ScalabilityTab loading={loading} data={scaleData} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab Components
// ═══════════════════════════════════════════════════════════════════════════

function AnalyticsTab({ loading, summaryStats, detectionData, alertTrendData, cameraStatusData, alertSeverityData, deptData }: any) {
  return (
    <div className="space-y-4">
      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total Cameras", value: summaryStats.totalCameras, sub: `${summaryStats.onlineCameras} online`, icon: Camera, color: "text-blue-400" },
          { label: "Online Rate", value: summaryStats.totalCameras > 0 ? `${((summaryStats.onlineCameras / summaryStats.totalCameras) * 100).toFixed(0)}%` : "—", sub: "uptime", icon: TrendingUp, color: "text-green-400" },
          { label: "Total Detections", value: summaryStats.totalDetections, sub: "all time", icon: Car, color: "text-primary-400" },
          { label: "Total Alerts", value: summaryStats.totalAlerts, sub: "all time", icon: Bell, color: "text-yellow-400" },
          { label: "Critical/High", value: summaryStats.criticalAlerts, sub: "priority", icon: AlertTriangle, color: "text-red-400" },
        ].map((card) => (
          <div key={card.label} className="bg-navy-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2"><card.icon size={14} className={card.color} /><span className="text-xs text-gray-400 uppercase">{card.label}</span></div>
            <p className={`text-2xl font-bold font-mono ${card.color}`}>{card.value}</p>
            <p className="text-xs text-gray-500 mt-1">{card.sub}</p>
          </div>
        ))}
      </div>
      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Car size={14} className="text-primary-400" />Detections</h3>
          {detectionData.length === 0 ? <EmptyChart loading={loading} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={detectionData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="hour" tick={{ fill: "#9CA3AF", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#374151" }} interval="preserveStartEnd" />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: "11px", color: "#9CA3AF" }} />
                <Bar dataKey="detections" fill="#3B82F6" name="Total" radius={[2, 2, 0, 0]} />
                <Bar dataKey="anpr" fill="#8B5CF6" name="ANPR" radius={[2, 2, 0, 0]} />
                <Bar dataKey="persons" fill="#10B981" name="Persons" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Bell size={14} className="text-yellow-400" />Alert Trend (12h)</h3>
          {alertTrendData.length === 0 ? <EmptyChart loading={loading} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={alertTrendData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="time" tick={{ fill: "#9CA3AF", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#374151" }} />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Line type="monotone" dataKey="count" stroke="#F59E0B" strokeWidth={2} dot={{ fill: "#F59E0B", r: 3 }} activeDot={{ r: 5 }} name="Alerts" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
      {/* Pie charts */}
      <div className="grid grid-cols-3 gap-4">
        <PieCard title="Camera Health" icon={Camera} iconColor="text-green-400" data={cameraStatusData} colors={STATUS_COLORS} />
        <PieCard title="Alert Severity" icon={AlertTriangle} iconColor="text-red-400" data={alertSeverityData} colors={SEVERITY_COLORS} />
        <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Camera size={14} className="text-blue-400" />By Department</h3>
          {deptData.length === 0 ? <EmptyChart loading={loading} /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={deptData} layout="vertical" margin={{ top: 0, right: 20, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                <XAxis type="number" tick={{ fill: "#9CA3AF", fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 9 }} tickLine={false} axisLine={false} width={56} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="value" name="Cameras" radius={[0, 2, 2, 0]}>{deptData.map((_: any, i: number) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function GapAnalysisTab({ loading, data }: any) {
  if (loading && !data) return <LoadingPanel />;
  if (!data) return <EmptyPanel message="No gap analysis data available" />;
  const { summary, idle_cameras, department_coverage } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Cameras", value: summary.total_cameras, icon: Camera, color: "text-blue-400" },
          { label: "Online", value: summary.online_cameras, icon: TrendingUp, color: "text-green-400" },
          { label: "Analytics Enabled", value: summary.analytics_enabled, icon: Sparkles, color: "text-purple-400" },
          { label: "Idle (24h)", value: summary.idle_cameras_count, icon: TrendingDown, color: summary.idle_cameras_count > 0 ? "text-red-400" : "text-green-400" },
        ].map((c) => (
          <div key={c.label} className="bg-navy-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2"><c.icon size={14} className={c.color} /><span className="text-xs text-gray-400 uppercase">{c.label}</span></div>
            <p className={`text-2xl font-bold font-mono ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Idle Cameras */}
      <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><TrendingDown size={14} className="text-red-400" />Idle Cameras (No Detections in 24h)</h3>
        {idle_cameras.length === 0 ? <p className="text-green-400 text-sm">All cameras are producing detections</p> : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {idle_cameras.map((c: any) => (
              <div key={c.id} className="flex items-center gap-3 p-2 rounded bg-navy-900/50">
                <span className={`w-2 h-2 rounded-full ${c.status === "online" ? "bg-green-500" : "bg-red-500"}`} />
                <span className="text-sm text-white">{c.name}</span>
                <span className="text-xs text-gray-500">{c.location_description || "No location"}</span>
                <span className="text-xs text-gray-600 ml-auto">{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Department Coverage */}
      <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Target size={14} className="text-blue-400" />Department Coverage</h3>
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs uppercase"><tr><th className="text-left py-2">Department</th><th className="text-right py-2">Total</th><th className="text-right py-2">Online</th><th className="text-right py-2">Analytics</th><th className="text-right py-2">Coverage</th></tr></thead>
          <tbody className="divide-y divide-gray-700/50">
            {department_coverage.map((d: any) => {
              const coverage = d.total_cameras > 0 ? ((d.online / d.total_cameras) * 100).toFixed(0) : "0";
              return (
                <tr key={d.code} className="hover:bg-navy-700/50">
                  <td className="py-2 text-white">{d.department_name} ({d.code})</td>
                  <td className="py-2 text-right text-gray-400">{d.total_cameras}</td>
                  <td className="py-2 text-right text-green-400">{d.online}</td>
                  <td className="py-2 text-right text-purple-400">{d.analytics_enabled}</td>
                  <td className="py-2 text-right"><span className={`font-mono ${Number(coverage) > 80 ? "text-green-400" : Number(coverage) > 50 ? "text-yellow-400" : "text-red-400"}`}>{coverage}%</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function UtilisationTab({ loading, data }: any) {
  if (loading && !data?.length) return <LoadingPanel />;
  if (!data?.length) return <EmptyPanel message="No utilisation data" />;
  return (
    <div className="space-y-4">
      <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Gauge size={14} className="text-cyan-400" />Camera Utilisation Report</h3>
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs uppercase"><tr>
            <th className="text-left py-2">Camera</th><th className="text-right py-2">Detections</th><th className="text-right py-2">/hr</th><th className="text-right py-2">ANPR</th><th className="text-right py-2">Persons</th><th className="text-right py-2">Avg MS</th><th className="text-right py-2">Storage/day</th>
          </tr></thead>
          <tbody className="divide-y divide-gray-700/50">
            {data.map((r: any) => (
              <tr key={r.camera_id} className="hover:bg-navy-700/50">
                <td className="py-2 text-white">{r.camera_name}</td>
                <td className="py-2 text-right text-gray-400 font-mono">{r.detections || 0}</td>
                <td className="py-2 text-right text-primary-400 font-mono">{r.detections_per_hour}</td>
                <td className="py-2 text-right text-purple-400 font-mono">{r.anpr_detections || 0}</td>
                <td className="py-2 text-right text-green-400 font-mono">{r.person_detections || 0}</td>
                <td className="py-2 text-right text-gray-400 font-mono">{r.avg_processing_ms}ms</td>
                <td className="py-2 text-right text-yellow-400 font-mono">{r.estimated_daily_storage_mb}MB</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QualityTab({ loading, data }: any) {
  if (loading && !data) return <LoadingPanel />;
  if (!data) return <EmptyPanel message="No quality data" />;
  const { summary, confidence_distribution, type_breakdown } = data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total Detections", value: summary.total_detections, icon: Car, color: "text-blue-400" },
          { label: "Plate Recognition Rate", value: `${summary.plate_recognition_rate}%`, icon: Target, color: "text-purple-400" },
          { label: "High Confidence Rate", value: `${summary.high_confidence_rate}%`, icon: Sparkles, color: "text-green-400" },
          { label: "Avg Processing", value: `${summary.avg_processing_time_ms}ms`, icon: Cpu, color: "text-yellow-400" },
        ].map((c) => (
          <div key={c.label} className="bg-navy-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2 mb-2"><c.icon size={14} className={c.color} /><span className="text-xs text-gray-400 uppercase">{c.label}</span></div>
            <p className={`text-2xl font-bold font-mono ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Plate Confidence Distribution</h3>
          {confidence_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={confidence_distribution} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="confidence_bucket" tick={{ fill: "#9CA3AF", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#374151" }} />
                <YAxis tick={{ fill: "#9CA3AF", fontSize: 10 }} tickLine={false} axisLine={false} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
                <Bar dataKey="count" name="Plates" radius={[2, 2, 0, 0]}>
                  {confidence_distribution.map((_: any, i: number) => <Cell key={i} fill={["#22C55E", "#3B82F6", "#F59E0B", "#EF4444"][i % 4]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart loading={loading} />}
        </div>
        <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Detection Type Breakdown</h3>
          {type_breakdown.length > 0 ? (
            <div className="space-y-3">
              {type_breakdown.map((t: any) => {
                const color = t.detection_type === "vehicle" ? "#3B82F6" : t.detection_type === "person" ? "#10B981" : "#6B7280";
                const pct = summary.total_detections > 0 ? ((t.count / summary.total_detections) * 100).toFixed(1) : "0";
                return (
                  <div key={t.detection_type}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-gray-400 capitalize">{t.detection_type}</span><span className="text-white font-mono">{t.count} ({pct}%)</span></div>
                    <div className="h-2 bg-navy-900 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
                    <p className="text-[10px] text-gray-600 mt-0.5">Avg confidence: {((t.avg_confidence || 0) * 100).toFixed(0)}% · Avg speed: {(t.avg_ms || 0).toFixed(0)}ms</p>
                  </div>
                );
              })}
            </div>
          ) : <EmptyChart loading={loading} />}
        </div>
      </div>
    </div>
  );
}

function ScalabilityTab({ loading, data }: any) {
  if (loading && !data) return <LoadingPanel />;
  if (!data) return <EmptyPanel message="No scalability data" />;
  const { current, projections, infrastructure } = data;
  return (
    <div className="space-y-4">
      {/* Current Status */}
      <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Server size={14} className="text-blue-400" />Current System Status</h3>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(current).map(([k, v]) => (
            <div key={k} className="p-3 rounded bg-navy-900/50">
              <p className="text-xs text-gray-400 capitalize">{k.replace(/_/g, " ")}</p>
              <p className="text-lg font-bold font-mono text-white">{String(v)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Projections at 80,000 cameras */}
      <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><TrendingUp size={14} className="text-green-400" />Growth Projections (Target: {projections.target_cameras.toLocaleString()} cameras)</h3>
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Coverage", value: `${projections.coverage_percent}%`, color: "text-primary-400" },
            { label: "Daily Detections (est)", value: projections.estimated_daily_detections_at_scale.toLocaleString(), color: "text-green-400" },
            { label: "Storage (est)", value: `${projections.estimated_storage_tb} TB/day`, color: "text-yellow-400" },
            { label: "GPU Nodes Needed", value: projections.gpu_nodes_needed, color: "text-purple-400" },
          ].map((p) => (
            <div key={p.label} className="p-3 rounded bg-navy-900/50">
              <p className="text-xs text-gray-400">{p.label}</p>
              <p className={`text-lg font-bold font-mono ${p.color}`}>{p.value}</p>
            </div>
          ))}
        </div>
        <div className="mt-3 p-3 rounded bg-navy-900/50">
          <p className="text-xs text-gray-400">Bandwidth at Scale</p>
          <p className="text-lg font-bold font-mono text-cyan-400">{projections.estimated_bandwidth_gbps} Gbps</p>
        </div>
      </div>

      {/* Infrastructure */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Cpu size={14} className="text-blue-400" />Current Stack</h3>
          <div className="space-y-2">
            {Object.entries(infrastructure.current).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-32 capitalize">{k.replace(/_/g, " ")}:</span>
                <span className="text-white">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-navy-800 rounded-lg border border-green-700/50 p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Zap size={14} className="text-green-400" />At-Scale Stack</h3>
          <div className="space-y-2">
            {Object.entries(infrastructure.at_scale).map(([k, v]) => (
              <div key={k} className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 w-32 capitalize">{k.replace(/_/g, " ")}:</span>
                <span className="text-white">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared Components
// ═══════════════════════════════════════════════════════════════════════════

function PieCard({ title, icon: Icon, iconColor, data, colors }: any) {
  return (
    <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Icon size={14} className={iconColor} />{title}</h3>
      {data.length === 0 ? <EmptyChart loading={false} /> : (
        <div className="flex flex-col items-center">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart><Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
              {data.map((entry: any, i: number) => <Cell key={i} fill={colors[entry.name] || DEPT_COLORS[i % DEPT_COLORS.length]} />)}
            </Pie><Tooltip {...CHART_TOOLTIP_STYLE} /></PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap gap-2 justify-center mt-1">
            {data.map((entry: any, i: number) => (
              <div key={i} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: colors[entry.name] || DEPT_COLORS[i % DEPT_COLORS.length] }} />
                <span className="text-[10px] text-gray-400 capitalize">{entry.name} ({entry.value})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyChart({ loading }: { loading: boolean }) {
  return (
    <div className="h-[220px] flex items-center justify-center">
      {loading ? <div className="w-6 h-6 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" /> : <p className="text-gray-600 text-xs">No data available</p>}
    </div>
  );
}

function LoadingPanel() {
  return <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin" /></div>;
}

function EmptyPanel({ message }: { message: string }) {
  return <div className="h-64 flex items-center justify-center"><p className="text-gray-500 text-sm">{message}</p></div>;
}

function deptLabel(deptId: number | null): string {
  const labels: Record<number, string> = { 1: "Home/Police", 2: "RTO", 3: "Municipal", 4: "Civil Supp.", 5: "Transport", 6: "Revenue" };
  return deptId ? labels[deptId] || `Dept ${deptId}` : "Unknown";
}
