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
    console.log('Could not clear blocks via API');
  }
  
  console.log('All request blocks cleared - refresh page');
}