// Backend configuration
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

// API endpoints
export const API_ENDPOINTS = {
  RUN: `${BACKEND_URL}/run`,
  SCREENSHOTS: `${BACKEND_URL}/screenshots`,
  SCREENSHOT_FILE: (filename) => `${BACKEND_URL}/${filename}`,
};
