import { create } from "zustand";

interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  department_id: number | null;
  permissions: string[];
  department_ids: number[];
  camera_ids: string[];
  features: string[];
}

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  setAuth: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
  hasFeature: (feature: string) => boolean;
  canAccessCamera: (cameraId: string) => boolean;
  canAccessDepartment: (deptId: number) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: localStorage.getItem("token"),
  refreshToken: localStorage.getItem("refreshToken"),
  user: JSON.parse(localStorage.getItem("user") || "null"),
  setAuth: (token, refreshToken, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("refreshToken", refreshToken);
    localStorage.setItem("user", JSON.stringify(user));
    set({ token, refreshToken, user });
  },
  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    set({ token: null, refreshToken: null, user: null });
  },
  hasFeature: (feature: string) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === "superadmin") return true;
    return user.features?.includes(feature) ?? false;
  },
  canAccessCamera: (cameraId: string) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === "superadmin") return true;
    if (!user.camera_ids || user.camera_ids.length === 0) return true;
    return user.camera_ids.includes(cameraId);
  },
  canAccessDepartment: (deptId: number) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === "superadmin") return true;
    if (!user.department_ids || user.department_ids.length === 0) {
      return user.department_id === deptId;
    }
    return user.department_ids.includes(deptId);
  },
}));
