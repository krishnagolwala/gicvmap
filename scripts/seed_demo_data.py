#!/usr/bin/env python3
"""
GICVMAP — Seed Demo Data
Creates demo cameras, watchlist entries, and test user.
Run after docker compose up -d
"""

import asyncio
import asyncpg
import os

DB_URL = os.getenv("DATABASE_URL", "postgresql://gicvmap_admin:gicvmap_secret_2026@localhost:5432/gicvmap")


async def seed():
    conn = await asyncpg.connect(DB_URL)
    try:
        # Check if data already exists
        count = await conn.fetchval("SELECT COUNT(*) FROM cameras")
        if count > 0:
            print(f"Database already has {count} cameras. Skipping seed.")
            return

        # Seed cameras
        cameras = [
            ("SG Highway Junction Cam 1", 1, "ip", "Hikvision", "DS-2CD2T47",
             "rtsp://localhost:8554/cam1", 23.0410, 72.5645, "online",
             "SG Highway near Science City Road"),
            ("Vastrapur Lake Cam", 1, "ip", "Dahua", "IPC-HFW5442T",
             "rtsp://localhost:8554/cam2", 23.0365, 72.5294, "online",
             "Vastrapur Lake Park entrance"),
            ("CG Road Circle Cam", 2, "ip", "Hikvision", "DS-2CD2T47",
             "rtsp://localhost:8554/cam3", 23.0385, 72.5520, "online",
             "CG Road Circle near Navrangpura"),
            ("Ahmedabad Railway Station", 3, "ip", "CP Plus", "CP-URC-TC41",
             "rtsp://localhost:8554/cam4", 23.0235, 72.6365, "degraded",
             "Main entrance platform view"),
            ("Gandhinagar Sector 16 Cam", 1, "ip", "Hikvision", "DS-2CD2T47",
             "rtsp://localhost:8554/cam5", 23.2156, 72.6326, "online",
             "Sector 16 main road junction"),
            ("Surat Ring Road Cam 1", 4, "ip", "Dahua", "IPC-HFW5442T",
             "rtsp://localhost:8554/cam6", 21.1702, 72.8311, "online",
             "Ring Road near Athwa Gate"),
            ("Vadodara Sayaji Baug Cam", 5, "ip", "CP Plus", "CP-URC-TC41",
             "rtsp://localhost:8554/cam7", 22.3305, 73.1845, "online",
             "Sayaji Baug main gate"),
            ("Rajkot Market Yard Cam", 2, "ip", "Hikvision", "DS-2CD2T47",
             "rtsp://localhost:8554/cam8", 22.3039, 70.8022, "offline",
             "Agricultural market yard entrance"),
        ]

        for cam in cameras:
            await conn.execute("""
                INSERT INTO cameras (name, department_id, camera_type, vendor, model,
                    rtsp_url, lat, lng, status, location_description)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            """, *cam)
        print(f"Created {len(cameras)} cameras")

        # Seed watchlist
        watchlist = [
            ("vehicle", "GJ01AB1234", "Stolen white Swift Dzire reported in FIR #2026/4521",
             "stolen_vehicle", "critical"),
            ("vehicle", "GJ05CD5678", "Suspect vehicle in robbery case FIR #2026/3892",
             "suspect", "high"),
            ("vehicle", "GJ27EF9012", "Blacklisted for unpaid toll violations",
             "blacklisted", "medium"),
            ("vehicle", "GJ03GH3456", "Missing person vehicle - last seen 2026-08-25",
             "missing_person", "high"),
            ("person", None, "Wanted in connection with extortion case",
             "wanted_person", "critical"),
        ]

        for wl in watchlist:
            await conn.execute("""
                INSERT INTO watchlist (type, plate_number, reason, category, priority, added_by)
                VALUES ($1, $2, $3, $4, $5, 'admin')
            """, *wl)
        print(f"Created {len(watchlist)} watchlist entries")

        print("Seed completed successfully!")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
