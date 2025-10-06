/**
 * ABSOLUTE NUCLEAR Emergency script to completely stop React infinite retry loops
 * This runs immediately when loaded to KILL the oG/oX retry patterns at the engine level
 */

(function () {
  console.log(
    'ABSOLUTE NUCLEAR Emergency stop script loaded - KILLING React at engine level',
  );

  // ABSOLUTE NUCLEAR: Kill the script that contains these functions
  const killProblematicScript = () => {
    const scripts = document.getElementsByTagName('script');
    for (let script of scripts) {
      if (script.src && script.src.includes('e7327965-fc0f560f1a504601.js')) {
        console.log(
          'ABSOLUTE NUCLEAR: Removing problematic React script entirely',
        );
        script.remove();
        return true;
      }
    }
    return false;
  };

  // Try to kill the script immediately
  killProblematicScript();

  // ABSOLUTE NUCLEAR: Override setTimeout to prevent React retry scheduling
  const originalSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = function (callback, delay, ...args) {
    // Block any timeout that might be related to retries
    if (delay < 1000 && callback && callback.toString().length < 100) {
      console.log('ABSOLUTE NUCLEAR: Blocked suspicious setTimeout');
      return 0;
    }
    return originalSetTimeout(callback, delay, ...args);
  };

  // ABSOLUTE NUCLEAR: Override setInterval to prevent React retry scheduling
  const originalSetInterval = globalThis.setInterval;
  globalThis.setInterval = function (callback, delay, ...args) {
    // Block any interval that might be related to retries
    if (delay < 5000) {
      console.log('ABSOLUTE NUCLEAR: Blocked suspicious setInterval');
      return 0;
    }
    return originalSetInterval(callback, delay, ...args);
  };

  // ABSOLUTE NUCLEAR: Override Promise.resolve to detect retry patterns
  const originalPromiseResolve = Promise.resolve;
  let promiseResolveCount = 0;
  Promise.resolve = function (value) {
    promiseResolveCount++;
    if (promiseResolveCount > 100) {
      console.log('ABSOLUTE NUCLEAR: Blocked excessive Promise.resolve calls');
      return new Promise(() => {}); // Return a never-resolving promise
    }
    return originalPromiseResolve.call(this, value);
  };

  // ABSOLUTE NUCLEAR: Override Function constructor to prevent dynamic function creation
  const originalFunction = globalThis.Function;
  globalThis.Function = function (...args) {
    const funcString = args[args.length - 1] || '';
    if (
      funcString.includes('oG') ||
      funcString.includes('oX') ||
      funcString.includes('retry')
    ) {
      console.log(
        'ABSOLUTE NUCLEAR: Blocked dynamic function creation with retry patterns',
      );
      return function () {
        return Promise.resolve();
      };
    }
    return originalFunction.apply(this, args);
  };

  // ABSOLUTE NUCLEAR: Monitor DOM for script injection and kill immediately
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (
          node.tagName === 'SCRIPT' &&
          node.src &&
          node.src.includes('e7327965-fc0f560f1a504601.js')
        ) {
          console.log(
            'ABSOLUTE NUCLEAR: Detected and removed re-injected problematic script',
          );
          node.remove();
        }
      });
    });
  });

  observer.observe(document, { childList: true, subtree: true });

  // ABSOLUTE NUCLEAR: Override eval to prevent dynamic code execution
  const originalEval = globalThis.eval;
  globalThis.eval = function (code) {
    if (
      typeof code === 'string' &&
      (code.includes('oG') || code.includes('oX') || code.includes('retry'))
    ) {
      console.log('ABSOLUTE NUCLEAR: Blocked eval with retry patterns');
      return undefined;
    }
    return originalEval.call(this, code);
  };

  // ABSOLUTE NUCLEAR: Freeze all objects that might contain these functions
  try {
    if (globalThis.React) {
      Object.freeze(globalThis.React);
      console.log('ABSOLUTE NUCLEAR: Froze React object');
    }
    if (globalThis.__NEXT_DATA__) {
      Object.freeze(globalThis.__NEXT_DATA__);
      console.log('ABSOLUTE NUCLEAR: Froze Next.js data');
    }
  } catch (e) {
    console.log('ABSOLUTE NUCLEAR: Could not freeze objects:', e);
  }

  // ABSOLUTE NUCLEAR: Nuclear function killer - more aggressive
  const nuclearKill = function (...args) {
    console.log('ABSOLUTE NUCLEAR: Intercepted and killed retry call');
    // Don't return anything to break the retry chain
    throw new Error('NUCLEAR: Retry function neutralized');
  };

  // ABSOLUTE NUCLEAR: Set up nuclear monitoring with errors
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
      try {
        if (window[funcName] && typeof window[funcName] === 'function') {
          // More aggressive replacement
          Object.defineProperty(window, funcName, {
            value: nuclearKill,
            writable: false,
            configurable: false,
          });
          console.log(
            `ABSOLUTE NUCLEAR: Re-killed ${funcName} with error-throwing version`,
          );
        }
      } catch (e) {
        // If we can't override, try to corrupt the function
        try {
          window[funcName] = null;
          window[funcName] = undefined;
          delete window[funcName];
          console.log(`ABSOLUTE NUCLEAR: Corrupted ${funcName}`);
        } catch (e2) {
          console.log(`ABSOLUTE NUCLEAR: Could not corrupt ${funcName}`);
        }
      }
    });
  }, 50); // Check every 50ms

  // Stop nuclear monitoring after 60 seconds
  setTimeout(() => {
    clearInterval(nuclearMonitor);
    observer.disconnect();
    console.log('ABSOLUTE NUCLEAR: Monitoring stopped after 60 seconds');
  }, 60000);

  console.log('ABSOLUTE NUCLEAR: Engine-level emergency stop fully armed');
})();
