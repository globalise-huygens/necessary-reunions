/**
 * Clear all request blocks to allow normal operation
 */

// Add this to browser console to clear blocks:
if (typeof window !== 'undefined') {
  // Clear all stored blocks
  localStorage.removeItem('requestBlocks');
  sessionStorage.removeItem('requestBlocks');

  // Reset emergency mode if accessible
  try {
    if (window.clearAllBlocks) {
      window.clearAllBlocks();
    }
  } catch (e) {
    // Could not clear blocks via API
  }

  // All request blocks cleared - refresh page required
}
