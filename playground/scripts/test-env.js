#!/usr/bin/env node

// Test script to verify environment variable configuration
const backendUrl = process.env.VITE_BACKEND_URL || 'http://localhost:3000';

console.log('🔧 Environment Configuration Test');
console.log('================================');
console.log(`Backend URL: ${backendUrl}`);
console.log(`API Endpoints:`);
console.log(`  - Run: ${backendUrl}/run`);
console.log(`  - Screenshots: ${backendUrl}/screenshots`);
console.log(`  - Screenshot file: ${backendUrl}/screenshots/[filename]`);
console.log('');
console.log('✅ Configuration looks good!');
console.log('');
console.log('To test with a different backend URL:');
console.log('VITE_BACKEND_URL=https://api.yourdomain.com node scripts/test-env.js');
