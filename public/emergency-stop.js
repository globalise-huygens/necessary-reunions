/**
 * Emergency script to stop React infinite retry loops
 * This runs immediately when loaded to stop oG/oX retry patterns
 */

(function () {
  console.log(
    'Emergency stop script loaded - searching for React retry functions',
  );

  let stopAttempts = 0;
  const maxStopAttempts = 100;

  function stopRetryLoops() {
    stopAttempts++;

    try {
      // Find and neutralize the specific oG/oX pattern
      const scripts = document.getElementsByTagName('script');
      for (let script of scripts) {
        if (script.src && script.src.includes('e7327965-fc0f560f1a504601.js')) {
          console.log(
            'Emergency: Found problematic React script, attempting to disable',
          );
          // Don't remove the script as it might break other things
          // Instead we'll override the functions
        }
      }

      // Override window functions that match the oG/oX pattern
      [
        'oG',
        'oX',
        'ob',
        'ix',
        'iS',
        'iQ',
        'iI',
        'iV',
        'iH',
        'ib',
        'ig',
        'u7',
        'u9',
      ].forEach((funcName) => {
        if (window[funcName] && typeof window[funcName] === 'function') {
          console.log(`Emergency: Neutralizing ${funcName} function`);
          const originalFunc = window[funcName];
          window[funcName] = function (...args) {
            console.log(
              `Emergency: Blocked ${funcName} call to prevent infinite loop`,
            );
            // Return a resolved promise to prevent errors
            return Promise.resolve();
          };
        }
      });

      // More aggressive: look for functions in all window properties
      for (let prop in window) {
        try {
          if (
            typeof window[prop] === 'function' &&
            prop.length === 2 &&
            prop.match(/^[a-z][A-Z]$/)
          ) {
            // Only monitor known problematic functions
            if (['oG', 'oX', 'ob'].includes(prop)) {
              console.log(
                `Emergency: Monitoring problematic function ${prop}...`,
              );
              const originalFunc = window[prop];
              let callCount = 0;
              let lastCallTime = 0;

              window[prop] = function (...args) {
                const now = Date.now();
                if (now - lastCallTime < 100) { // Called within 100ms
                  callCount++;
                } else {
                  callCount = 1; // Reset counter for spaced calls
                }
                lastCallTime = now;

                if (callCount > 5) {
                  console.log(
                    `Emergency: ${prop} called rapidly ${callCount} times, blocking`,
                  );
                  return Promise.resolve();
                }
                return originalFunc.apply(this, args);
              };
            }
          }
        } catch (e) {
          // Ignore errors
        }
      }

      // Stop if we've tried enough times
      if (stopAttempts < maxStopAttempts) {
        setTimeout(stopRetryLoops, 100);
      }
    } catch (error) {
      console.log('Emergency stop error:', error);
      if (stopAttempts < maxStopAttempts) {
        setTimeout(stopRetryLoops, 100);
      }
    }
  }

  // Start immediately and keep trying
  stopRetryLoops();

  // Also try when DOM is ready
  document.addEventListener('DOMContentLoaded', stopRetryLoops);

  // And try periodically
  const interval = setInterval(() => {
    if (stopAttempts >= maxStopAttempts) {
      clearInterval(interval);
      return;
    }
    stopRetryLoops();
  }, 1000);
})();
