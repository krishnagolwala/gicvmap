# Frontend Design & UX Specification
## GICVMAP — React Dashboard

---

## 1. Design Principles

| Principle | Implementation |
|-----------|---------------|
| Control Room First | Optimized for large displays, dark theme |
| Information Density | Show maximum data with minimal clutter |
| Real-Time Updates | Live data without page refresh |
| Responsive | Works on laptop (1366x768) to 4K displays |
| Accessibility | WCAG 2.1 AA compliance target |

---

## 2. Color Palette

```css
:root {
  /* Primary */
  --primary-500: #3B82F6;    /* Blue */
  --primary-600: #2563EB;
  --primary-700: #1D4ED8;

  /* Status Colors */
  --success: #22C55E;        /* Online, acknowledged */
  --warning: #F59E0B;        /* Degraded, medium severity */
  --danger: #EF4444;         /* Offline, critical severity */
  --info: #06B6D4;           /* Informational */

  /* Severity Colors */
  --severity-critical: #DC2626;
  --severity-high: #F97316;
  --severity-medium: #EAB308;
  --severity-low: #6B7280;

  /* Camera Status */
  --camera-online: #22C55E;
  --camera-offline: #EF4444;
  --camera-degraded: #F59E0B;
  --camera-unknown: #6B7280;

  /* Backgrounds */
  --bg-primary: #0F172A;     /* Dark navy */
  --bg-secondary: #1E293B;
  --bg-card: #1E293B;
  --bg-hover: #334155;

  /* Text */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
}
```

---

## 3. Page Layouts

### 3.1 Main Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌──────┐  GICVMAP  ┌──────┐  ┌──────────────────┐  ┌──────┐│
│  │ ☰    │  Header   │ 🔔 3 │  │  Search...       │  │ 👤   ││
│  └──────┘           └──────┘  └──────────────────┘  └──────┘│
│                                                                │
│  ┌──────────┐┌──────────────────────────────────────────────┐│
│  │          ││                                              ││
│  │  🗺️ Map ││              Main Content Area                ││
│  │          ││                                              ││
│  │  📹 Video││         (Depends on active page)             ││
│  │          ││                                              ││
│  │  🔍 Sear ││                                              ││
│  │          ││                                              ││
│  │  🔔 Aler ││                                              ││
│  │          ││                                              ││
│  │  📷 Came ││                                              ││
│  │          ││                                              ││
│  │  📋 Watch││                                              ││
│  │          ││                                              ││
│  └──────────┘└──────────────────────────────────────────────┘│
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐│
│  │ Status Bar: 42 online │ 1,250 detections today │ 5 alerts││
│  └──────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 GIS Map Page (Home)

```
┌─────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    FULL-WIDTH LEAFLET MAP                  │ │
│  │                                                            │ │
│  │    📍 (green=online)                                       │ │
│  │         📍 📍                                              │ │
│  │              📍     📍 (red=offline)                       │ │
│  │    📍              📍                                      │ │
│  │                   📍                                       │ │
│  │         📍           📍 (yellow=degraded)                  │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────┐        │ │
│  │  │ 🔍 Filter: [Department ▼] [Status ▼] [Type ▼]│        │ │
│  │  └──────────────────────────────────────────────┘        │ │
│  │                                                            │ │
│  │  ┌──────────────────┐  ┌──────────────────────────┐      │ │
│  │  │ Camera Popup     │  │ Route Overlay (when       │      │ │
│  │  │ ┌──────────────┐ │  │ vehicle search active)    │      │ │
│  │  │ │ Live Preview │ │  │                            │      │ │
│  │  │ │ (WebRTC)     │ │  │  ●━━━━━━━━●━━━━━━━━●      │      │ │
│  │  │ └──────────────┘ │  │  1        2        3      │      │ │
│  │  │ Name: Cam 3      │  │  08:15    09:30    11:45  │      │ │
│  │  │ Status: Online   │  │                            │      │ │
│  │  │ Dept: Police     │  └──────────────────────────┘      │ │
│  │  │ [View] [Details]│                                      │ │
│  │  └──────────────────┘                                      │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Video Wall Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Video Wall  │  Grid: [2x2] [3x3] [4x4]  │  Select Cameras ▼  │
│─────────────────────────────────────────────────────────────────│
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │                      │  │                      │            │
│  │   Camera 1 (Live)    │  │   Camera 2 (Live)    │            │
│  │   Ring Road Junction │  │   SG Highway Cam 1   │            │
│  │                      │  │                      │            │
│  │  ┌────┐ ┌────┐      │  │  ┌────┐ ┌────┐      │            │
│  │  │ ▶  │ │ 🔊 │      │  │  │ ▶  │ │ 🔊 │      │            │
│  │  └────┘ └────┘      │  │  └────┘ └────┘      │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                  │
│  ┌──────────────────────┐  ┌──────────────────────┐            │
│  │                      │  │                      │            │
│  │   Camera 3 (Live)    │  │   Camera 4 (Offline) │            │
│  │   Vastrapur Lake     │  │   ⚠️ Connection Lost  │            │
│  │                      │  │                      │            │
│  │  ┌────┐ ┌────┐      │  │  [Retry] [Remove]    │            │
│  │  │ ▶  │ │ 🔊 │      │  │                      │            │
│  │  └────┘ └────┘      │  │                      │            │
│  └──────────────────────┘  └──────────────────────┘            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 Vehicle Search Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Vehicle Search                                                  │
│─────────────────────────────────────────────────────────────────│
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🔍 Enter vehicle registration number:                     │  │
│  │ ┌──────────────────────────────────────────┐  [Search]    │  │
│  │ │ GJ01AB1234                               │              │  │
│  │ └──────────────────────────────────────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐│
│  │ Detection Timeline   │  │ Route Map                         ││
│  │                      │  │                                    ││
│  │ 1. 📍 Ring Road      │  │  ┌────────────────────────────┐  ││
│  │    08:15:00          │  │  │                            │  ││
│  │    Confidence: 92%   │  │  │  ●━━━━━━━━●━━━━━━━━●      │  ││
│  │    [📷 Snapshot]     │  │  │  1        2        3      │  ││
│  │                      │  │  │  08:15    09:30    11:45  │  ││
│  │ 2. 📍 SG Highway     │  │  │                            │  ││
│  │    09:30:00          │  │  │  Distance: 5.8 km         │  ││
│  │    Confidence: 85%   │  │  │  Duration: 15 min         │  ││
│  │    [📷 Snapshot]     │  │  │  Avg Speed: 23 km/h       │  ││
│  │                      │  │  └────────────────────────────┘  ││
│  │ 3. 📍 Vastrapur Lake │  │                                    ││
│  │    11:45:00          │  │                                    ││
│  │    Confidence: 78%   │  │                                    ││
│  │    [📷 Snapshot]     │  │                                    ││
│  │                      │  │                                    ││
│  │ ──────────────────── │  │                                    ││
│  │ Total: 8 detections  │  │                                    ││
│  │ Cameras: 5           │  │                                    ││
│  │ [Export CSV] [Export PDF]│                                  ││
│  └─────────────────────┘  └──────────────────────────────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.5 Alerts Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Alerts  │  New: 5  │  Acknowledged: 12  │  Total: 17          │
│─────────────────────────────────────────────────────────────────│
│                                                                  │
│  Filters: [Status ▼] [Severity ▼] [Camera ▼] [Date Range]     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ 🔴 CRITICAL  │ Stolen Vehicle - FIR 2026/1123            │  │
│  │ GJ01AB1234   │ Ring Road Junction Cam 3                  │  │
│  │ 14:32:07     │ [📷 View] [✓ Acknowledge] [✕ Dismiss]    │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 🟠 HIGH      │ Wanted Person - CCTNS Match               │  │
│  │ Face Match   │ SG Highway Cam 1                          │  │
│  │ 14:30:15     │ [📷 View] [✓ Acknowledge] [✕ Dismiss]    │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ 🟡 MEDIUM    │ Blacklisted Vehicle                       │  │
│  │ GJ02CD5678   │ Vastrapur Lake Cam 2                      │  │
│  │ 14:28:00     │ [📷 View] [✓ Acknowledge] [✕ Dismiss]    │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ ⚪ LOW       │ Expired Registration Detected              │  │
│  │ GJ03EF9012   │ Science City Road Cam 1                   │  │
│  │ 14:25:30     │ [📷 View] [✓ Acknowledge] [✕ Dismiss]    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.6 Camera Management Page

```
┌─────────────────────────────────────────────────────────────────┐
│  Camera Management  │  [+ Add Camera]  │  [📥 Bulk Import]     │
│─────────────────────────────────────────────────────────────────│
│                                                                  │
│  Search: [____________]  Filter: [Dept ▼] [Type ▼] [Status ▼]  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Name          │ Dept    │ Type │ Status │ Last Seen │ Act │  │
│  ├───────────────┼─────────┼──────┼────────┼───────────┼─────┤  │
│  │ Ring Road C3  │ Police  │ IP   │ 🟢 ON  │ 14:32     │ ⚙️  │  │
│  │ SG Highway C1 │ Muni    │ IP   │ 🟢 ON  │ 14:31     │ ⚙️  │  │
│  │ Vastrapur C2  │ Police  │ IP   │ 🟡 DEG │ 14:30     │ ⚙️  │  │
│  │ RTO Office C1 │ RTO     │Analog│ 🔴 OFF │ 12:00     │ ⚙️  │  │
│  │ Food Depot C3 │ FCS     │ IP   │ 🟢 ON  │ 14:32     │ ⚙️  │  │
│  │ ...           │         │      │        │           │     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Pagination: [← Prev] 1 2 3 ... 5 [Next →]                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Component Library

### 4.1 Core Components

| Component | Description | Props |
|-----------|-------------|-------|
| `GisMap` | Leaflet map container | cameras, route, alerts |
| `CameraMarker` | Camera pin on map | camera, onClick |
| `RoutePolyline` | Vehicle route overlay | waypoints, color |
| `AlertMarker` | Pulsing alert marker | alert, severity |
| `VideoTile` | Single camera video player | cameraId, protocol |
| `VideoWall` | Multi-camera grid | cameras, gridSize |
| `AlertCard` | Alert notification card | alert, onAcknowledge |
| `AlertBadge` | Unread alert count | count |
| `DetectionTable` | Detection history table | detections |
| `CameraForm` | Add/edit camera form | camera, onSubmit |
| `BulkUpload` | CSV upload component | entityType, onUpload |
| `WatchlistForm` | Add/edit watchlist entry | entry, onSubmit |
| `SearchInput` | Debounced search input | onSearch, placeholder |
| `DataTable` | Sortable/paginated table | columns, data |

### 4.2 State Management (Zustand)

```typescript
// stores/alertStore.ts
import { create } from 'zustand';

interface Alert {
  id: number;
  plate_number: string;
  camera_name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'new' | 'acknowledged' | 'dismissed';
  triggered_at: string;
  snapshot_url: string;
}

interface AlertStore {
  alerts: Alert[];
  unreadCount: number;
  addAlert: (alert: Alert) => void;
  acknowledgeAlert: (id: number) => void;
  dismissAlert: (id: number) => void;
  setAlerts: (alerts: Alert[]) => void;
}

export const useAlertStore = create<AlertStore>((set) => ({
  alerts: [],
  unreadCount: 0,
  addAlert: (alert) => set((state) => ({
    alerts: [alert, ...state.alerts],
    unreadCount: state.unreadCount + 1
  })),
  acknowledgeAlert: (id) => set((state) => ({
    alerts: state.alerts.map(a =>
      a.id === id ? { ...a, status: 'acknowledged' } : a
    ),
    unreadCount: Math.max(0, state.unreadCount - 1)
  })),
  dismissAlert: (id) => set((state) => ({
    alerts: state.alerts.map(a =>
      a.id === id ? { ...a, status: 'dismissed' } : a
    ),
    unreadCount: Math.max(0, state.unreadCount - 1)
  })),
  setAlerts: (alerts) => set({ alerts }),
}));
```

---

## 5. Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 768px | Single column, collapsed sidebar |
| Tablet | 768-1024px | 2-column, collapsible sidebar |
| Laptop | 1024-1440px | Full sidebar, standard layout |
| Desktop | 1440-2560px | Full sidebar, expanded content |
| 4K Display | > 2560px | Optimized for control room large screens |

---

*End of Frontend Design Specification*
