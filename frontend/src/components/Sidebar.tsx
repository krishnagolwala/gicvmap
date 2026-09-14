import { useAuthStore } from "../store/auth";
import {
  Map,
  Video,
  Car,
  Bell,
  Camera,
  ClipboardList,
  BarChart3,
  LogOut,
  User,
  Users,
  Plug,
  Shield,
  Brain,
  Zap,
} from "lucide-react";

const NAV_ITEMS = [
  { key: "map", icon: Map, label: "Map Dashboard" },
  { key: "video", icon: Video, label: "Video Wall" },
  { key: "search", icon: Car, label: "Vehicle Search" },
  { key: "alerts", icon: Bell, label: "Alerts", badge: true },
  { key: "alert-rules", icon: Zap, label: "Alert Rules & Analytics" },
  { key: "cameras", icon: Camera, label: "Camera Registry" },
  { key: "watchlist", icon: ClipboardList, label: "Watchlist" },
  { key: "ai-status", icon: Brain, label: "AI & Processing" },
  { key: "integrations", icon: Plug, label: "Integrations" },
  { key: "users", icon: Users, label: "User Management" },
  { key: "admin", icon: Shield, label: "Security & Audit" },
  { key: "reports", icon: BarChart3, label: "Reports" },
];

interface Props {
  active: string;
  onSelect: (key: string) => void;
  alertCount: number;
}

export default function Sidebar({ active, onSelect, alertCount }: Props) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const hasFeature = useAuthStore((s) => s.hasFeature);

  const canSeeItem = (key: string) => {
    if (!user) return false;
    if (user.role === "superadmin") return true;
    switch (key) {
      case "users": return hasFeature("manage_users");
      case "admin": return hasFeature("view_audit_logs");
      case "cameras": return hasFeature("manage_cameras");
      case "watchlist": return hasFeature("manage_watchlist");
      case "alert-rules": return hasFeature("manage_alerts");
      case "reports": return hasFeature("view_reports");
      case "ai-status": return hasFeature("view_analytics");
      case "integrations": return hasFeature("view_analytics");
      default: return true;
    }
  };

  return (
    <aside className="w-56 bg-navy-800 border-r border-gray-700 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-700">
        <h1 className="text-base font-bold text-primary-500">GICVMAP</h1>
        <p className="text-[10px] text-gray-500 mt-0.5">Gujarat CCTV Platform</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.filter(item => canSeeItem(item.key)).map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                active === item.key
                  ? "bg-primary-600/20 text-primary-400 shadow-[inset_2px_0_0_#3b82f6]"
                  : "text-gray-400 hover:text-white hover:bg-navy-700"
              }`}
            >
              <Icon size={18} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge && alertCount > 0 && (
                <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono min-w-[20px] text-center">
                  {alertCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="border-t border-gray-700 p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-primary-600/30 flex items-center justify-center">
            <User size={14} className="text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white truncate">{user?.full_name || user?.username}</p>
            <p className="text-[10px] text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 text-xs text-gray-500 hover:text-red-400 px-2 py-1 transition"
        >
          <LogOut size={14} />
          Logout
        </button>
      </div>
    </aside>
  );
}
