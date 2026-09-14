import { useState, useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";

interface AlertEvent {
  id: number;
  plate_number: string;
  severity: string;
  camera_name: string;
  watchlist_reason: string;
  triggered_at: string;
}

interface Props {
  alerts: AlertEvent[];
}

export default function AlertToast({ alerts }: Props) {
  const [visible, setVisible] = useState<AlertEvent[]>([]);

  useEffect(() => {
    if (alerts.length > 0) {
      const latest = alerts[0];
      const age = Date.now() - new Date(latest.triggered_at).getTime();
      if (age < 10000) {
        setVisible((prev) => [latest, ...prev].slice(0, 3));
        setTimeout(() => {
          setVisible((prev) => prev.filter((a) => a.id !== latest.id));
        }, 8000);
      }
    }
  }, [alerts.length]);

  if (visible.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 pointer-events-none">
      {visible.map((alert) => (
        <div
          key={alert.id}
          className="pointer-events-auto bg-navy-800 border border-red-500/50 rounded-lg p-3 shadow-2xl max-w-xs"
          style={{ animation: "slideIn 0.3s ease-out" }}
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-xs font-bold text-red-400 uppercase">Watchlist Alert</span>
          </div>
          <p className="text-sm text-white font-medium font-mono">{alert.plate_number}</p>
          <p className="text-xs text-gray-400">{alert.camera_name}</p>
          <p className="text-[10px] text-gray-500 mt-1">{alert.watchlist_reason}</p>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px] text-gray-500 font-mono">
              {new Date(alert.triggered_at).toLocaleTimeString("en-IN")}
            </span>
            <button
              onClick={() => setVisible((prev) => prev.filter((a) => a.id !== alert.id))}
              className="text-gray-500 hover:text-white"
            >
              <X size={12} />
            </button>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
