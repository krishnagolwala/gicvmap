import axios from "axios";
import { useAuthStore } from "../store/auth";

const api = axios.create({ baseURL: "/api/v1" });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refresh = useAuthStore.getState().refreshToken;
      if (refresh) {
        try {
          const { data } = await axios.post("/api/v1/auth/refresh", { refresh_token: refresh });
          useAuthStore.getState().setAuth(data.access_token, refresh, useAuthStore.getState().user!);
          error.config.headers.Authorization = `Bearer ${data.access_token}`;
          return api.request(error.config);
        } catch {
          useAuthStore.getState().logout();
          window.location.href = "/login";
        }
      }
    }
    return Promise.reject(error);
  }
);

export const login = (username: string, password: string) =>
  api.post("/auth/login", { username, password });

export const getMe = () => api.get("/auth/me");

// Cameras
export const getCameras = (params?: Record<string, any>) => api.get("/cameras", { params });
export const getCamera = (id: string) => api.get(`/cameras/${id}`);
export const createCamera = (data: any) => api.post("/cameras", data);
export const updateCamera = (id: string, data: any) => api.put(`/cameras/${id}`, data);
export const deleteCamera = (id: string) => api.delete(`/cameras/${id}`);
export const getNearbyCameras = (lat: number, lng: number, radius?: number) =>
  api.get("/cameras/nearby", { params: { lat, lng, radius_m: radius || 5000 } });

// Watchlist
export const getWatchlist = (params?: Record<string, any>) => api.get("/watchlist", { params });
export const createWatchlist = (data: any) => api.post("/watchlist", data);
export const deleteWatchlist = (id: number) => api.delete(`/watchlist/${id}`);
export const matchPlate = (plate: string) => api.post("/watchlist/match", null, { params: { plate_number: plate } });

// Alerts
export const getAlerts = (params?: Record<string, any>) => api.get("/alerts", { params });
export const getAlertCount = (status?: string) => api.get("/alerts/count", { params: { status } });
export const acknowledgeAlert = (id: number) => api.post(`/alerts/${id}/acknowledge`);
export const dismissAlert = (id: number) => api.post(`/alerts/${id}/dismiss`);
export const exportAlertsCsv = (params?: Record<string, any>) =>
  api.get("/alerts/export/csv", { params, responseType: "blob" });

// Alert Rules
export const getAlertRules = () => api.get("/alerts/rules/list");
export const createAlertRule = (data: any) => api.post("/alerts/rules", null, { params: data });
export const updateAlertRule = (id: number, data: any) => api.put(`/alerts/rules/${id}`, null, { params: data });
export const deleteAlertRule = (id: number) => api.delete(`/alerts/rules/${id}`);

// Search
export const searchVehicle = (data: any) => api.post("/vehicles/search", data);
export const getRecentVehicles = (limit?: number) =>
  api.get("/vehicles/recent", { params: { limit: limit || 30 } });
export const vehicleTimeline = (plate: string, params?: Record<string, any>) =>
  api.get(`/vehicles/${plate}/timeline`, { params });
export const exportVehicleCsv = (plate: string, params?: Record<string, any>) =>
  api.get(`/vehicles/${plate}/export/csv`, { params, responseType: "blob" });

// Stats
export const getDetectionStats = (hours?: number) =>
  api.get("/stats/detections", { params: { hours } });
export const getCameraStats = () => api.get("/stats/cameras");

// Section 4: Analytics
export const getCountingStats = (hours?: number) =>
  api.get("/stats/counting", { params: { hours } });
export const getAnomalies = (hours?: number) =>
  api.get("/stats/anomalies", { params: { hours } });

// Section 7: Integrations
export const getIntegrationStatus = () => api.get("/integrations/status");
export const getAdapters = () => api.get("/integrations/adapters");
export const vahanLookup = (plate: string) =>
  api.get("/integrations/vahan/lookup", { params: { plate_number: plate } });
export const sarthiAlerts = (params?: Record<string, any>) =>
  api.get("/integrations/sarthi/alerts", { params });
export const egujcopFirs = (params?: Record<string, any>) =>
  api.get("/integrations/egujcop/firs", { params });
export const correlateEvents = (plate: string) =>
  api.get("/integrations/correlate", { params: { plate_number: plate } });

// Section 8: Admin
export const getAuditLogs = (params?: Record<string, any>) =>
  api.get("/auth/audit", { params });
export const getAuditStats = () => api.get("/auth/audit/stats");
export const getSystemSecurity = () => api.get("/auth/system/security");
export const getSystemConfig = () => api.get("/auth/system/config");

// User Management
export const getUsers = (params?: Record<string, any>) =>
  api.get("/auth/users", { params });
export const getUser = (id: number) => api.get(`/auth/users/${id}`);
export const createUser = (data: any) => api.post("/auth/register", data);
export const updateUser = (id: number, data: any) => api.put(`/auth/users/${id}`, data);
export const deleteUser = (id: number) => api.delete(`/auth/users/${id}`);
export const resetPassword = (id: number) => api.post(`/auth/users/${id}/reset-password`);
export const getPermissionFeatures = () => api.get("/auth/permissions/features");
export const getPermissionRoles = () => api.get("/auth/permissions/roles");

// Section 9: Reports
export const getGapAnalysis = () => api.get("/reports/gap-analysis");
export const getUtilisation = (hours?: number) =>
  api.get("/reports/utilisation", { params: { hours } });
export const getAnalyticsQuality = (hours?: number) =>
  api.get("/reports/quality", { params: { hours } });
export const getScalability = () => api.get("/reports/scalability");

export default api;
