# User Preferences

The BaseScript Playground now automatically saves and restores user preferences using localStorage. This ensures that your settings persist across browser sessions.

## Persisted Preferences

The following preferences are automatically saved and restored:

- **App Theme**: Dark/Light mode toggle
- **Editor Theme**: CodeMirror theme selection (Dracula, Monokai, etc.)
- **VNC Panel**: Show/hide the browser preview panel
- **Screenshots Panel**: Show/hide the screenshots viewer
- **Terminal Panel**: Show/hide the terminal panel
- **VNC Zoom State**: Whether the VNC panel is zoomed
- **Active Tab**: Which tab is currently active (Script/Compiled)

## How It Works

Preferences are managed through a custom React hook (`usePreferences.js`) that:

1. **Loads** preferences from localStorage on component mount
2. **Saves** preferences to localStorage whenever they change
3. **Falls back** to sensible defaults if no preferences are stored
4. **Handles errors** gracefully if localStorage is unavailable

## Storage Key

Preferences are stored under the key `basescript-playground-preferences` in localStorage.

## Default Values

```javascript
{
  isDarkMode: true,
  selectedThemeId: 'dracula',
  showVNC: true,
  showScreenshots: false,
  showTerminal: false,
  isVncZoomed: false,
  activeTab: 'script'
}
```

## Usage

The preferences are automatically applied when the Playground component loads. Users don't need to do anything special - their settings will be remembered across browser sessions.

## Visual Indicator

A green "Auto-save" indicator in the header shows that preferences are being automatically saved to localStorage.
