import io
import os
import time
import random
import uuid
from datetime import datetime

import cv2
import numpy as np
from flask import Flask, render_template, request, jsonify, url_for

from pest_model import get_sahi_model, CONF_THRESHOLD, SLICE_SIZE, SLICE_OVERLAP, warm_up

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024  # 12MB uploads

_PEST_BOX_COLOR = (66, 133, 244)  # BGR


STATE = {
    "last_pest": None,      # {"species_counts": {...}, "total": int, "risk": str, "time": str, "image": str}
    "last_disease": None,   # {"diagnosis": str, "affected_pct": float, "severity": str, "time": str, "image": str}
    "soil_history": [],     # list of dicts, most recent last
}


def _now():
    return datetime.now().strftime("%H:%M:%S")


_soil_baseline = {
    "moisture": 42.0,     # %
    "salinity": 1.1,      # dS/m (electrical conductivity)
    "ph": 6.5,
    "nitrogen": 60.0,     # ppm (relative index)
    "temperature": 23.0,  # C
}


def _walk(value, step, lo, hi):
    value += random.uniform(-step, step)
    return max(lo, min(hi, value))


def _next_soil_reading():
    b = _soil_baseline
    b["moisture"] = _walk(b["moisture"], 1.5, 15, 90)
    b["salinity"] = _walk(b["salinity"], 0.08, 0.1, 4.0)
    b["ph"] = _walk(b["ph"], 0.08, 4.5, 8.5)
    b["nitrogen"] = _walk(b["nitrogen"], 2.0, 10, 100)
    b["temperature"] = _walk(b["temperature"], 0.4, 8, 40)
    reading = {
        "t": time.time(),
        "label": _now(),
        "moisture": round(b["moisture"], 1),
        "salinity": round(b["salinity"], 2),
        "ph": round(b["ph"], 2),
        "nitrogen": round(b["nitrogen"], 1),
        "temperature": round(b["temperature"], 1),
    }
    STATE["soil_history"].append(reading)
    STATE["soil_history"] = STATE["soil_history"][-60:]  # keep last 60 points
    return reading


def _soil_score(reading):
    """Very simple composite health score from the current readings."""
    moisture_score = 100 - abs(reading["moisture"] - 55) * 1.4
    salinity_score = 100 - max(0, reading["salinity"] - 1.2) * 35
    ph_score = 100 - abs(reading["ph"] - 6.5) * 22
    nitrogen_score = min(100, reading["nitrogen"] * 1.1)
    score = (moisture_score * 0.3 + salinity_score * 0.25 + ph_score * 0.25 + nitrogen_score * 0.2)
    return max(0, min(100, round(score)))


# seed a bit of history so the dashboard isn't empty on first load
for _ in range(20):
    _next_soil_reading()


def detect_pests(image_bgr):
    """Real pest detection using a YOLO11 model fine-tuned on IP102 (102 pest
    species). See pest_model.py for where the weights come from."""
    h, w = image_bgr.shape[:2]
    img_area = h * w

    # Upscale small photos so tiny/clustered pests have more pixels to work
    # with -- a 400px-wide photo shrinks aphids to near-nothing once tiled.
    work_img = image_bgr
    scale = 1.0
    max_dim = max(h, w)
    if max_dim < 900:
        scale = 900 / max_dim
        work_img = cv2.resize(image_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

    sahi_model = get_sahi_model()
    from sahi.predict import get_sliced_prediction

    # Slices the image into overlapping tiles, runs the detector on each tile
    # near-full-resolution, then merges results -- this is what catches small
    # or tightly clustered pests (e.g. an aphid colony) that a single
    # full-frame pass tends to miss or blur together.
    sliced = get_sliced_prediction(
        work_img[:, :, ::-1],  # SAHI expects RGB, we have BGR from cv2
        sahi_model,
        slice_height=SLICE_SIZE,
        slice_width=SLICE_SIZE,
        overlap_height_ratio=SLICE_OVERLAP,
        overlap_width_ratio=SLICE_OVERLAP,
        verbose=0,
    )

    all_confidences = sorted((p.score.value for p in sliced.object_prediction_list), reverse=True)
    print(f"[pest debug] raw candidate boxes: {len(all_confidences)}, "
          f"top confidences: {[round(c, 2) for c in all_confidences[:8]]}, "
          f"threshold in use: {CONF_THRESHOLD}, upscale factor: {round(scale, 2)}")

    detections = []
    annotated = image_bgr.copy()

    for pred in sliced.object_prediction_list:
        conf_val = pred.score.value
        if conf_val < CONF_THRESHOLD:
            continue
        species = pred.category.name.replace("_", " ").title()
        confidence = round(conf_val * 100, 1)

        # box coords are in work_img (possibly upscaled) space -- map back
        # to the original image's coordinates before returning/drawing.
        bx1, by1, bx2, by2 = pred.bbox.minx, pred.bbox.miny, pred.bbox.maxx, pred.bbox.maxy
        x1, y1, x2, y2 = (int(v / scale) for v in (bx1, by1, bx2, by2))
        x1, y1 = max(0, x1), max(0, y1)
        bw, bh = x2 - x1, y2 - y1

        detections.append({
            "species": species, "x": x1, "y": y1, "w": bw, "h": bh, "confidence": confidence,
        })

        cv2.rectangle(annotated, (x1, y1), (x2, y2), _PEST_BOX_COLOR, 2)
        label = f"{species} {confidence:.0f}%"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        label_y = max(y1, th + 8)
        cv2.rectangle(annotated, (x1, label_y - th - 8), (x1 + tw + 6, label_y), _PEST_BOX_COLOR, -1)
        cv2.putText(annotated, label, (x1 + 3, label_y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (15, 15, 15), 1, cv2.LINE_AA)

    species_counts = {}
    for d in detections:
        species_counts[d["species"]] = species_counts.get(d["species"], 0) + 1

    total = len(detections)
    risk = "Low" if total <= 1 else "Moderate" if total <= 4 else "High"

    # Rough foliage-coverage estimate kept as supplementary context (not a
    # detection signal anymore -- the model above handles that).
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    green_mask = cv2.inRange(hsv, (25, 30, 30), (95, 255, 255))
    leaf_pct = round(100 * cv2.countNonZero(green_mask) / img_area, 1)

    return {
        "detections": detections,
        "species_counts": species_counts,
        "total": total,
        "risk": risk,
        "leaf_coverage_pct": leaf_pct,
    }, annotated


def detect_disease(image_bgr):
    h, w = image_bgr.shape[:2]
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)

    healthy_mask = cv2.inRange(hsv, (35, 40, 40), (90, 255, 255))
    # brown / yellow / necrotic tissue range
    disease_mask = cv2.inRange(hsv, (8, 40, 40), (34, 255, 230))
    dark_mask = cv2.inRange(hsv, (0, 0, 0), (180, 255, 55))  # dark necrotic spots

    leaf_mask = cv2.bitwise_or(healthy_mask, cv2.bitwise_or(disease_mask, dark_mask))
    combined_disease = cv2.bitwise_or(disease_mask, dark_mask)
    combined_disease = cv2.bitwise_and(combined_disease, leaf_mask)  # stay within the leaf

    kernel = np.ones((5, 5), np.uint8)
    combined_disease = cv2.morphologyEx(combined_disease, cv2.MORPH_OPEN, kernel, iterations=1)
    combined_disease = cv2.morphologyEx(combined_disease, cv2.MORPH_CLOSE, kernel, iterations=2)

    leaf_px = cv2.countNonZero(leaf_mask)
    disease_px = cv2.countNonZero(combined_disease)
    affected_pct = round(100 * disease_px / leaf_px, 1) if leaf_px > 0 else 0.0

    # overlay: blend red over the diseased pixels only
    overlay = image_bgr.copy()
    red_layer = np.zeros_like(image_bgr)
    red_layer[:, :] = (40, 40, 235)  # BGR red-ish
    mask_bool = combined_disease.astype(bool)
    overlay[mask_bool] = cv2.addWeighted(image_bgr, 0.45, red_layer, 0.55, 0)[mask_bool]

    # outline diseased regions
    contours, _ = cv2.findContours(combined_disease, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = [c for c in contours if cv2.contourArea(c) > (h * w) * 0.0008]
    cv2.drawContours(overlay, contours, -1, (40, 40, 235), 2)

    if affected_pct < 3:
        diagnosis, severity = "Healthy Foliage", "None"
    elif affected_pct < 12:
        diagnosis, severity = "Early Blight (suspected)", "Minor"
    elif affected_pct < 28:
        diagnosis, severity = "Leaf Spot / Early Blight", "Moderate"
    else:
        diagnosis, severity = "Advanced Blight", "Severe"

    confidence = round(min(98, 70 + affected_pct * 0.6 + random.uniform(0, 5)), 1) if affected_pct >= 3 else round(94 + random.uniform(0, 4), 1)

    recommendations = {
        "None": "No action needed. Continue routine monitoring.",
        "Minor": "Monitor closely and improve airflow around plants; remove any early affected leaves.",
        "Moderate": "Remove affected leaves and consider a labeled fungicide treatment. Avoid overhead watering.",
        "Severe": "Isolate affected plants immediately and treat promptly \u2014 disease is spreading quickly.",
    }

    return {
        "diagnosis": diagnosis,
        "severity": severity,
        "affected_pct": affected_pct,
        "healthy_pct": round(100 - affected_pct, 1),
        "confidence": confidence,
        "recommendation": recommendations[severity],
        "region_count": len(contours),
    }, overlay


def _save_upload(file_storage, prefix):
    ext = os.path.splitext(file_storage.filename)[1].lower() or ".jpg"
    if ext not in (".jpg", ".jpeg", ".png", ".bmp", ".webp"):
        ext = ".jpg"
    name = f"{prefix}_{uuid.uuid4().hex[:10]}{ext}"
    path = os.path.join(UPLOAD_DIR, name)
    file_storage.save(path)
    return path, name


def _read_cv2(path):
    data = np.fromfile(path, dtype=np.uint8)
    img = cv2.imdecode(data, cv2.IMREAD_COLOR)
    return img


def _write_cv2(img, name):
    out_path = os.path.join(UPLOAD_DIR, name)
    cv2.imwrite(out_path, img)
    return name


@app.route("/")
def dashboard():
    latest_soil = STATE["soil_history"][-1] if STATE["soil_history"] else None
    soil_score = _soil_score(latest_soil) if latest_soil else None
    return render_template(
        "dashboard.html",
        pest=STATE["last_pest"],
        disease=STATE["last_disease"],
        soil=latest_soil,
        soil_score=soil_score,
    )


@app.route("/pests")
def pests_page():
    return render_template("pests.html", result=STATE["last_pest"])


@app.route("/api/pests/analyze", methods=["POST"])
def api_pests_analyze():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
    file = request.files["image"]
    orig_path, orig_name = _save_upload(file, "pest_src")
    img = _read_cv2(orig_path)
    if img is None:
        return jsonify({"error": "Could not read image"}), 400

    result, annotated = detect_pests(img)
    annotated_name = f"pest_out_{uuid.uuid4().hex[:10]}.jpg"
    _write_cv2(annotated, annotated_name)

    result["source_image"] = url_for("static", filename=f"uploads/{orig_name}")
    result["annotated_image"] = url_for("static", filename=f"uploads/{annotated_name}")
    result["time"] = _now()

    STATE["last_pest"] = result
    return jsonify(result)


@app.route("/disease")
def disease_page():
    return render_template("disease.html", result=STATE["last_disease"])


@app.route("/api/disease/analyze", methods=["POST"])
def api_disease_analyze():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
    file = request.files["image"]
    orig_path, orig_name = _save_upload(file, "disease_src")
    img = _read_cv2(orig_path)
    if img is None:
        return jsonify({"error": "Could not read image"}), 400

    result, overlay = detect_disease(img)
    overlay_name = f"disease_out_{uuid.uuid4().hex[:10]}.jpg"
    _write_cv2(overlay, overlay_name)

    result["source_image"] = url_for("static", filename=f"uploads/{orig_name}")
    result["overlay_image"] = url_for("static", filename=f"uploads/{overlay_name}")
    result["time"] = _now()

    STATE["last_disease"] = result
    return jsonify(result)


@app.route("/soil")
def soil_page():
    return render_template("soil.html")


@app.route("/api/soil/latest")
def api_soil_latest():
    reading = _next_soil_reading()
    reading["score"] = _soil_score(reading)
    return jsonify(reading)


@app.route("/api/soil/history")
def api_soil_history():
    return jsonify(STATE["soil_history"])


if __name__ == "__main__":
    print("Loading pest-detection model (downloads on first run)...")
    warm_up()
    app.run(debug=True, port=5001)