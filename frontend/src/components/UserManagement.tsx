import { useState, useEffect } from "react";
import api from "../services/api";
import {
  Users, Plus, Search, Edit2, Trash2, Key, Shield,
  ChevronDown, ChevronUp, X, Check, AlertTriangle,
  Mail, Phone, Building, UserCheck, Lock, Calendar,
} from "lucide-react";

const ALL_FEATURES = [
  { key: "view_live_feeds", label: "View Live Feeds" },
  { key: "playback_recording", label: "Playback / Recording" },
  { key: "search_vehicles", label: "Search Vehicles & Events" },
  { key: "view_analytics", label: "View Analytics" },
  { key: "manage_alerts", label: "Manage Alerts" },
  { key: "acknowledge_alerts", label: "Acknowledge Alerts" },
  { key: "export_data", label: "Export Data / Reports" },
  { key: "view_reports", label: "View Reports" },
  { key: "manage_cameras", label: "Manage Cameras" },
  { key: "manage_watchlist", label: "Manage Watchlist" },
  { key: "manage_users", label: "Manage Users" },
  { key: "view_audit_logs", label: "View Audit Logs" },
  { key: "system_config", label: "System Configuration" },
];

const ROLES = [
  { name: "superadmin", label: "Super Admin", level: 4, color: "text-red-400 bg-red-900/30" },
  { name: "dept_admin", label: "Department Admin", level: 3, color: "text-yellow-400 bg-yellow-900/30" },
  { name: "operator", label: "Operator", level: 2, color: "text-blue-400 bg-blue-900/30" },
  { name: "analyst", label: "Analyst", level: 2, color: "text-purple-400 bg-purple-900/30" },
  { name: "viewer", label: "Viewer", level: 1, color: "text-gray-400 bg-gray-800/50" },
  { name: "auditor", label: "Auditor", level: 1, color: "text-green-400 bg-green-900/30" },
];

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  department_id: number | null;
  is_active: boolean;
  phone: string | null;
  designation: string | null;
  employee_id: string | null;
  force_password_change: boolean;
  mfa_enabled: boolean;
  access_valid_from: string | null;
  access_valid_until: string | null;
  last_login: string | null;
  created_at: string;
  department_ids: number[];
  camera_ids: string[];
  features: string[];
}

interface Department {
  id: number;
  name: string;
  code: string;
}

interface Camera {
  id: string;
  name: string;
  department_id: number | null;
}

interface FormData {
  username: string;
  email: string;
  password: string;
  full_name: string;
  role: string;
  department_id: number | null;
  phone: string;
  designation: string;
  employee_id: string;
  force_password_change: boolean;
  mfa_enabled: boolean;
  is_active: boolean;
  access_valid_from: string;
  access_valid_until: string;
  department_ids: number[];
  camera_ids: string[];
  features: string[];
}

const EMPTY_FORM: FormData = {
  username: "", email: "", password: "", full_name: "", role: "viewer",
  department_id: null, phone: "", designation: "", employee_id: "",
  force_password_change: false, mfa_enabled: false, is_active: true,
  access_valid_from: "", access_valid_until: "",
  department_ids: [], camera_ids: [], features: [],
};

const ROLE_FEATURE_DEFAULTS: Record<string, string[]> = {
  superadmin: ALL_FEATURES.map(f => f.key),
  dept_admin: ["view_live_feeds","playback_recording","search_vehicles","view_analytics","manage_alerts","acknowledge_alerts","export_data","view_reports","manage_cameras","manage_watchlist"],
  operator: ["view_live_feeds","playback_recording","search_vehicles","view_analytics","manage_alerts","acknowledge_alerts"],
  analyst: ["view_live_feeds","playback_recording","search_vehicles","view_analytics","export_data","view_reports"],
  viewer: ["view_live_feeds"],
  auditor: ["view_audit_logs","view_reports","export_data"],
};

export default function UserManagement() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [resetModal, setResetModal] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [usersRes, deptRes, camRes] = await Promise.all([
        api.get("/auth/users", { params: { per_page: 100 } }),
        api.get("/cameras", { params: { per_page: 200 } }),
        api.get("/cameras", { params: { per_page: 500 } }),
      ]);
      setUsers(usersRes.data);
      // Extract unique departments from cameras
      const depts = new Map<number, Department>();
      deptRes.data.forEach((c: any) => {
        if (c.department_id && !depts.has(c.department_id)) {
          depts.set(c.department_id, { id: c.department_id, name: getDeptName(c.department_id), code: "" });
        }
      });
      setDepartments(Array.from(depts.values()));
      setCameras(camRes.data);
    } catch {}
    setLoading(false);
  };

  const getDeptName = (id: number) => {
    const names: Record<number, string> = {
      1: "Home Dept / Police", 2: "Municipal Corporation", 3: "RTO",
      4: "Food & Civil Supplies", 5: "Education Dept", 6: "Health Dept",
      7: "Social Justice", 8: "Tribal Development", 9: "Roads & Buildings", 10: "Urban Development",
    };
    return names[id] || `Dept ${id}`;
  };

  const filteredUsers = users.filter(u => {
    if (search && !u.username.includes(search) && !u.full_name?.includes(search) && !u.email.includes(search)) return false;
    if (roleFilter && u.role !== roleFilter) return false;
    return true;
  });

  const openCreate = () => {
    setEditingUser(null);
    setForm({ ...EMPTY_FORM, features: ROLE_FEATURE_DEFAULTS["viewer"] });
    setShowForm(true);
    setError("");
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setForm({
      username: u.username, email: u.email, password: "",
      full_name: u.full_name || "", role: u.role,
      department_id: u.department_id, phone: u.phone || "",
      designation: u.designation || "", employee_id: u.employee_id || "",
      force_password_change: u.force_password_change, mfa_enabled: u.mfa_enabled,
      is_active: u.is_active,
      access_valid_from: u.access_valid_from?.slice(0, 16) || "",
      access_valid_until: u.access_valid_until?.slice(0, 16) || "",
      department_ids: u.department_ids || [],
      camera_ids: u.camera_ids || [],
      features: u.features || ROLE_FEATURE_DEFAULTS[u.role] || [],
    });
    setShowForm(true);
    setError("");
  };

  const handleRoleChange = (role: string) => {
    setForm(f => ({
      ...f, role,
      features: ROLE_FEATURE_DEFAULTS[role] || [],
    }));
  };

  const toggleFeature = (key: string) => {
    setForm(f => ({
      ...f,
      features: f.features.includes(key)
        ? f.features.filter(k => k !== key)
        : [...f.features, key],
    }));
  };

  const toggleDept = (id: number) => {
    setForm(f => ({
      ...f,
      department_ids: f.department_ids.includes(id)
        ? f.department_ids.filter(d => d !== id)
        : [...f.department_ids, id],
    }));
  };

  const toggleCamera = (id: string) => {
    setForm(f => ({
      ...f,
      camera_ids: f.camera_ids.includes(id)
        ? f.camera_ids.filter(c => c !== id)
        : [...f.camera_ids, id],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const payload: any = {
        ...form,
        department_ids: form.department_ids.length > 0 ? form.department_ids : (form.department_id ? [form.department_id] : []),
      };
      if (!payload.password) delete payload.password;
      if (!payload.access_valid_from) payload.access_valid_from = null;
      if (!payload.access_valid_until) payload.access_valid_until = null;

      if (editingUser) {
        await api.put(`/auth/users/${editingUser.id}`, payload);
      } else {
        if (!payload.password) {
          setError("Password is required for new users");
          setSaving(false);
          return;
        }
        await api.post("/auth/register", payload);
      }
      setShowForm(false);
      loadAll();
    } catch (e: any) {
      setError(e.response?.data?.detail || e.response?.data?.error?.message || "Save failed");
    }
    setSaving(false);
  };

  const handleDelete = async (userId: number) => {
    if (!confirm("Delete this user?")) return;
    try {
      await api.delete(`/auth/users/${userId}`);
      loadAll();
    } catch {}
  };

  const handleResetPassword = async () => {
    if (!resetModal) return;
    try {
      const { data } = await api.post(`/auth/users/${resetModal}/reset-password`);
      setNewPassword(data.temporary_password);
    } catch {}
  };

  const getRoleInfo = (role: string) => ROLES.find(r => r.name === role) || ROLES[4];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={20} className="text-primary-400" />
          <h2 className="text-lg font-semibold text-white">User Management</h2>
          <span className="text-xs text-gray-500">{users.length} users</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadAll} className="px-3 py-1.5 bg-navy-700 text-gray-400 text-sm rounded hover:text-white">
            Refresh
          </button>
          <button onClick={openCreate} className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-500 flex items-center gap-1.5">
            <Plus size={14} /> Add User
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search users..."
            className="w-full pl-9 pr-3 py-2 bg-navy-800 border border-gray-600 rounded-lg text-sm text-white"
          />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="bg-navy-800 border border-gray-600 rounded px-3 py-2 text-sm text-white">
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r.name} value={r.name}>{r.label}</option>)}
        </select>
      </div>

      {/* Users Table */}
      <div className="bg-navy-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy-900 text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">User</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Department</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Last Login</th>
              <th className="px-4 py-3 text-center">Features</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {filteredUsers.map(u => {
              const ri = getRoleInfo(u.role);
              return (
                <tr key={u.id} className="hover:bg-navy-700/50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-white font-medium">{u.full_name || u.username}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                      {u.designation && <p className="text-[10px] text-gray-600">{u.designation}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${ri.color}`}>{ri.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {u.department_id ? getDeptName(u.department_id) : "All"}
                    {u.department_ids?.length > 1 && (
                      <span className="text-gray-600"> +{u.department_ids.length - 1} more</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${u.is_active ? "bg-green-900/30 text-green-400" : "bg-red-900/30 text-red-400"}`}>
                      {u.is_active ? "Active" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">
                    {u.last_login ? new Date(u.last_login).toLocaleString("en-IN") : "Never"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}
                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1 mx-auto"
                    >
                      {u.features?.length || 0} permissions
                      {expandedUser === u.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(u)} className="p-1.5 text-gray-400 hover:text-blue-400 rounded" title="Edit">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => { setResetModal(u.id); setNewPassword(""); }} className="p-1.5 text-gray-400 hover:text-yellow-400 rounded" title="Reset Password">
                        <Key size={14} />
                      </button>
                      {u.username !== "admin" && (
                        <button onClick={() => handleDelete(u.id)} className="p-1.5 text-gray-400 hover:text-red-400 rounded" title="Delete">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredUsers.length === 0 && (
          <div className="text-center text-gray-500 py-8">No users found</div>
        )}
      </div>

      {/* Expanded Permissions View */}
      {expandedUser && (() => {
        const u = users.find(u => u.id === expandedUser);
        if (!u) return null;
        return (
          <div className="bg-navy-800 rounded-lg border border-gray-700 p-4">
            <h4 className="text-sm font-semibold text-white mb-3">Permissions: {u.full_name || u.username}</h4>
            <div className="grid grid-cols-4 gap-2">
              {ALL_FEATURES.map(f => (
                <div key={f.key} className={`flex items-center gap-2 p-2 rounded text-xs ${u.features?.includes(f.key) ? "bg-green-900/20 text-green-400" : "bg-navy-900/50 text-gray-600"}`}>
                  {u.features?.includes(f.key) ? <Check size={12} /> : <X size={12} />}
                  {f.label}
                </div>
              ))}
            </div>
            {u.department_ids?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-1">Department Access:</p>
                <div className="flex gap-1.5 flex-wrap">
                  {u.department_ids.map(d => (
                    <span key={d} className="text-[10px] px-2 py-0.5 rounded bg-primary-900/30 text-primary-400">{getDeptName(d)}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Create/Edit Form Modal ──────────────────────────── */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 pt-10 overflow-y-auto">
          <div className="bg-navy-800 rounded-xl border border-gray-600 w-full max-w-3xl mb-10">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Shield size={16} className="text-primary-400" />
                {editingUser ? "Edit User" : "Create New User"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="p-6 space-y-6">
              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 text-red-400 text-sm flex items-center gap-2">
                  <AlertTriangle size={14} /> {error}
                </div>
              )}

              {/* Basic Info */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Basic Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Full Name *</label>
                    <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                      className="w-full px-3 py-2 bg-navy-900 border border-gray-600 rounded-lg text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Username *</label>
                    <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                      disabled={!!editingUser}
                      className="w-full px-3 py-2 bg-navy-900 border border-gray-600 rounded-lg text-sm text-white disabled:opacity-50" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Email *</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      className="w-full px-3 py-2 bg-navy-900 border border-gray-600 rounded-lg text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                      {editingUser ? "New Password (blank = keep)" : "Password *"}
                    </label>
                    <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="w-full px-3 py-2 bg-navy-900 border border-gray-600 rounded-lg text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Phone</label>
                    <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-navy-900 border border-gray-600 rounded-lg text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Designation</label>
                    <input value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))}
                      className="w-full px-3 py-2 bg-navy-900 border border-gray-600 rounded-lg text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Employee ID</label>
                    <input value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
                      className="w-full px-3 py-2 bg-navy-900 border border-gray-600 rounded-lg text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Department</label>
                    <select value={form.department_id || ""} onChange={e => setForm(f => ({ ...f, department_id: e.target.value ? Number(e.target.value) : null }))}
                      className="w-full px-3 py-2 bg-navy-900 border border-gray-600 rounded-lg text-sm text-white">
                      <option value="">None</option>
                      {[1,2,3,4,5,6,7,8,9,10].map(id => (
                        <option key={id} value={id}>{getDeptName(id)}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Role & Security */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Role & Security</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Role *</label>
                    <select value={form.role} onChange={e => handleRoleChange(e.target.value)}
                      className="w-full px-3 py-2 bg-navy-900 border border-gray-600 rounded-lg text-sm text-white">
                      {ROLES.map(r => <option key={r.name} value={r.name}>{r.label} (Level {r.level})</option>)}
                    </select>
                  </div>
                  <div className="flex items-end gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input type="checkbox" checked={form.force_password_change} onChange={e => setForm(f => ({ ...f, force_password_change: e.target.checked }))}
                        className="rounded border-gray-600" />
                      Force password change
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-300">
                      <input type="checkbox" checked={form.is_active !== false} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                        className="rounded border-gray-600" />
                      Active
                    </label>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Access Valid From</label>
                    <input type="datetime-local" value={form.access_valid_from} onChange={e => setForm(f => ({ ...f, access_valid_from: e.target.value }))}
                      className="w-full px-3 py-2 bg-navy-900 border border-gray-600 rounded-lg text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Access Valid Until</label>
                    <input type="datetime-local" value={form.access_valid_until} onChange={e => setForm(f => ({ ...f, access_valid_until: e.target.value }))}
                      className="w-full px-3 py-2 bg-navy-900 border border-gray-600 rounded-lg text-sm text-white" />
                  </div>
                </div>
              </div>

              {/* Department Access */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Department Access</h4>
                <div className="grid grid-cols-3 gap-2">
                  {[1,2,3,4,5,6,7,8,9,10].map(id => (
                    <button key={id} onClick={() => toggleDept(id)}
                      className={`flex items-center gap-2 p-2 rounded text-xs border transition ${
                        form.department_ids.includes(id)
                          ? "bg-primary-900/30 border-primary-500 text-primary-400"
                          : "bg-navy-900/50 border-gray-700 text-gray-500 hover:border-gray-500"
                      }`}>
                      {form.department_ids.includes(id) ? <Check size={12} /> : <div className="w-3" />}
                      {getDeptName(id)}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-600 mt-1">Select which departments this user can access. Super Admin sees all.</p>
              </div>

              {/* Camera Access */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 mb-3">Camera Access {form.camera_ids.length > 0 && `(${form.camera_ids.length} selected)`}</h4>
                <div className="max-h-40 overflow-y-auto bg-navy-900 rounded-lg p-2 border border-gray-700">
                  <div className="grid grid-cols-3 gap-1">
                    {cameras.slice(0, 50).map(c => (
                      <button key={c.id} onClick={() => toggleCamera(c.id)}
                        className={`flex items-center gap-1.5 p-1.5 rounded text-[11px] transition ${
                          form.camera_ids.includes(c.id) || form.camera_ids.length === 0
                            ? "bg-navy-800 text-gray-300"
                            : "bg-navy-900/50 text-gray-600"
                        }`}>
                        <div className={`w-2 h-2 rounded-full ${form.camera_ids.includes(c.id) ? "bg-green-400" : "bg-gray-700"}`} />
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-gray-600 mt-1">Leave empty = access to all cameras in selected departments.</p>
              </div>

              {/* Feature Permissions */}
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Feature Permissions</h4>
                <div className="grid grid-cols-3 gap-2">
                  {ALL_FEATURES.map(f => (
                    <button key={f.key} onClick={() => toggleFeature(f.key)}
                      className={`flex items-center gap-2 p-2.5 rounded text-xs border transition ${
                        form.features.includes(f.key)
                          ? "bg-green-900/20 border-green-600 text-green-400"
                          : "bg-navy-900/50 border-gray-700 text-gray-500 hover:border-gray-500"
                      }`}>
                      {form.features.includes(f.key) ? <Check size={12} /> : <X size={12} className="text-gray-600" />}
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-500 disabled:opacity-50">
                {saving ? "Saving..." : editingUser ? "Update User" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ────────────────────────────── */}
      {resetModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-navy-800 rounded-xl border border-gray-600 w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Key size={16} className="text-yellow-400" /> Reset Password
              </h3>
              <button onClick={() => setResetModal(null)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6">
              {newPassword ? (
                <div className="space-y-3">
                  <p className="text-green-400 text-sm">Password reset successfully!</p>
                  <div className="bg-navy-900 rounded-lg p-3 border border-gray-700">
                    <p className="text-xs text-gray-400 mb-1">Temporary Password:</p>
                    <p className="text-white font-mono text-lg select-all">{newPassword}</p>
                  </div>
                  <p className="text-xs text-gray-500">Share this with the user. They will be forced to change it on next login.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-gray-300 text-sm">Generate a new temporary password for this user?</p>
                  <button onClick={handleResetPassword}
                    className="w-full px-4 py-2 bg-yellow-600 text-white text-sm rounded-lg hover:bg-yellow-500">
                    Generate New Password
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
