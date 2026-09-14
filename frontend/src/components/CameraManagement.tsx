import { useState, useEffect, useRef } from "react";
import { getCameras, createCamera, updateCamera, deleteCamera } from "../services/api";
import api from "../services/api";
import {
  Plus,
  Upload,
  Download,
  Search,
  Edit3,
  Trash2,
  Circle,
  Camera,
  Wifi,
  X,
  CheckCircle,
  RefreshCw,
  Radar,
} from "lucide-react";

interface CameraType {
  id: string;
  name: string;
  department_id: number | null;
  camera_type: string;
  vendor: string | null;
  model: string | null;
  rtsp_url: string | null;
  lat: number;
  lng: number;
  status: string;
  location_description: string | null;
  storage_type: string | null;
  retention_days: number;
  created_at: string;
}

interface DiscoveredDevice {
  ip: string;
  port: number;
  onvif_url: string;
  rtsp_url: string;
  vendor: string;
  model: string;
  discovered_at: string;
}

const EMPTY_FORM = {
  name: "",
  department_id: 1,
  camera_type: "ip",
  vendor: "",
  model: "",
  rtsp_url: "",
  lat: 23.0225,
  lng: 72.5714,
  location_description: "",
  storage_type: "cloud",
  retention_days: 7,
};

const STATUS_BADGE: Record<string, string> = {
  online: "bg-green-900/50 text-green-400",
  offline: "bg-red-900/50 text-red-400",
  degraded: "bg-yellow-900/50 text-yellow-400",
  unknown: "bg-gray-800 text-gray-400",
};

const STATUS_DOT: Record<string, string> = {
  online: "bg-green-500",
  offline: "bg-red-500",
  degraded: "bg-yellow-500",
  unknown: "bg-gray-500",
};

/** Download an array of objects as a CSV file */
function downloadCsv(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const v = r[h] ?? "";
        const s = String(v).replace(/"/g, '""');
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s}"`
          : s;
      }).join(",")
    ),
  ];
  const blob = new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CameraManagement() {
  const [cameras, setCameras] = useState<CameraType[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<CameraType | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Bulk upload state
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ created: number; errors: any[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ONVIF discovery state
  const [showOnvif, setShowOnvif] = useState(false);
  const [onvifSubnet, setOnvifSubnet] = useState("192.168.1");
  const [onvifTimeout, setOnvifTimeout] = useState(2);
  const [onvifLoading, setOnvifLoading] = useState(false);
  const [onvifResult, setOnvifResult] = useState<{
    subnet: string;
    scanned: number;
    discovered: number;
    devices: DiscoveredDevice[];
  } | null>(null);
  const [selectedDevices, setSelectedDevices] = useState<Set<string>>(new Set());
  const [onvifDeptId, setOnvifDeptId] = useState(1);
  const [onvifOnboarding, setOnvifOnboarding] = useState(false);

  useEffect(() => {
    loadCameras();
  }, []);

  const loadCameras = async () => {
    try {
      const { data } = await getCameras({ per_page: 100 });
      setCameras(data);
    } catch {}
  };

  const showMsg = (text: string, type: "ok" | "err" = "ok") => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 4000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        lat: Number(form.lat),
        lng: Number(form.lng),
        department_id: Number(form.department_id),
        retention_days: Number(form.retention_days),
        vendor: form.vendor || null,
        model: form.model || null,
        rtsp_url: form.rtsp_url || null,
        location_description: form.location_description || null,
        storage_type: form.storage_type || null,
      };
      if (editing) {
        await updateCamera(editing.id, payload);
        showMsg("Camera updated successfully");
      } else {
        await createCamera(payload);
        showMsg("Camera created successfully");
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      loadCameras();
    } catch (err: any) {
      showMsg(err?.response?.data?.detail || "Error saving camera", "err");
    }
    setLoading(false);
  };

  const handleEdit = (cam: CameraType) => {
    setEditing(cam);
    setForm({
      name: cam.name,
      department_id: cam.department_id || 1,
      camera_type: cam.camera_type,
      vendor: cam.vendor || "",
      model: cam.model || "",
      rtsp_url: cam.rtsp_url || "",
      lat: cam.lat,
      lng: cam.lng,
      location_description: cam.location_description || "",
      storage_type: cam.storage_type || "cloud",
      retention_days: cam.retention_days,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this camera?")) return;
    try {
      await deleteCamera(id);
      loadCameras();
    } catch {
      showMsg("Delete failed — admin only", "err");
    }
  };

  // ── Bulk CSV Upload ───────────────────────────────────────────────────────
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const { data } = await api.post("/cameras/bulk", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setBulkResult(data);
      showMsg(`Bulk import: ${data.created} cameras created`);
      loadCameras();
    } catch (err: any) {
      showMsg(err?.response?.data?.detail || "Bulk upload failed", "err");
    } finally {
      setBulkLoading(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = filtered.map((c) => ({
      id: c.id,
      name: c.name,
      department_id: c.department_id,
      camera_type: c.camera_type,
      vendor: c.vendor,
      model: c.model,
      rtsp_url: c.rtsp_url,
      lat: c.lat,
      lng: c.lng,
      status: c.status,
      location_description: c.location_description,
      storage_type: c.storage_type,
      retention_days: c.retention_days,
      created_at: c.created_at,
    }));
    const filename = `cameras_export_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(rows, filename);
    showMsg(`Exported ${rows.length} cameras to ${filename}`);
  };

  // ── ONVIF Discovery ───────────────────────────────────────────────────────
  const handleOnvifScan = async () => {
    setOnvifLoading(true);
    setOnvifResult(null);
    setSelectedDevices(new Set());
    try {
      const { data } = await api.post(
        `/cameras/discover?subnet=${encodeURIComponent(onvifSubnet)}&timeout=${onvifTimeout}`
      );
      setOnvifResult(data);
      if (data.discovered === 0) {
        showMsg(`Scan complete: no ONVIF devices found on ${onvifSubnet}.0/24`);
      }
    } catch (err: any) {
      showMsg(err?.response?.data?.detail || "ONVIF scan failed", "err");
    } finally {
      setOnvifLoading(false);
    }
  };

  const handleOnvifOnboard = async () => {
    if (selectedDevices.size === 0) return;
    setOnvifOnboarding(true);
    const devices = (onvifResult?.devices || []).filter((d) =>
      selectedDevices.has(d.ip)
    );
    try {
      const { data } = await api.post(
        `/cameras/onboard-discovered?department_id=${onvifDeptId}`,
        devices
      );
      showMsg(`Onboarded ${data.onboarded} devices from ONVIF discovery`);
      setSelectedDevices(new Set());
      setOnvifResult(null);
      loadCameras();
    } catch (err: any) {
      showMsg(err?.response?.data?.detail || "Onboarding failed", "err");
    } finally {
      setOnvifOnboarding(false);
    }
  };

  const toggleDevice = (ip: string) => {
    setSelectedDevices((prev) => {
      const next = new Set(prev);
      next.has(ip) ? next.delete(ip) : next.add(ip);
      return next;
    });
  };

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = cameras.filter((cam) => {
    if (statusFilter !== "all" && cam.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !cam.name.toLowerCase().includes(q) &&
        !(cam.location_description || "").toLowerCase().includes(q) &&
        !(cam.vendor || "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const onlineCount = cameras.filter((c) => c.status === "online").length;
  const offlineCount = cameras.filter((c) => c.status === "offline").length;
  const degradedCount = cameras.filter((c) => c.status === "degraded").length;

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowForm(true); }}
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <Plus size={16} />
            Add Camera
          </button>

          {/* Bulk CSV Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={bulkLoading}
            className="px-4 py-2 bg-navy-700 text-gray-400 text-sm rounded-lg hover:text-white flex items-center gap-2 disabled:opacity-50"
          >
            {bulkLoading ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {bulkLoading ? "Uploading..." : "Bulk Upload CSV"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleBulkUpload}
            className="hidden"
          />

          {/* Export */}
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-navy-700 text-gray-400 text-sm rounded-lg hover:text-white flex items-center gap-2"
          >
            <Download size={14} />
            Export CSV
          </button>

          {/* ONVIF Discovery */}
          <button
            onClick={() => setShowOnvif((v) => !v)}
            className={`px-4 py-2 text-sm rounded-lg flex items-center gap-2 ${
              showOnvif
                ? "bg-blue-600 text-white"
                : "bg-navy-700 text-gray-400 hover:text-white"
            }`}
          >
            <Radar size={14} />
            ONVIF Discovery
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search cameras..."
            className="pl-9 pr-3 py-2 bg-navy-800 border border-gray-600 rounded-lg text-sm text-white w-64 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {/* ONVIF Discovery Panel */}
      {showOnvif && (
        <div className="bg-navy-800 rounded-lg border border-blue-700/50 p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radar size={16} className="text-blue-400" />
              <h3 className="text-sm font-semibold text-white">
                ONVIF Camera Discovery
              </h3>
              <span className="text-xs text-gray-500">
                (Model 3 — WS-Discovery probe on LAN subnet)
              </span>
            </div>
            <button
              onClick={() => setShowOnvif(false)}
              className="text-gray-500 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-400">Subnet (first 3 octets)</label>
              <input
                value={onvifSubnet}
                onChange={(e) => setOnvifSubnet(e.target.value)}
                placeholder="192.168.1"
                className="block mt-1 bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm font-mono w-40"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Timeout (s)</label>
              <select
                value={onvifTimeout}
                onChange={(e) => setOnvifTimeout(Number(e.target.value))}
                className="block mt-1 bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm w-24"
              >
                <option value={1}>1s</option>
                <option value={2}>2s</option>
                <option value={3}>3s</option>
                <option value={5}>5s</option>
              </select>
            </div>
            <button
              onClick={handleOnvifScan}
              disabled={onvifLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {onvifLoading ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Radar size={14} />
              )}
              {onvifLoading
                ? `Scanning ${onvifSubnet}.0/24…`
                : `Scan ${onvifSubnet}.0/24`}
            </button>
          </div>

          {onvifLoading && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-600 border-t-blue-400 rounded-full animate-spin" />
              Probing 254 hosts… this may take up to {onvifTimeout * 254 / 20}s
            </div>
          )}

          {onvifResult && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <p className="text-xs text-gray-400">
                  Scanned <span className="text-white">{onvifResult.scanned}</span> hosts on{" "}
                  <span className="text-white font-mono">{onvifResult.subnet}</span> —{" "}
                  <span className="text-blue-400 font-bold">{onvifResult.discovered}</span>{" "}
                  ONVIF device{onvifResult.discovered !== 1 ? "s" : ""} found
                </p>
                {onvifResult.devices.length > 0 && (
                  <button
                    onClick={() =>
                      setSelectedDevices(
                        selectedDevices.size === onvifResult.devices.length
                          ? new Set()
                          : new Set(onvifResult.devices.map((d) => d.ip))
                      )
                    }
                    className="text-xs text-primary-400 hover:text-primary-300"
                  >
                    {selectedDevices.size === onvifResult.devices.length
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                )}
              </div>

              {onvifResult.devices.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {onvifResult.devices.map((device) => (
                    <div
                      key={device.ip}
                      onClick={() => toggleDevice(device.ip)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer border transition ${
                        selectedDevices.has(device.ip)
                          ? "border-blue-500 bg-blue-900/20"
                          : "border-gray-700 hover:border-gray-500"
                      }`}
                    >
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          selectedDevices.has(device.ip)
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-600"
                        }`}
                      >
                        {selectedDevices.has(device.ip) && (
                          <CheckCircle size={10} className="text-white" />
                        )}
                      </div>
                      <Wifi size={14} className="text-blue-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-mono">{device.ip}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {device.onvif_url} | RTSP: {device.rtsp_url}
                        </p>
                      </div>
                      <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded">
                        ONVIF
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-4">
                  No ONVIF devices found. Try a different subnet or increase timeout.
                </p>
              )}

              {selectedDevices.size > 0 && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-700">
                  <span className="text-xs text-gray-400">
                    Onboard {selectedDevices.size} device
                    {selectedDevices.size > 1 ? "s" : ""} to:
                  </span>
                  <select
                    value={onvifDeptId}
                    onChange={(e) => setOnvifDeptId(Number(e.target.value))}
                    className="bg-navy-900 border border-gray-600 rounded px-2 py-1 text-white text-xs"
                  >
                    <option value={1}>Home / Police</option>
                    <option value={2}>RTO</option>
                    <option value={3}>Municipal Corp</option>
                    <option value={4}>Food & Civil Supplies</option>
                  </select>
                  <button
                    onClick={handleOnvifOnboard}
                    disabled={onvifOnboarding}
                    className="px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {onvifOnboarding ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Plus size={12} />
                    )}
                    Onboard Selected
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="text-xs text-gray-600 border-t border-gray-700 pt-2">
            ⚠ Only scans RFC-1918 private subnets (10.x.x.x, 172.16–31.x.x, 192.168.x.x). Cameras
            are added with lat/lng = 0,0 — update coordinates after onboarding.
          </div>
        </div>
      )}

      {/* Bulk upload result */}
      {bulkResult && (
        <div className="bg-navy-800 rounded-lg border border-gray-700 p-3 flex items-center justify-between">
          <div className="text-sm">
            <span className="text-green-400 font-semibold">{bulkResult.created} cameras created</span>
            {bulkResult.errors.length > 0 && (
              <span className="text-yellow-400 ml-3">{bulkResult.errors.length} rows skipped</span>
            )}
          </div>
          <button
            onClick={() => setBulkResult(null)}
            className="text-gray-500 hover:text-white"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", value: cameras.length, color: "text-white", icon: Camera },
          { label: "Online", value: onlineCount, color: "text-green-400", icon: Circle },
          { label: "Offline", value: offlineCount, color: "text-red-400", icon: Circle },
          { label: "Degraded", value: degradedCount, color: "text-yellow-400", icon: Circle },
        ].map((s) => (
          <div key={s.label} className="bg-navy-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center gap-2">
              <s.icon size={14} className={s.color} />
              <p className="text-xs text-gray-400 uppercase">{s.label}</p>
            </div>
            <p className={`text-2xl font-bold font-mono mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Status/error message */}
      {msg && (
        <div
          className={`px-3 py-2 rounded text-sm flex items-center gap-2 ${
            msgType === "err"
              ? "bg-red-900/30 text-red-400"
              : "bg-green-900/30 text-green-400"
          }`}
        >
          {msgType === "ok" ? <CheckCircle size={14} /> : <X size={14} />}
          {msg}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-1 bg-navy-800 rounded-lg p-1 w-fit">
        {["all", "online", "offline", "degraded"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-sm rounded ${
              statusFilter === s ? "bg-primary-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* CSV template hint */}
      <p className="text-xs text-gray-600">
        CSV template columns:{" "}
        <span className="font-mono text-gray-500">
          name, lat, lng, rtsp_url, department_id, camera_type, vendor, model, location_description
        </span>
      </p>

      {/* Camera Table */}
      <div className="bg-navy-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy-900 text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Location</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Retention</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filtered.map((cam) => (
              <tr key={cam.id} className="hover:bg-navy-700/50">
                <td className="px-4 py-3 text-white font-medium">{cam.name}</td>
                <td className="px-4 py-3 text-gray-400 truncate max-w-[200px]">
                  {cam.location_description || `${cam.lat?.toFixed(4)}, ${cam.lng?.toFixed(4)}`}
                </td>
                <td className="px-4 py-3 text-gray-400 uppercase text-xs">{cam.camera_type}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
                      STATUS_BADGE[cam.status] || STATUS_BADGE.unknown
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        STATUS_DOT[cam.status] || STATUS_DOT.unknown
                      }`}
                    />
                    {cam.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400">{cam.retention_days}d</td>
                <td className="px-4 py-3 text-right space-x-3">
                  <button
                    onClick={() => handleEdit(cam)}
                    className="text-primary-400 hover:text-primary-300"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(cam.id)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-8">No cameras match filters</div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-navy-800 border border-gray-600 rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Camera size={18} className="text-primary-400" />
              {editing ? "Edit Camera" : "Add New Camera"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400">Camera Name *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Department *</label>
                  <select
                    value={form.department_id}
                    onChange={(e) => setForm({ ...form, department_id: Number(e.target.value) })}
                    className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                  >
                    <option value={1}>Home / Police</option>
                    <option value={2}>RTO</option>
                    <option value={3}>Municipal Corp</option>
                    <option value={4}>Food & Civil Supplies</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Camera Type *</label>
                  <select
                    value={form.camera_type}
                    onChange={(e) => setForm({ ...form, camera_type: e.target.value })}
                    className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                  >
                    <option value="ip">IP Camera</option>
                    <option value="analog">Analog</option>
                    <option value="onvif">ONVIF</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Vendor</label>
                  <input
                    value={form.vendor}
                    onChange={(e) => setForm({ ...form, vendor: e.target.value })}
                    className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Model</label>
                  <input
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400">RTSP URL</label>
                <input
                  value={form.rtsp_url}
                  onChange={(e) => setForm({ ...form, rtsp_url: e.target.value })}
                  placeholder="rtsp://192.168.1.100:554/stream"
                  className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1 font-mono"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Latitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={form.lat}
                    onChange={(e) => setForm({ ...form, lat: Number(e.target.value) })}
                    className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400">Longitude *</label>
                  <input
                    type="number"
                    step="any"
                    value={form.lng}
                    onChange={(e) => setForm({ ...form, lng: Number(e.target.value) })}
                    className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-400">Location Description</label>
                <input
                  value={form.location_description}
                  onChange={(e) =>
                    setForm({ ...form, location_description: e.target.value })
                  }
                  className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400">Storage</label>
                  <select
                    value={form.storage_type || ""}
                    onChange={(e) => setForm({ ...form, storage_type: e.target.value })}
                    className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                  >
                    <option value="cloud">Cloud (S3/MinIO)</option>
                    <option value="local">Local NVR</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400">Retention (days)</label>
                  <input
                    type="number"
                    value={form.retention_days}
                    onChange={(e) =>
                      setForm({ ...form, retention_days: Number(e.target.value) })
                    }
                    className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? "Saving..." : editing ? "Update Camera" : "Save Camera"}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditing(null); }}
                  className="px-4 py-2 bg-gray-700 text-gray-300 text-sm rounded-lg hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
