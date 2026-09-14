import { useState, useEffect } from "react";
import {
  getAlerts, getAlertCount, getDetectionStats, getAlertRules,
  createAlertRule, deleteAlertRule, exportAlertsCsv,
} from "../services/api";
import {
  Bell, Plus, Trash2, ToggleLeft, ToggleRight,
  Mail, MessageSquare, Smartphone, Send, TrendingUp,
  AlertTriangle, Clock, BarChart3, RefreshCw, Settings,
  Shield, Zap, Download,
} from "lucide-react";

interface AlertRule {
  id: number;
  name: string;
  description: string;
  trigger_type: string;
  condition_config: Record<string, any>;
  severity: string;
  enabled: boolean;
  notification_channels: string[];
  created_by: string;
  created_at: string;
}

const NOTIFICATION_ICONS: Record<string, any> = {
  in_app: Bell, email: Mail, sms: MessageSquare, whatsapp: Smartphone, push: Send,
};

export default function AlertRules() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [alertStats, setAlertStats] = useState<any[]>([]);
  const [detectionTrend, setDetectionTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"rules" | "analytics" | "notifications">("rules");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", trigger_type: "plate_match", severity: "medium" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rulesRes, alertsRes, detRes] = await Promise.allSettled([
        getAlertRules(),
        getAlerts({ per_page: 100 }),
        getDetectionStats(24),
      ]);
      if (rulesRes.status === "fulfilled") setRules(rulesRes.value.data);
      if (alertsRes.status === "fulfilled") {
        const alerts: any[] = Array.isArray(alertsRes.value.data) ? alertsRes.value.data : [];
        const bySeverity: Record<string, number> = {};
        alerts.forEach(a => { bySeverity[a.severity || "unknown"] = (bySeverity[a.severity || "unknown"] || 0) + 1; });
        setAlertStats([
          { label: "Total Alerts", value: alerts.length, icon: Bell, color: "text-yellow-400" },
          { label: "Critical/High", value: alerts.filter(a => a.severity === "critical" || a.severity === "high").length, icon: AlertTriangle, color: "text-red-400" },
          { label: "New (Unacked)", value: alerts.filter(a => a.status === "new").length, icon: Clock, color: "text-orange-400" },
          { label: "Avg Response", value: "4.2 min", icon: Zap, color: "text-green-400" },
        ]);
      }
      if (detRes.status === "fulfilled" && Array.isArray(detRes.value.data)) setDetectionTrend(detRes.value.data.slice(-12));
    } catch {}
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    try {
      await createAlertRule(form);
      setShowForm(false);
      setForm({ name: "", description: "", trigger_type: "plate_match", severity: "medium" });
      loadData();
    } catch {}
  };

  const handleDelete = async (id: number) => {
    try { await deleteAlertRule(id); loadData(); } catch {}
  };

  const handleExport = async () => {
    try {
      const res = await exportAlertsCsv();
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a"); a.href = url; a.download = "alerts_export.csv";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield size={20} className="text-orange-400" />
          <h2 className="text-lg font-semibold text-white">Alert Rules & Analytics</h2>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="px-3 py-1.5 bg-navy-700 text-gray-400 text-sm rounded hover:text-white flex items-center gap-1.5">
            <Download size={14} /> CSV
          </button>
          <button onClick={loadData} disabled={loading} className="px-3 py-1.5 bg-navy-700 text-gray-400 text-sm rounded hover:text-white flex items-center gap-1.5">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-800 rounded-lg p-1">
        {(["rules", "analytics", "notifications"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-1.5 text-sm rounded flex items-center gap-1.5 ${activeTab === tab ? "bg-primary-600 text-white" : "text-gray-400 hover:text-white"}`}>
            {tab === "rules" ? <Settings size={14} /> : tab === "analytics" ? <BarChart3 size={14} /> : <Send size={14} />}
            {tab === "rules" ? "Rules Engine" : tab === "analytics" ? "Alert Analytics" : "Notifications"}
          </button>
        ))}
      </div>

      {/* Rules Engine Tab */}
      {activeTab === "rules" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{rules.length} rules ({rules.filter(r => r.enabled).length} active)</p>
            <button onClick={() => setShowForm(!showForm)} className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs rounded flex items-center gap-1.5">
              <Plus size={12} /> New Rule
            </button>
          </div>

          {showForm && (
            <div className="p-4 rounded-lg border border-primary-600 bg-navy-800 space-y-3">
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Rule name" className="w-full px-3 py-2 bg-navy-900 border border-gray-700 rounded text-sm text-white" />
              <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Description" className="w-full px-3 py-2 bg-navy-900 border border-gray-700 rounded text-sm text-white" />
              <div className="flex gap-3">
                <select value={form.trigger_type} onChange={e => setForm({ ...form, trigger_type: e.target.value })}
                  className="px-3 py-2 bg-navy-900 border border-gray-700 rounded text-sm text-white">
                  <option value="plate_match">Plate Match</option>
                  <option value="face_match">Face Match</option>
                  <option value="anomaly">Anomaly</option>
                </select>
                <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })}
                  className="px-3 py-2 bg-navy-900 border border-gray-700 rounded text-sm text-white">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={handleCreate} className="px-4 py-2 bg-primary-600 text-white text-sm rounded hover:bg-primary-700">Create</button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-navy-700 text-gray-400 text-sm rounded hover:text-white">Cancel</button>
              </div>
            </div>
          )}

          {rules.map(rule => (
            <div key={rule.id} className={`p-4 rounded-lg border transition ${rule.enabled ? "border-gray-700 bg-navy-800" : "border-gray-800 bg-navy-800/50 opacity-60"}`}>
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {rule.enabled ? <ToggleRight size={24} className="text-green-400" /> : <ToggleLeft size={24} className="text-gray-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-white font-medium">{rule.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                      rule.severity === "critical" ? "bg-red-900/50 text-red-400" :
                      rule.severity === "high" ? "bg-orange-900/50 text-orange-400" :
                      "bg-yellow-900/50 text-yellow-400"
                    }`}>{rule.severity}</span>
                    <span className="text-[10px] text-gray-500">({rule.trigger_type})</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{rule.description}</p>
                  <div className="flex gap-1.5 mt-2">
                    {(rule.notification_channels || []).map(n => {
                      const Icon = NOTIFICATION_ICONS[n] || Bell;
                      return <span key={n} className="text-[10px] px-2 py-0.5 rounded bg-navy-700 text-gray-400 flex items-center gap-1"><Icon size={10} />{n}</span>;
                    })}
                  </div>
                </div>
                <button onClick={() => handleDelete(rule.id)} className="text-gray-600 hover:text-red-400 shrink-0"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {rules.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-500 text-sm">No alert rules configured. Create one above.</div>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === "analytics" && (
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            {alertStats.map((s, i) => (
              <div key={i} className="bg-navy-800 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-2 mb-2"><s.icon size={14} className={s.color} /><span className="text-xs text-gray-400 uppercase">{s.label}</span></div>
                <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Detection Volume (24h)</h3>
            <div className="flex items-end gap-1 h-32">
              {detectionTrend.map((d, i) => {
                const max = Math.max(...detectionTrend.map((x: any) => x.count || 0), 1);
                const h = ((d.count || 0) / max) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[9px] text-gray-500 font-mono">{d.count || 0}</span>
                    <div className="w-full bg-primary-500 rounded-t" style={{ height: `${h}%`, minHeight: 2 }} />
                    <span className="text-[8px] text-gray-600">{d.hour}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Alert Response Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Avg Acknowledgment Time", value: "4.2 min", trend: "12% from yesterday", color: "text-green-400" },
                { label: "False Positive Rate", value: "8.3%", trend: "2.1% from last week", color: "text-yellow-400" },
                { label: "Escalated (Unacked >15min)", value: "3", trend: "Requires attention", color: "text-red-400" },
              ].map((s, i) => (
                <div key={i} className="p-3 rounded bg-navy-900/50">
                  <p className="text-xs text-gray-400">{s.label}</p>
                  <p className={`text-lg font-bold font-mono ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-gray-500 mt-1">{s.trend}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === "notifications" && (
        <div className="space-y-4">
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Send size={14} className="text-blue-400" />Notification Channels</h3>
            <div className="space-y-3">
              {[
                { name: "In-App WebSocket", icon: Bell, status: "active", description: "Real-time push to all connected dashboards", color: "green" },
                { name: "Email (SMTP)", icon: Mail, status: "configured", description: "alerts@gicvmap.gov.in", color: "blue" },
                { name: "SMS Gateway", icon: MessageSquare, status: "mock", description: "Mock SMS gateway for critical alerts", color: "yellow" },
                { name: "WhatsApp Business", icon: Smartphone, status: "mock", description: "Mock WhatsApp for escalation", color: "yellow" },
                { name: "Push Notification", icon: Send, status: "configured", description: "Mobile app push notifications", color: "blue" },
              ].map(ch => (
                <div key={ch.name} className="flex items-center gap-3 p-3 rounded bg-navy-900/50 border border-gray-700/50">
                  <ch.icon size={18} className="text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm text-white">{ch.name}</p>
                    <p className="text-xs text-gray-500">{ch.description}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-navy-700 text-gray-400">{ch.status}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><AlertTriangle size={14} className="text-red-400" />Escalation Matrix</h3>
            <table className="w-full text-sm">
              <thead className="text-gray-400 text-xs uppercase"><tr><th className="text-left py-2">Severity</th><th className="text-left py-2">Timeout</th><th className="text-left py-2">Escalate To</th><th className="text-left py-2">Channels</th></tr></thead>
              <tbody className="divide-y divide-gray-700/50">
                <tr><td className="py-2 text-red-400 font-semibold">Critical</td><td className="py-2 text-gray-400">5 min</td><td className="py-2 text-white">SP / DC Office</td><td className="py-2 text-gray-400">All channels</td></tr>
                <tr><td className="py-2 text-orange-400 font-semibold">High</td><td className="py-2 text-gray-400">15 min</td><td className="py-2 text-white">Inspector on Duty</td><td className="py-2 text-gray-400">In-App + SMS</td></tr>
                <tr><td className="py-2 text-yellow-400 font-semibold">Medium</td><td className="py-2 text-gray-400">30 min</td><td className="py-2 text-white">Shift Operator</td><td className="py-2 text-gray-400">In-App</td></tr>
                <tr><td className="py-2 text-gray-400 font-semibold">Low</td><td className="py-2 text-gray-400">Next shift</td><td className="py-2 text-white">Auto-log</td><td className="py-2 text-gray-400">In-App</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
