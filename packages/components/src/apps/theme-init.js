/* global localStorage, window, document */
// Apply dark class immediately (before React loads) to prevent FOUC
(function() {
  const theme = localStorage.getItem('theme') || 'system';
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) {
    document.documentElement.classList.add('dark');
  }
})();
