// Page-owned interactions used to verify that Quiet Browse never clicks controls for the user.
(() => {
  let clicks = 0;
  for (const id of ['accept', 'reject'])
    document.getElementById(id)?.addEventListener('click', () => {
      document.getElementById('clicks').textContent = `Consent actions clicked: ${++clicks}`;
    });
  const start = document.getElementById('start-video');
  start?.addEventListener('click', async () => {
    const video = document.getElementById('background');
    if (!video.srcObject) {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const context = canvas.getContext('2d');
      context.fillStyle = '#284e3b';
      context.fillRect(0, 0, 320, 180);
      context.fillStyle = '#e5efcd';
      context.font = '20px system-ui';
      context.fillText('Local sample video', 62, 92);
      video.srcObject = canvas.captureStream(1);
    }
    video.muted = true;
    try {
      await video.play();
    } catch {
      /* Quiet Browse may intentionally pause this autoplay sample. */
    }
  });
})();
