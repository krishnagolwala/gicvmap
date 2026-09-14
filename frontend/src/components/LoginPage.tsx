import { useState } from "react";
import { login as apiLogin } from "../services/api";
import { useAuthStore } from "../store/auth";
import { Shield, User, Lock } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data } = await apiLogin(username, password);
      setAuth(data.access_token, data.refresh_token, data.user);
      window.location.href = "/";
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-navy-900">
      <div className="w-full max-w-md p-8 bg-navy-800 rounded-lg shadow-xl">
        <div className="flex items-center justify-center gap-3 mb-2">
          <Shield size={28} className="text-primary-500" />
          <h1 className="text-2xl font-bold text-primary-500">GICVMAP</h1>
        </div>
        <p className="text-center text-gray-400 mb-6 text-sm">
          Gujarat Integrated CCTV Platform
        </p>

        {error && (
          <div className="bg-red-900/50 text-red-300 p-3 rounded mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
              <User size={14} />
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 bg-navy-700 border border-gray-600 rounded focus:outline-none focus:border-primary-500 text-white"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1 flex items-center gap-2">
              <Lock size={14} />
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 bg-navy-700 border border-gray-600 rounded focus:outline-none focus:border-primary-500 text-white"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-primary-600 hover:bg-primary-700 rounded font-medium disabled:opacity-50 transition flex items-center justify-center gap-2"
          >
            <Shield size={16} />
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-gray-500 text-xs mt-4">Demo: admin / admin123</p>
      </div>
    </div>
  );
}
