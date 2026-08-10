(function () {
  const gaugeArc = document.getElementById('gauge-arc');
  const gaugeNumber = document.getElementById('gauge-number');
  const CIRCUMFERENCE = 2 * Math.PI * 76; // ~477.5

  const els = {
    moisture: document.getElementById('r-moisture'),
    salinity: document.getElementById('r-salinity'),
    ph: document.getElementById('r-ph'),
    nitrogen: document.getElementById('r-nitrogen'),
    temperature: document.getElementById('r-temperature'),
    time: document.getElementById('r-time'),
  };

  function scoreColor(score) {
    if (score >= 75) return '#5C9A5A';
    if (score >= 50) return '#E0A83E';
    return '#CE6B48';
  }

  function updateGauge(score) {
    const offset = CIRCUMFERENCE * (1 - Math.max(0, Math.min(100, score)) / 100);
    gaugeArc.style.stroke = scoreColor(score);
    gaugeArc.setAttribute('stroke-dashoffset', offset.toFixed(1));
    gaugeNumber.textContent = score;
  }

  function updateTiles(reading) {
    els.moisture.textContent = reading.moisture + '%';
    els.salinity.textContent = reading.salinity + ' dS/m';
    els.ph.textContent = reading.ph;
    els.nitrogen.textContent = reading.nitrogen + ' ppm';
    els.temperature.textContent = reading.temperature + '°C';
    els.time.textContent = reading.label;
  }

  let chart;
  function initChart(history) {
    const ctx = document.getElementById('soilChart').getContext('2d');
    chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: history.map((h) => h.label),
        datasets: [
          {
            label: 'Moisture (%)',
            data: history.map((h) => h.moisture),
            borderColor: '#497A44',
            backgroundColor: 'rgba(127, 176, 115, 0.15)',
            tension: 0.35,
            fill: true,
            pointRadius: 0,
          },
          {
            label: 'Temperature (°C)',
            data: history.map((h) => h.temperature),
            borderColor: '#C68A4E',
            backgroundColor: 'rgba(198, 138, 78, 0.08)',
            tension: 0.35,
            fill: true,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { position: 'bottom', labels: { font: { family: 'Mulish' }, color: '#5C6E56' } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#8A9C83', maxTicksLimit: 8 } },
          y: { grid: { color: '#EAF3E4' }, ticks: { color: '#8A9C83' } },
        },
      },
    });
  }

  function pushToChart(reading) {
    if (!chart) return;
    chart.data.labels.push(reading.label);
    chart.data.datasets[0].data.push(reading.moisture);
    chart.data.datasets[1].data.push(reading.temperature);
    if (chart.data.labels.length > 60) {
      chart.data.labels.shift();
      chart.data.datasets.forEach((d) => d.data.shift());
    }
    chart.update('none');
  }

  async function pollLatest() {
    try {
      const res = await fetch('/api/soil/latest');
      const reading = await res.json();
      updateGauge(reading.score);
      updateTiles(reading);
      pushToChart(reading);
    } catch (err) {
      // silently skip a missed tick; next poll will retry
    }
  }

  async function boot() {
    try {
      const res = await fetch('/api/soil/history');
      const history = await res.json();
      initChart(history);
      if (history.length) {
        const last = history[history.length - 1];
        updateTiles(last);
      }
    } catch (err) {
      initChart([]);
    }
    pollLatest();
    setInterval(pollLatest, 4000);
  }

  boot();
})();
