# AURAfarming

A simple smart-farming dashboard with three pages, all connected by one
unified dashboard. Runs locally from the terminal with Python + Flask.

- **Dashboard** — unified overview pulling together the latest pest scan,
  disease scan, and soil readings.
- **Pest Detection** — upload a real crop photo. Uses OpenCV (color
  segmentation + contour/blob analysis) to actually find insect-like shapes
  in your image and classify them as Aphid / Locust / Caterpillar / Beetle
  based on their size and shape, with bounding boxes drawn on your real photo.
- **Disease Detection** — upload a real leaf photo. Uses OpenCV HSV color
  segmentation to separate healthy green tissue from diseased brown/yellow/
  necrotic tissue, draws a real overlay on the affected regions, and reports
  percent affected + a diagnosis.
- **Soil Monitor** — live-updating charts (moisture, salinity, pH, nitrogen,
  temperature) from a simulated sensor feed, with a composite soil health
  score.

The two CV pages run genuine image-processing on the pixels of whatever
photo you upload — no deep learning model is involved (that would need a
large trained model and GPU), so classification is heuristic (based on
blob size/shape for pests, and color ratios for disease). The code is
structured so `detect_pests()` and `detect_disease()` in `app.py` are the
only two functions you'd need to replace with real trained models later.

## Setup

```bash
# from the aurafarming/ folder
python3 -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate

pip install -r requirements.txt
```

## Run

```bash
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.

## Project structure

```
aurafarming/
├── app.py                  Flask app + OpenCV analysis + soil simulation
├── requirements.txt
├── templates/
│   ├── base.html           shared layout / sidebar nav
│   ├── dashboard.html      unified overview page
│   ├── pests.html          pest detection upload + results
│   ├── disease.html        disease detection upload + results
│   └── soil.html           live soil charts
└── static/
    ├── css/style.css
    ├── js/main.js           upload handling + Chart.js wiring
    └── uploads/             uploaded photos + annotated results are saved here
```

## Notes

- Uploaded/annotated images are saved to `static/uploads/`. Feel free to
  clear that folder out between demos.
- The soil feed is simulated with a random walk (no real sensor hardware
  required) so the dashboard looks populated and live immediately. Swap
  `_next_soil_reading()` in `app.py` for a real sensor read to go from
  demo to production.
