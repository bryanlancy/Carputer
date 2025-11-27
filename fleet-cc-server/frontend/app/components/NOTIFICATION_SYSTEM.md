# Notification System Documentation

## Overview

The notification system provides a global, app-wide notification infrastructure for displaying popup notifications to users. Notifications appear in a fixed position feed in the bottom-right corner of the screen, stacked vertically with automatic dismissal after 5 seconds.

## Architecture

### Components

1. **NotificationContext** (`app/contexts/NotificationContext.tsx`)
   - React Context provider for global notification state management
   - Provides `addNotification`, `removeNotification`, and `clearAll` functions
   - Manages notification state across all pages

2. **NotificationProviderWrapper** (`app/components/NotificationProviderWrapper.tsx`)
   - Client component wrapper that provides the NotificationContext to the app
   - Renders the NotificationFeed component globally
   - Wrapped around all pages in the root layout

3. **NotificationFeed** (`app/components/NotificationFeed.tsx`)
   - Container component that renders all active notifications
   - Fixed position in bottom-right corner
   - Handles notification stacking and layout

4. **NotificationPopup** (`app/components/NotificationPopup.tsx`)
   - Individual notification component
   - Auto-dismisses after 5 seconds
   - Supports multiple notification types with color coding

### Notification Types

The system supports the following notification types:

- `online` - Green background, checkmark icon (for success/online events)
- `offline` - Orange background, warning icon (for offline/warning events)
- `info` - Blue background, info icon (for informational messages)
- `success` - Green background, checkmark icon (for successful operations)
- `warning` - Orange background, warning icon (for warnings)
- `error` - Red background, X icon (for errors)

## Usage

### Adding Notifications

To add a notification from any component, use the `useNotifications` hook:

```typescript
import { useNotifications } from '../contexts/NotificationContext'

function MyComponent() {
  const { addNotification } = useNotifications()

  const handleEvent = () => {
    addNotification({
      title: 'Event Title',
      message: 'Event description',
      type: 'info', // 'online' | 'offline' | 'info' | 'success' | 'warning' | 'error'
    })
  }

  return <button onClick={handleEvent}>Trigger Event</button>
}
```

### Notification Interface

```typescript
interface Notification {
  id: string              // Auto-generated unique ID
  title: string           // Notification title
  message: string         // Notification message/description
  type: 'online' | 'offline' | 'info' | 'success' | 'warning' | 'error'
  timestamp: Date         // Auto-generated timestamp
}
```

### Available Functions

```typescript
const {
  notifications,        // Array of all active notifications
  addNotification,      // Function to add a new notification
  removeNotification,   // Function to remove a notification by ID
  clearAll,            // Function to clear all notifications
} = useNotifications()
```

## Integration with Backend Notifications

The notification system is designed to work with backend notifications sent via WebSocket. Backend notifications should be broadcast using the `broadcastNotification` function in `backend/src/routes/realtime.ts`.

### Backend Notification Format

Backend notifications should include:
- `title`: Notification title
- `message`: Notification message
- `notification_type`: Object with `type_code` field (e.g., 'device.online', 'device.offline')

### Frontend Integration Example

```typescript
// In a component that receives WebSocket messages
const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
  if (message.type === 'notification' && message.notification) {
    const notification = message.notification
    const notificationType =
      notification.notification_type?.type_code?.includes('online')
        ? 'online'
        : notification.notification_type?.type_code?.includes('offline')
        ? 'offline'
        : 'info'

    addNotification({
      title: notification.title || 'Notification',
      message: notification.message || 'Event occurred',
      type: notificationType,
    })
  }
}, [addNotification])
```

## Styling

### NotificationFeed Container

- **Position**: Fixed, bottom-right corner (20px from edges)
- **Z-Index**: 99999 (ensures it's above all other elements)
- **Layout**: Vertical stack with 12px gap
- **Max Height**: Viewport height minus 40px (with scrolling if needed)

### NotificationPopup

- **Size**: 300-400px width, auto height
- **Position**: Relative within the feed container
- **Animation**: Slide-in from right with fade
- **Auto-dismiss**: 5 seconds
- **Colors**: Type-specific background colors

## Customization

### Changing Auto-dismiss Time

Edit `app/components/NotificationPopup.tsx`:

```typescript
useEffect(() => {
  const timer = setTimeout(() => {
    onClose()
  }, 5000) // Change this value (milliseconds)

  return () => clearTimeout(timer)
}, [onClose])
```

### Changing Position

Edit `app/components/NotificationFeed.module.scss`:

```scss
.container {
  bottom: 20px;  // Change vertical position
  right: 20px;   // Change horizontal position
}
```

### Adding New Notification Types

1. Add the type to the `Notification` interface in `NotificationContext.tsx`
2. Add styling in `NotificationPopup.module.scss`
3. Update the `getIcon` function in `NotificationPopup.tsx` if needed

## Best Practices

1. **Keep notifications concise**: Titles and messages should be brief and clear
2. **Use appropriate types**: Match notification type to the event severity
3. **Don't spam**: Avoid creating too many notifications in quick succession
4. **Provide context**: Include relevant information in the message
5. **Handle errors gracefully**: Wrap notification creation in try-catch if needed

## Future Integration Points

The notification system is ready for integration with:

1. **Backend Notification Service**: The backend already has a `NotificationService` that creates notifications in the database. These can be broadcast via WebSocket and displayed using this system.

2. **Event-Driven Notifications**: Any backend event can trigger a notification by calling `broadcastNotification()` in the realtime route.

3. **Custom Notification Handlers**: Components can listen to WebSocket messages and create notifications based on any event type.

4. **Notification History**: The backend stores notifications in the database. A future feature could display a notification history panel.

## Files Structure

```
fleet-cc-server/frontend/app/
├── contexts/
│   └── NotificationContext.tsx      # Context provider and hook
├── components/
│   ├── NotificationFeed.tsx         # Feed container component
│   ├── NotificationFeed.module.scss # Feed styling
│   ├── NotificationPopup.tsx        # Individual notification component
│   ├── NotificationPopup.module.scss # Notification styling
│   └── NotificationProviderWrapper.tsx # Client wrapper for layout
└── layout.tsx                        # Root layout (includes NotificationProviderWrapper)
```

## Testing

To test the notification system, you can add a notification programmatically:

```typescript
const { addNotification } = useNotifications()

// Test notification
addNotification({
  title: 'Test Notification',
  message: 'This is a test',
  type: 'info',
})
```

The notification should appear in the bottom-right corner and auto-dismiss after 5 seconds.


