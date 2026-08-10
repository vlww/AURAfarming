(function () {
  const dropzone = document.getElementById('pest-dropzone');
  const fileInput = document.getElementById('pest-file');
  const previewWrap = document.getElementById('pest-preview-wrap');
  const preview = document.getElementById('pest-preview');
  const filenameEl = document.getElementById('pest-filename');
  const submitBtn = document.getElementById('pest-submit');
  const form = document.getElementById('pest-form');
  const loading = document.getElementById('pest-loading');
  const errorBox = document.getElementById('pest-error');
  const resultsEl = document.getElementById('pest-results');

  function showPreview(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src = e.target.result;
      previewWrap.classList.add('show');
    };
    reader.readAsDataURL(file);
    filenameEl.textContent = file.name;
    submitBtn.disabled = false;
  }

  fileInput.addEventListener('change', () => showPreview(fileInput.files[0]));

  ['dragover', 'dragenter'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    })
  );
  ['dragleave', 'drop'].forEach((evt) =>
    dropzone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
    })
  );
  dropzone.addEventListener('drop', (e) => {
    const file = e.dataTransfer.files[0];
    if (file) {
      fileInput.files = e.dataTransfer.files;
      showPreview(file);
    }
  });

  function badgeClass(risk) { return (risk || '').toLowerCase(); }

  function renderResult(r) {
    const chips = Object.entries(r.species_counts || {})
      .map(([name, count]) => `<span class="species-chip"><b>${count}</b>&nbsp; ${name}</span>`)
      .join('');

    const message = r.risk === 'Low'
      ? 'Low pest activity — keep an eye on things during your regular walk-through.'
      : r.risk === 'Moderate'
      ? 'Some pest activity found. Check nearby plants and consider targeted treatment.'
      : 'High pest activity detected. Inspect the area closely and treat promptly to protect your crop.';

    resultsEl.innerHTML = `
      <div class="result-grid" style="margin-top:26px;">
        <div class="result-image">
          <img src="${r.annotated_image}" alt="Photo with detected pests marked">
        </div>
        <div class="card">
          <span class="badge ${badgeClass(r.risk)}"><span class="badge-dot"></span>${r.risk} risk</span>
          <div style="margin-top:16px;">
            <div class="big-stat">${r.total}</div>
            <div class="big-stat-label">pest${r.total !== 1 ? 's' : ''} detected</div>
          </div>
          ${chips ? `<div class="species-list">${chips}</div>` : ''}
          <div class="stat-line" style="margin-top:14px;">
            <span class="stat-label">Leaf coverage in photo</span>
            <span class="stat-value">${r.leaf_coverage_pct}%</span>
          </div>
          <div class="stat-line">
            <span class="stat-label">Scanned at</span>
            <span class="stat-value">${r.time}</span>
          </div>
          <div class="recommend-box"><span>🌿</span><span>${message}</span></div>
        </div>
      </div>
    `;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!fileInput.files[0]) return;
    errorBox.style.display = 'none';
    loading.style.display = 'flex';
    submitBtn.disabled = true;

    const formData = new FormData();
    formData.append('image', fileInput.files[0]);

    try {
      const res = await fetch('/api/pests/analyze', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong.');
      renderResult(data);
    } catch (err) {
      errorBox.textContent = err.message || 'Could not analyze the photo. Please try again.';
      errorBox.style.display = 'block';
    } finally {
      loading.style.display = 'none';
      submitBtn.disabled = false;
    }
  });
})();
