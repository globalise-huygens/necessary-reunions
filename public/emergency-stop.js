/**
 * Emergency stop script DISABLED
 * The infinite loops appear to be a React hydration issue that needs server-side fixes
 * Let the site function normally
 */

console.log('Emergency stop script DISABLED - allowing normal site operation');

// Clear any existing emergency systems
try {
  // Clear timeouts that might have been set
  for (let i = 1; i < 1000; i++) {
    clearTimeout(i);
    clearInterval(i);
  }

  console.log('Cleared emergency timeouts - site should function normally now');
} catch (e) {
  // Ignore errors
}

console.log('Emergency systems DISABLED - React can operate normally');
