import { useState } from 'react';

// Default preferences
const DEFAULT_PREFERENCES = {
  isDarkMode: true,
  selectedThemeId: 'dracula',
  showVNC: true,
  showScreenshots: false,
  showTerminal: false,
  isVncZoomed: false,
  activeTab: 'script',
};

// Storage key for localStorage
const STORAGE_KEY = 'basescript-playground-preferences';

/**
 * Custom hook for managing user preferences with localStorage persistence
 * @param {string} key - The preference key to manage
 * @param {any} defaultValue - Default value if not found in localStorage
 * @returns {[any, function]} - [value, setValue] tuple
 */
export function usePreference(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const preferences = JSON.parse(stored);
        return preferences[key] !== undefined ? preferences[key] : defaultValue;
      }
    } catch (error) {
      console.warn('Failed to load preferences from localStorage:', error);
    }
    return defaultValue;
  });

  const setPreference = (newValue) => {
    try {
      setValue(newValue);
      
      // Update localStorage
      const stored = localStorage.getItem(STORAGE_KEY);
      const preferences = stored ? JSON.parse(stored) : { ...DEFAULT_PREFERENCES };
      preferences[key] = newValue;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    } catch (error) {
      console.warn('Failed to save preferences to localStorage:', error);
    }
  };

  return [value, setPreference];
}

/**
 * Hook for managing all preferences at once
 * @returns {object} - Object containing all preferences and their setters
 */
export function useAllPreferences() {
  const [isDarkMode, setIsDarkMode] = usePreference('isDarkMode', DEFAULT_PREFERENCES.isDarkMode);
  const [selectedThemeId, setSelectedThemeId] = usePreference('selectedThemeId', DEFAULT_PREFERENCES.selectedThemeId);
  const [showVNC, setShowVNC] = usePreference('showVNC', DEFAULT_PREFERENCES.showVNC);
  const [showScreenshots, setShowScreenshots] = usePreference('showScreenshots', DEFAULT_PREFERENCES.showScreenshots);
  const [showTerminal, setShowTerminal] = usePreference('showTerminal', DEFAULT_PREFERENCES.showTerminal);
  const [isVncZoomed, setIsVncZoomed] = usePreference('isVncZoomed', DEFAULT_PREFERENCES.isVncZoomed);
  const [activeTab, setActiveTab] = usePreference('activeTab', DEFAULT_PREFERENCES.activeTab);

  return {
    isDarkMode,
    setIsDarkMode,
    selectedThemeId,
    setSelectedThemeId,
    showVNC,
    setShowVNC,
    showScreenshots,
    setShowScreenshots,
    showTerminal,
    setShowTerminal,
    isVncZoomed,
    setIsVncZoomed,
    activeTab,
    setActiveTab,
  };
}

/**
 * Utility function to clear all preferences
 */
export function clearPreferences() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear preferences from localStorage:', error);
  }
}

/**
 * Utility function to reset preferences to defaults
 */
export function resetPreferences() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PREFERENCES));
  } catch (error) {
    console.warn('Failed to reset preferences in localStorage:', error);
  }
}
