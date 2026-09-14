import { useState, useEffect } from "react";
import { getWatchlist, createWatchlist, deleteWatchlist } from "../services/api";
import {
  Plus,
  Upload,
  Download,
  Search,
  Trash2,
  Car,
  User,
  Circle,
  CheckCircle,
  X,
} from "lucide-react";

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

interface WatchlistEntry {
  id: number;
  type: string;
  plate_number: string | null;
  reason: string;
  category: string;
  source_system: string;
  is_active: boolean;
  added_by: string;
  added_at: string;
}

const CATEGORIES = ["Stolen", "Wanted", "Missing", "Blacklisted"];
const EMPTY_FORM = {
  type: "vehicle",
  plate_number: "",
  reason: "",
  category: "Stolen",
  source_system: "manual",
};

export default function WatchlistManagement() {
  const [entries, setEntries] = useState<WatchlistEntry[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [msgType, setMsgType] = useState<"ok" | "err">("ok");

  const showMsg = (text: string, type: "ok" | "err" = "ok") => {
    setMsg(text);
    setMsgType(type);
    setTimeout(() => setMsg(""), 4000);
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      const { data } = await getWatchlist({ per_page: 100 });
      setEntries(Array.isArray(data) ? data : data.items || []);
    } catch {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await createWatchlist(form);
      showMsg("Entry added successfully");
      setShowForm(false);
      setForm(EMPTY_FORM);
      loadEntries();
    } catch (err: any) {
      showMsg(err?.response?.data?.detail || "Error adding entry", "err");
    }
    setLoading(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this entry from watchlist?")) return;
    try {
      await deleteWatchlist(id);
      loadEntries();
    } catch {
      showMsg("Delete failed", "err");
    }
  };

  const handleExport = () => {
    const rows = filtered.map((e) => ({
      id: e.id,
      type: e.type,
      plate_number: e.plate_number,
      reason: e.reason,
      category: e.category,
      source_system: e.source_system,
      is_active: e.is_active,
      added_by: e.added_by,
      added_at: e.added_at,
    }));
    const filename = `watchlist_export_${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(rows, filename);
    showMsg(`Exported ${rows.length} entries to ${filename}`);
  };

  const filtered = entries.filter((e) => {
    if (filter === "vehicles" && e.type !== "vehicle") return false;
    if (filter === "persons" && e.type !== "person") return false;
    if (search) {
      const q = search.toLowerCase();
      const match =
        (e.plate_number || "").toLowerCase().includes(q) ||
        e.reason.toLowerCase().includes(q) ||
        (e.category || "").toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  const vehicleCount = entries.filter((e) => e.type === "vehicle").length;
  const personCount = entries.filter((e) => e.type === "person").length;

  const CAT_COLORS: Record<string, string> = {
    Stolen: "bg-red-900/30 text-red-400",
    Wanted: "bg-orange-900/30 text-orange-400",
    Missing: "bg-yellow-900/30 text-yellow-400",
    Blacklisted: "bg-purple-900/30 text-purple-400",
  };

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setForm(EMPTY_FORM); setShowForm(true); }}
            className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 flex items-center gap-2"
          >
            <Plus size={16} />
            Add Entry
          </button>
          <button className="px-4 py-2 bg-navy-700 text-gray-400 text-sm rounded-lg hover:text-white flex items-center gap-2">
            <Upload size={14} />
            Bulk Import
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-navy-700 text-gray-400 text-sm rounded-lg hover:text-white flex items-center gap-2"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search plates, reasons..."
            className="pl-9 pr-3 py-2 bg-navy-800 border border-gray-600 rounded-lg text-sm text-white w-64 focus:outline-none focus:border-primary-500"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-navy-800 rounded-lg p-1 w-fit">
        {[
          { key: "all", label: `All (${entries.length})` },
          { key: "vehicles", label: `Vehicles (${vehicleCount})`, icon: Car },
          { key: "persons", label: `Persons (${personCount})`, icon: User },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-1.5 text-sm rounded flex items-center gap-1.5 ${
              filter === t.key
                ? "bg-primary-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t.icon && <t.icon size={14} />}
            {t.label}
          </button>
        ))}
      </div>

      {/* Message */}
      {msg && (
        <div
          className={`px-3 py-2 rounded text-sm ${
            msg.includes("Error") || msg.includes("fail")
              ? "bg-red-900/30 text-red-400"
              : "bg-green-900/30 text-green-400"
          }`}
        >
          {msg}
        </div>
      )}

      {/* Table */}
      <div className="bg-navy-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy-900 text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Identifier</th>
              <th className="px-4 py-3 text-left">Reason</th>
              <th className="px-4 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Added</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filtered.map((entry) => (
              <tr key={entry.id} className="hover:bg-navy-700/50">
                <td className="px-4 py-3">
                  {entry.type === "vehicle" ? (
                    <Car size={16} className="text-primary-400" />
                  ) : (
                    <User size={16} className="text-primary-400" />
                  )}
                </td>
                <td className="px-4 py-3 text-white font-mono font-medium">
                  {entry.plate_number || "—"}
                </td>
                <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate">
                  {entry.reason}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${
                      CAT_COLORS[entry.category] || "bg-gray-800 text-gray-400"
                    }`}
                  >
                    {entry.category || "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{entry.source_system}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(entry.added_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center text-gray-500 py-8">No watchlist entries found</div>
        )}
      </div>

      {/* Source systems */}
      <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
        <h3 className="text-xs text-gray-400 uppercase font-semibold mb-3">
          Source Systems (Representative Mock Data)
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {["VAHAN-mock", "CCTNS-mock", "manual"].map((src) => {
            const count = entries.filter((e) => e.source_system === src).length;
            return (
              <div key={src} className="bg-navy-900 rounded-lg p-3 border border-gray-700">
                <div className="flex items-center gap-2">
                  <Circle size={8} fill="#22C55E" className="text-green-500" />
                  <span className="text-sm text-white">{src}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">{count} records</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-navy-800 border border-gray-600 rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">Add Watchlist Entry</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="text-xs text-gray-400">Type *</label>
                <div className="flex gap-4 mt-1">
                  {[
                    { value: "vehicle", label: "Vehicle", icon: Car },
                    { value: "person", label: "Person", icon: User },
                  ].map((t) => (
                    <label key={t.value} className="flex items-center gap-2 text-sm text-white cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        value={t.value}
                        checked={form.type === t.value}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                        className="accent-primary-500"
                      />
                      <t.icon size={14} />
                      {t.label}
                    </label>
                  ))}
                </div>
              </div>

              {form.type === "vehicle" && (
                <div>
                  <label className="text-xs text-gray-400">Plate Number *</label>
                  <input
                    value={form.plate_number}
                    onChange={(e) => setForm({ ...form, plate_number: e.target.value.toUpperCase() })}
                    placeholder="GJ01AB1234"
                    className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1 font-mono"
                    required
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-gray-400">Category *</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400">Reason *</label>
                <input
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="e.g. Stolen Vehicle - FIR 2026/1001"
                  className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                  required
                />
              </div>

              <div>
                <label className="text-xs text-gray-400">Source</label>
                <select
                  value={form.source_system}
                  onChange={(e) => setForm({ ...form, source_system: e.target.value })}
                  className="w-full bg-navy-900 border border-gray-600 rounded px-3 py-2 text-white text-sm mt-1"
                >
                  <option value="manual">Manual Entry</option>
                  <option value="VAHAN-mock">VAHAN-mock</option>
                  <option value="CCTNS-mock">CCTNS-mock</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                >
                  {loading ? "Adding..." : "Add to Watchlist"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
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
