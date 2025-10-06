/**
 * NUCLEAR Emergency script to completely stop React infinite retry loops
 * This runs immediately when loaded to KILL the oG/oX retry patterns
 */

(function () {
  console.log(
    'NUCLEAR Emergency stop script loaded - KILLING React retry functions',
  );

  // NUCLEAR APPROACH: Override the functions BEFORE they're even defined
  const killFunction = function (...args) {
    console.log('NUCLEAR: Killed retry function call');
    return Promise.resolve();
  };

  // IMMEDIATE override - set these functions to no-ops right away
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
    window[funcName] = killFunction;
    console.log(`NUCLEAR: Pre-emptively killed ${funcName}`);
  });

  // NUCLEAR OPTION: Use Object.defineProperty to make them immutable
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
    try {
      Object.defineProperty(window, funcName, {
        value: killFunction,
        writable: false,
        configurable: false,
      });
      console.log(`NUCLEAR: Made ${funcName} immutable and dead`);
    } catch (e) {
      // If property already exists, try to override anyway
      try {
        window[funcName] = killFunction;
        console.log(`NUCLEAR: Force-killed ${funcName}`);
      } catch (e2) {
        console.log(`NUCLEAR: Failed to kill ${funcName}:`, e2);
      }
    }
  });

  // NUCLEAR WATCH: Set up a continuous monitor that kills any attempt to restore these functions
  let killCount = 0;
  const nuclearMonitor = setInterval(() => {
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
      if (
        window[funcName] &&
        window[funcName] !== killFunction &&
        typeof window[funcName] === 'function'
      ) {
        console.log(`NUCLEAR: Detected resurrection of ${funcName}, re-killing`);
        window[funcName] = killFunction;
        killCount++;
      }
    });

    // Stop monitoring after 30 seconds or 100 kills
    if (killCount > 100 || Date.now() - startTime > 30000) {
      clearInterval(nuclearMonitor);
      console.log(
        `NUCLEAR: Monitor stopped after ${killCount} kills in ${Date.now() - startTime}ms`,
      );
    }
  }, 10); // Check every 10ms

  const startTime = Date.now();

  // NUCLEAR OPTION 2: Override any property setter that tries to set these functions
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
    try {
      let backingValue = killFunction;
      Object.defineProperty(window, funcName, {
        get: function () {
          return killFunction; // Always return our kill function
        },
        set: function (value) {
          console.log(`NUCLEAR: Prevented attempt to restore ${funcName}`);
          // Don't actually set the value - keep our kill function
        },
        configurable: false,
      });
      console.log(`NUCLEAR: Set up property trap for ${funcName}`);
    } catch (e) {
      console.log(`NUCLEAR: Could not trap ${funcName}:`, e);
    }
  });

  console.log('NUCLEAR: Emergency stop fully armed and monitoring');
})();
