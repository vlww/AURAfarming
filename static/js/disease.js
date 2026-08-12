(function () {
  const dropzone = document.getElementById('disease-dropzone');
  const fileInput = document.getElementById('disease-file');
  const previewWrap = document.getElementById('disease-preview-wrap');
  const preview = document.getElementById('disease-preview');
  const filenameEl = document.getElementById('disease-filename');
  const submitBtn = document.getElementById('disease-submit');
  const form = document.getElementById('disease-form');
  const loading = document.getElementById('disease-loading');
  const errorBox = document.getElementById('disease-error');
  const resultsEl = document.getElementById('disease-results');

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

  function badgeClass(severity) { return (severity || '').toLowerCase(); }

  function renderResult(r) {
    const others = (r.top_predictions || []).slice(1)
      .map((p) => `<span class="species-chip">${p.label} &middot; <b>${p.confidence}%</b></span>`)
      .join('');

    resultsEl.innerHTML = `
      <div class="result-grid" style="margin-top:26px;">
        <div class="result-image">
          <img src="${r.overlay_image}" alt="Photo with affected areas highlighted">
        </div>
        <div class="card">
          <span class="badge ${badgeClass(r.severity)}"><span class="badge-dot"></span>${r.diagnosis}</span>
          <div style="margin-top:16px;">
            <div class="big-stat">${r.severity}</div>
            <div class="big-stat-label">severity &middot; ${r.confidence}% confident</div>
          </div>
          <div class="diagnosis-highlight ${r.severity !== 'None' ? 'concern' : 'clear'}">
            <span class="diagnosis-label">Diagnosis</span>
            <span class="diagnosis-value">${r.diagnosis}</span>
          </div>
          <div class="stat-line">
            <span class="stat-label">Leaf area affected</span>
            <span class="stat-value">${r.affected_pct}%</span>
          </div>
          <div class="stat-line">
            <span class="stat-label">Scanned at</span>
            <span class="stat-value">${r.time}</span>
          </div>
          <div class="recommend-box"><span>🌱</span><span>${r.recommendation}</span></div>
          ${others ? `<div style="margin-top:16px;"><div class="stat-label" style="margin-bottom:8px;">Other possibilities</div><div class="species-list">${others}</div></div>` : ''}
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
      const res = await fetch('/api/disease/analyze', { method: 'POST', body: formData });
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