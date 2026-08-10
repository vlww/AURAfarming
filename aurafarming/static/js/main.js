// Shared front-end logic for AURAfarming pages.

function setupUploadPage({ formId, fileInputId, dropzoneId, dropTextId, statusId, resultsId, endpoint, onSuccess }) {
  const form = document.getElementById(formId);
  const fileInput = document.getElementById(fileInputId);
  const dropzone = document.getElementById(dropzoneId);
  const dropText = document.getElementById(dropTextId);
  const status = document.getElementById(statusId);
  const results = document.getElementById(resultsId);

  let selectedFile = null;

  dropzone.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) setSelected(fileInput.files[0]);
  });

  ["dragover", "dragenter"].forEach(evt =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); })
  );
  ["dragleave", "drop"].forEach(evt =>
    dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("drag-over"); })
  );
  dropzone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) setSelected(file);
  });

  function setSelected(file) {
    selectedFile = file;
    dropText.textContent = file.name;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      status.textContent = "Choose an image first.";
      return;
    }
    const btn = form.querySelector("button");
    btn.disabled = true;
    status.textContent = "Uploading and running computer-vision analysis...";

    const fd = new FormData();
    fd.append("image", selectedFile);

    try {
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed");
      results.style.display = "";
      onSuccess(data);
      status.textContent = "Analysis complete.";
    } catch (err) {
      status.textContent = "Error: " + err.message;
    } finally {
      btn.disabled = false;
    }
  });
}

/* ---------------------------- soil charts ---------------------------- */

function baseChartOptions(extra = {}) {
  return Object.assign({
    responsive: true,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: { legend: { labels: { color: "#90a196" } } },
    scales: {
      x: { ticks: { color: "#5b6c63", maxTicksLimit: 8 }, grid: { color: "#1c2620" } },
      y: { ticks: { color: "#5b6c63" }, grid: { color: "#1c2620" } },
    },
  }, extra);
}

function renderMiniSoilChart(canvasId, history) {
  const ctx = document.getElementById(canvasId);
  if (!ctx || !history.length) return;
  new Chart(ctx, {
    type: "line",
    data: {
      labels: history.map(h => h.label),
      datasets: [
        { label: "Moisture %", data: history.map(h => h.moisture), borderColor: "#6fb3e0", backgroundColor: "transparent", tension: 0.35, pointRadius: 0 },
        { label: "Soil Score", data: history.map(h => Math.round(100 - Math.abs(h.moisture - 55) * 1.4)), borderColor: "#5fd68a", backgroundColor: "transparent", tension: 0.35, pointRadius: 0 },
      ],
    },
    options: baseChartOptions(),
  });
}

function initSoilPage({ historyUrl, latestUrl }) {
  let charts = {};
  let labels = [];
  let series = { moisture: [], salinity: [], ph: [], nitrogen: [], temperature: [] };

  function buildCharts() {
    charts.moistSal = new Chart(document.getElementById("chartMoistSal"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Moisture %", data: series.moisture, borderColor: "#6fb3e0", backgroundColor: "rgba(111,179,224,0.08)", tension: 0.35, pointRadius: 0, fill: true },
          { label: "Salinity dS/m", data: series.salinity, borderColor: "#e8746a", backgroundColor: "transparent", tension: 0.35, pointRadius: 0, yAxisID: "y1" },
        ],
      },
      options: baseChartOptions({
        scales: {
          x: { ticks: { color: "#5b6c63", maxTicksLimit: 8 }, grid: { color: "#1c2620" } },
          y: { ticks: { color: "#5b6c63" }, grid: { color: "#1c2620" } },
          y1: { position: "right", ticks: { color: "#5b6c63" }, grid: { display: false } },
        },
      }),
    });

    charts.phNitro = new Chart(document.getElementById("chartPhNitro"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "pH", data: series.ph, borderColor: "#c99a62", backgroundColor: "transparent", tension: 0.35, pointRadius: 0 },
          { label: "Nitrogen ppm", data: series.nitrogen, borderColor: "#5fd68a", backgroundColor: "transparent", tension: 0.35, pointRadius: 0, yAxisID: "y1" },
        ],
      },
      options: baseChartOptions({
        scales: {
          x: { ticks: { color: "#5b6c63", maxTicksLimit: 8 }, grid: { color: "#1c2620" } },
          y: { ticks: { color: "#5b6c63" }, grid: { color: "#1c2620" } },
          y1: { position: "right", ticks: { color: "#5b6c63" }, grid: { display: false } },
        },
      }),
    });

    charts.temp = new Chart(document.getElementById("chartTemp"), {
      type: "line",
      data: {
        labels,
        datasets: [
          { label: "Temperature \u00b0C", data: series.temperature, borderColor: "#e8b25f", backgroundColor: "rgba(232,178,95,0.08)", tension: 0.35, pointRadius: 0, fill: true },
        ],
      },
      options: baseChartOptions(),
    });
  }

  function updateCards(reading) {
    document.getElementById("scoreValue").textContent = reading.score;
    document.getElementById("moistureValue").innerHTML = reading.moisture + '<span class="unit">%</span>';
    document.getElementById("salinityValue").innerHTML = reading.salinity + '<span class="unit">dS/m</span>';
    document.getElementById("phValue").textContent = reading.ph;
    document.getElementById("nitrogenValue").innerHTML = reading.nitrogen + '<span class="unit">ppm</span>';
    document.getElementById("temperatureValue").innerHTML = reading.temperature + '<span class="unit">\u00b0C</span>';
  }

  function pushReading(reading) {
    labels.push(reading.label);
    series.moisture.push(reading.moisture);
    series.salinity.push(reading.salinity);
    series.ph.push(reading.ph);
    series.nitrogen.push(reading.nitrogen);
    series.temperature.push(reading.temperature);
    const MAX = 40;
    if (labels.length > MAX) {
      labels.shift();
      Object.values(series).forEach(arr => arr.shift());
    }
    Object.values(charts).forEach(c => c.update());
  }

  fetch(historyUrl).then(r => r.json()).then(history => {
    history.forEach(h => {
      labels.push(h.label);
      series.moisture.push(h.moisture);
      series.salinity.push(h.salinity);
      series.ph.push(h.ph);
      series.nitrogen.push(h.nitrogen);
      series.temperature.push(h.temperature);
    });
    buildCharts();
    if (history.length) updateCards(Object.assign({}, history[history.length - 1], {
      score: Math.round(100 - Math.abs(history[history.length - 1].moisture - 55) * 1.4)
    }));

    setInterval(() => {
      fetch(latestUrl).then(r => r.json()).then(reading => {
        updateCards(reading);
        pushReading(reading);
      });
    }, 3000);
  });
}
