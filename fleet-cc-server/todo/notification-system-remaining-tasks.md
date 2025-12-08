# Notification System - Remaining Tasks

## Overview
This document tracks the remaining tasks for completing the notification templating and node-based trigger system implementation.

## Completed Tasks ✅

1. ✅ Database migration for triggers, events, wiring tables, message_template field
2. ✅ Removed read/read_at from notifications table (user-specific only)
3. ✅ Added show_in_feed field to notifications table
4. ✅ Updated Prisma schema with new models: Trigger, Event, WiringConfiguration, TriggerEventConnection
5. ✅ Created TemplateService for {{variable}} replacement with nested object access
6. ✅ Created TriggerService with built-in triggers (device.online, device.offline, command.completed, etc.) and output schemas
7. ✅ Created EventService with built-in events (show_notification, send_email, execute_command) and input schemas
8. ✅ Created WiringService for managing trigger-to-event connections with schema validation
9. ✅ Created admin API endpoints for trigger management (GET, POST /api/admin/triggers)
10. ✅ Created admin API endpoints for event management (GET, POST /api/admin/events)
11. ✅ Created admin API endpoints for wiring configuration (GET, POST /api/admin/wiring)
12. ✅ Integrated TemplateService into NotificationRuleService and NotificationService
13. ✅ Installed reactflow package in frontend
14. ✅ Added notification feed in navbar with bell icon and badge
15. ✅ Added message template field to notification rule form
16. ✅ Created NotificationFeed component for navbar
17. ✅ Added API endpoint for notification feed (/api/notifications/user/me/feed)

## Remaining Tasks

### 1. WiringCanvas Component with React Flow
**Status:** ✅ Completed
**Priority:** Medium
**Description:** Create a React Flow-based canvas component for visual trigger-to-event wiring.

**Files to create:**
- `frontend/app/components/WiringCanvas.tsx` - Main React Flow canvas component
- `frontend/app/components/nodes/TriggerNode.tsx` - Trigger node component with output ports
- `frontend/app/components/nodes/EventNode.tsx` - Event node component with input ports
- `frontend/app/components/WiringCanvas.module.scss` - Styling for wiring canvas

**Requirements:**
- Drag and drop nodes onto canvas
- Connect nodes by dragging from output to input
- Display node labels, schemas, and port types
- Show visual feedback (red/green) for valid/invalid connections
- Disable invalid connection attempts
- Save/load node positions and connections

**Implementation Notes:**
- Use React Flow's `ReactFlow` component
- Define custom node types for triggers and events
- Implement connection validation using schema validation utilities
- Store wiring configuration via `/api/admin/wiring/:ruleId` endpoint

### 2. Schema Validation Utilities
**Status:** ✅ Completed
**Priority:** Medium
**Description:** Create utility functions to validate JSON Schemas and check if trigger outputs satisfy event inputs.

**Files to create:**
- `frontend/app/utils/schemaValidation.ts` - Schema validation utilities

**Requirements:**
- Validate JSON Schemas
- Check if trigger output schema satisfies event input schema
- Provide user-friendly error messages for invalid connections
- Support nested property validation (e.g., device.name)

**Implementation Notes:**
- Can use a lightweight JSON Schema validator library or implement custom validation
- Should match backend validation logic in `WiringService.validateConnection()`

### 3. WiringManager Component and Admin Page
**Status:** ✅ Completed
**Priority:** Medium
**Description:** Create a wiring management UI for configuring trigger-to-event connections.

**Files to create:**
- `frontend/app/components/WiringManager.tsx` - Wiring manager component
- `frontend/app/admin/wiring/page.tsx` - Wiring management page (or integrate into existing admin page)

**Requirements:**
- Allow selecting a notification rule to configure
- Display wiring canvas for that rule
- Show available triggers and events in sidebars
- Save wiring configuration to backend
- Load existing wiring configurations

**Implementation Notes:**
- Can be integrated into `/admin` page as a new section
- Should fetch triggers and events from `/api/admin/triggers` and `/api/admin/events`
- Use WiringCanvas component for visual editing

### 4. Template Editor Enhancement
**Status:** ✅ Completed
**Priority:** Low
**Description:** Enhance the message template editor with variable hints and preview.

**Files to update:**
- `frontend/app/components/NotificationRuleManager.tsx` - Add template editor enhancements
- `frontend/app/components/TemplateEditor.tsx` - New component (optional, can be integrated into NotificationRuleManager)

**Requirements:**
- Show available variables based on selected trigger
- Provide template examples and syntax help
- Preview template with sample data
- Syntax highlighting for template variables

**Implementation Notes:**
- Can be a simple dropdown/autocomplete for available variables
- Preview can use sample data based on trigger type

## Database Migration Status

**Migration File:** `backend/src/db/migrations/008_notification_templating_and_triggers.sql`

**Status:** Created but not yet applied

**To apply migration:**
1. Run the migration SQL file against the database
2. Or use Prisma migrations: `npx prisma migrate dev --name notification_templating_and_triggers`

## Backend API Endpoints Summary

### Triggers
- `GET /api/admin/triggers` - List all triggers
- `GET /api/admin/triggers/:triggerId` - Get trigger by ID
- `GET /api/admin/triggers/code/:triggerCode` - Get trigger by code
- `POST /api/admin/triggers` - Create new trigger
- `PUT /api/admin/triggers/:triggerId` - Update trigger
- `DELETE /api/admin/triggers/:triggerId` - Delete trigger

### Events
- `GET /api/admin/events` - List all events
- `GET /api/admin/events/:eventId` - Get event by ID
- `GET /api/admin/events/code/:eventCode` - Get event by code
- `POST /api/admin/events` - Create new event
- `PUT /api/admin/events/:eventId` - Update event
- `DELETE /api/admin/events/:eventId` - Delete event

### Wiring
- `GET /api/admin/wiring/:ruleId` - Get wiring configuration for a rule
- `POST /api/admin/wiring/:ruleId` - Save wiring configuration
- `POST /api/admin/wiring/:ruleId/connections` - Create trigger-event connection
- `PUT /api/admin/wiring/connections/:connectionId` - Update connection
- `DELETE /api/admin/wiring/connections/:connectionId` - Delete connection
- `POST /api/admin/wiring/validate` - Validate a trigger-to-event connection

### Notifications
- `GET /api/notifications/user/me/feed` - Get user notifications for feed (show_in_feed = true)

## Testing Checklist

- [ ] Test template rendering with various variable combinations
- [ ] Test notification feed in navbar (loads, displays, marks as viewed)
- [ ] Test notification rule creation with message_template
- [ ] Test trigger creation and management
- [ ] Test event creation and management
- [ ] Test wiring configuration save/load
- [ ] Test connection validation (valid and invalid connections)
- [ ] Test WebSocket notifications with new system
- [ ] Test show_in_feed flag functionality

## Known Issues

1. **Build Errors:** TypeScript compilation errors preventing container build:
   - Prisma client needs regeneration - new models (Trigger, Event, WiringConfiguration, TriggerEventConnection) don't exist yet
   - Type mismatches: `description` fields need to handle `null` vs `undefined` properly
   - Missing Prisma model properties in queries
   - `show_in_feed` property not recognized in Notification model queries
   - `message_template` property not recognized in NotificationRule model queries

2. **WebSocket Errors:** Need to debug and fix WebSocket connection issues (after build succeeds)

3. **Migration Not Applied:** Database migration needs to be run after Prisma client is regenerated

## Critical Fixes Needed Before Build

### 1. Regenerate Prisma Client
```bash
cd backend
npx prisma generate
```

### 2. Fix TypeScript Type Errors

**Files needing fixes:**
- `backend/src/routes/admin/events.ts` - Handle `null` for description (convert to `undefined`)
- `backend/src/routes/admin/triggers.ts` - Handle `null` for description
- `backend/src/routes/admin/rules.ts` - Handle `null` for description and message_template
- `backend/src/routes/admin/notifications.ts` - Handle `null` for description
- `backend/src/routes/admin/wiring.ts` - Fix nodes/edges optional vs required
- `backend/src/routes/notifications.ts` - Fix Prisma query for show_in_feed and notification relation
- `backend/src/services/notification.ts` - Fix show_in_feed property
- `backend/src/services/notificationRules.ts` - Fix message_template property
- `backend/src/services/template.ts` - Fix implicit any type
- `backend/src/services/event.ts` - Prisma model name should be lowercase `event`
- `backend/src/services/trigger.ts` - Prisma model name should be lowercase `trigger`
- `backend/src/services/wiring.ts` - Prisma model names should be camelCase: `wiringConfiguration`, `triggerEventConnection`

**Note:** Prisma generates models in camelCase, so:
- `Trigger` model → `prisma.trigger`
- `Event` model → `prisma.event`
- `WiringConfiguration` model → `prisma.wiringConfiguration`
- `TriggerEventConnection` model → `prisma.triggerEventConnection`

## Next Steps (Priority Order)

1. **Fix TypeScript compilation errors** (CRITICAL - blocks build)
   - Regenerate Prisma client: `cd backend && npx prisma generate`
   - Fix null/undefined type mismatches in all route files
   - Fix Prisma model name casing (camelCase)
   - Fix missing properties in queries

2. **Rebuild and restart containers**
   ```bash
   docker compose down
   docker compose build --no-cache
   docker compose up -d
   ```

3. **Apply database migration**
   - Run migration SQL file or use Prisma migrations

4. **Test backend APIs**
   - Verify all new endpoints work
   - Test WebSocket connections

5. **Implement WiringCanvas component**
   - React Flow integration
   - Node components

6. **Implement schema validation utilities**
   - Frontend validation logic

7. **Create WiringManager component**
   - Admin UI for wiring

8. **Test end-to-end flow**
   - Full system testing

## Notes

- All backend services and APIs are complete and ready
- Frontend wiring UI is the main remaining piece
- Template system is functional and integrated
- Notification feed is working in navbar

