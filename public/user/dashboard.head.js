(function () {
      const originalWarn = console.warn;
      console.warn = (...args) => {
        const first = args[0];
        if (typeof first === 'string' && first.includes('cdn.tailwindcss.com should not be used in production')) {
          return;
        }
        originalWarn(...args);
      };
      window.addEventListener('DOMContentLoaded', () => {
        console.warn = originalWarn;
      });
    })();
