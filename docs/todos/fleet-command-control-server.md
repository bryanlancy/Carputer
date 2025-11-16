# Fleet Command & Control Server

- **Status:** not-started
- **Expected Time:** 60-80 hours

## Description
Design and implement a central web service that tracks Raspberry Pis running the Carputer stack, compares deployed versions, collects health metrics, orchestrates remote operations (log sync, updates, command execution), and coordinates automatic association to a designated headquarters Wi-Fi network whenever it is in range. The system should integrate with the existing NFS-root and rsync workflows while remaining deployable on local infrastructure.

## Proposed Steps
1. **Define Requirements & Architecture**
   - Inventory device metadata to track (hostname, VIN, IP, hardware rev, build ID, last seen, service status).
   - Map core user workflows: status dashboard, version diffing, batch commands, log retrieval, OTA update triggers.
   - Decide hosting environment (e.g., dedicated NUC, cloud VM, container on NAS) and network trust model.
   - Sketch high-level architecture (API server, device agent endpoints, storage, UI) and data flow between rsync share/NFS root.
2. **Select Tech Stack & Bootstrap Repo**
   - Frontend: Next.js with Node.js + TypeScript, SCSS modules for styling, and GSAP for animation.
   - Backend: Self-hosted Supabase deployment (PostgreSQL + Auth + Realtime) following Supabase self-hosting docs; wrap APIs in Node.js services packaged via Docker.
   - Plan container orchestration (docker-compose initially) to run Supabase stack, API services, and Web UI together.
   - Ensure WebSocket/Realtime channels are exposed via Supabase Realtime or complementary Node-based gateway for device telemetry.
   - Scaffold project structure, CI workflow, and container build/push pipeline.
3. **Headquarters Wi-Fi Auto-Connect**
   - Define SSID/security parameters for the headquarters network and credential provisioning workflow.
   - Extend Buildroot image/config management to ship supplicant profiles that prefer the HQ network when detected.
   - Ensure device-initiated connection attempts to the command server begin immediately upon HQ association; retry every 15 seconds while connected, honoring a configurable max retry window (minutes) before backing off.
   - Document fallback behavior when HQ network is unavailable (e.g., stay on vehicular hotspot, exponential backoff).
4. **Device Registration & Authentication**
   - Define registration protocol (pre-shared token vs. mutual TLS) and trust onboarding flow.
   - Implement device heartbeat endpoint (REST/WebSocket) capturing version hash, uptime, rsync timestamp.
   - Store devices in DB with status transitions (online, offline, stale, maintenance).
4. **Version Tracking & Comparison**
   - Integrate with Buildroot artifact metadata to compute authoritative “latest” version (e.g., git SHA, build stamp).
   - Implement API/UI to compare device-reported versions to latest and flag drift.
   - Hook into existing build scripts to publish new version metadata to the server automatically.
5. **Command Dispatch & Job Queue**
   - Model commands (reboot, start/stop services, trigger rsync, collect logs) with audit trail.
   - Implement job queue with retry/backoff and device acknowledgements.
   - Secure command execution path on devices (existing SSH, rsync post-processing, or lightweight agent).
6. **Log & Data Synchronization**
   - Define directory structure within rsync target for uploaded logs/sensor data per device.
   - Build ingestion pipeline that indexes new uploads and exposes them via API/UI with filtering.
   - Add retention policy and hooks for alerting on anomalous data (optional stretch goal).
7. **Web UI Development**
   - Create dashboards for fleet overview, device detail pages, command history, and data downloads.
   - Implement live status indicators and notifications (WebSocket/EventSource).
   - Ensure responsive layout and follow shared UI component standards.
8. **Security & Access Control**
   - Add user authentication (local accounts/OIDC) with role-based permissions (viewer, operator, admin).
   - Enforce HTTPS, secure secrets storage, and logging of privileged actions.
   - Document threat model and incident response procedures.
9. **Observability & Reliability**
   - Instrument backend with metrics, structured logs, and health checks.
   - Configure alerting for device offline thresholds, failed commands, or rsync delays.
   - Plan for backups of database and configuration.
10. **Testing & Validation**
    - Build integration tests with simulated device agents.
    - Create staging environment mirroring production deployment.
    - Pilot with a subset of vehicles, gather feedback, and iterate.
11. **Documentation & Rollout**
    - Produce operator handbook, device onboarding guide, and troubleshooting playbook.
    - Update Buildroot/NFS deployment docs to reference command server integration.
    - Schedule training/demo and track rollout tasks in project management tooling.

## Dependencies
- Stable NFS-root deployment with reliable rsync synchronization.
- Access to device inventory and current deployment tooling.
- Network connectivity between fleet and hosting environment (consider VPN).
- Centralized management of headquarters Wi-Fi credentials and coverage map.

## Open Questions
- Preferred authentication mechanism between server and edge devices?
- Desired retention period and storage budget for logs/sensor data?
- Should the command server integrate with existing CI/CD or remain standalone initially?
- How should devices authenticate to the headquarters Wi-Fi (WPA2-Enterprise, WPA2-PSK, certificates)?
- Do we need geo-fencing or manual overrides before devices auto-associate with headquarters Wi-Fi?

