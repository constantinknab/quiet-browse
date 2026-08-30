// A test-only Chrome API double. Never included in the extension package.
(() => {
  const listeners = [];
  const policyKey = `qb-lifecycle-policy:${location.pathname}`;
  let savedPolicy = null;
  try { savedPolicy = JSON.parse(sessionStorage.getItem(policyKey)); } catch { /* A malformed fixture value is ignored. */ }
  const policy = savedPolicy?.enabled === true || savedPolicy?.enabled === false
    ? savedPolicy
    : { enabled: true, settings: { motion: true, consentChoices: true, backgroundVideo: true, youtubeQuiet: true, youtubeRecommendations: true, youtubePictureCover: false } };
  window.chrome = { runtime: { id: 'quiet-browse-test', onMessage: { addListener: callback => listeners.push(callback) }, sendMessage: async () => ({ ok: true, data: structuredClone(policy) }) } };
  window.lab = {
    policy, policyKey,
    send: message => new Promise(resolve => listeners.forEach(listener => listener(message, { id: 'quiet-browse-test' }, resolve))),
    wait: (ms = 250) => new Promise(resolve => setTimeout(resolve, ms)),
    assert: (condition, label) => {
      const li = document.createElement('li'); li.textContent = `${condition ? 'PASS' : 'FAIL'} — ${label}`;
      li.className = condition ? 'pass' : 'fail'; document.getElementById('results').append(li);
      if (!condition) throw new Error(label);
    },
  };
})();
