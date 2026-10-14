let dialog;

export function openFitnessReportPreview(testLog, template = 'dark') {
  if (!dialog) {
    dialog = document.createElement('dialog');
    dialog.className = 'fp-preview-dialog';
    dialog.innerHTML = `<div class="fp-preview-head"><div><strong>Fitness report preview</strong><p>One-page A4 report for the selected test</p></div><button type="button" class="fp-preview-close" aria-label="Close preview">&times;</button></div><p class="fp-preview-loading" role="status">Preparing PDF preview...</p><iframe title="Selected fitness report PDF preview"></iframe><div class="fp-preview-actions"><a class="fp-action secondary" target="_blank" rel="noopener">Open preview in a new tab</a><a class="fp-action" download>Download PDF</a></div>`;
    document.body.append(dialog);
    dialog.querySelector('.fp-preview-close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.querySelector('iframe').addEventListener('load', () => { dialog.querySelector('.fp-preview-loading').hidden = true; });
  }
  const base = `/api/fitness-reports/${encodeURIComponent(testLog)}.pdf`;
  const params = new URLSearchParams({ template });
  const preview = `${base}?${params}&preview=1`;
  const download = `${base}?${params}`;
  dialog.querySelector('.fp-preview-loading').hidden = false;
  dialog.querySelector('iframe').src = preview;
  dialog.querySelector('.fp-preview-actions a:first-child').href = preview;
  dialog.querySelector('.fp-preview-actions a:last-child').href = download;
  dialog.showModal();
}
