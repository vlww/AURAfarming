import io
import os
import time
import random
import uuid
from datetime import datetime

import cv2
import numpy as np
from flask import Flask, render_template, request, jsonify, url_for

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "static", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 12 * 1024 * 1024  # 12MB uploads


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
    h, w = image_bgr.shape[:2]
    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)

    # green foliage mask
    green_mask = cv2.inRange(hsv, (25, 30, 30), (95, 255, 255))
    leaf_area = cv2.countNonZero(green_mask)

    # non-green "foreign object" mask, restricted to a dilated leaf region
    # so we mostly look at objects sitting on/near foliage rather than background
    leaf_region = cv2.dilate(green_mask, np.ones((25, 25), np.uint8))
    non_green = cv2.bitwise_not(green_mask)
    candidate_mask = cv2.bitwise_and(non_green, leaf_region)

    # clean up noise
    kernel = np.ones((3, 3), np.uint8)
    candidate_mask = cv2.morphologyEx(candidate_mask, cv2.MORPH_OPEN, kernel, iterations=1)
    candidate_mask = cv2.morphologyEx(candidate_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(candidate_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    img_area = h * w
    detections = []
    annotated = image_bgr.copy()

    for c in contours:
        area = cv2.contourArea(c)
        if area < img_area * 0.00006 or area > img_area * 0.02:
            continue  # too small to be real, or too big to be an insect
        x, y, bw, bh = cv2.boundingRect(c)
        aspect = bw / float(bh) if bh else 1
        perimeter = cv2.arcLength(c, True)
        circularity = 4 * np.pi * area / (perimeter ** 2) if perimeter else 0
        rel_size = area / img_area

        species, color = classify_pest(rel_size, aspect, circularity)
        confidence = round(min(97, 65 + circularity * 25 + random.uniform(0, 6)), 1)

        detections.append({
            "species": species, "x": x, "y": y, "w": bw, "h": bh, "confidence": confidence,
        })
        cv2.rectangle(annotated, (x, y), (x + bw, y + bh), color, 2)
        label = f"{species} {confidence:.0f}%"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(annotated, (x, y - th - 8), (x + tw + 6, y), color, -1)
        cv2.putText(annotated, label, (x + 3, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (15, 15, 15), 1, cv2.LINE_AA)

    species_counts = {}
    for d in detections:
        species_counts[d["species"]] = species_counts.get(d["species"], 0) + 1

    total = len(detections)
    risk = "Low" if total <= 1 else "Moderate" if total <= 4 else "High"
    leaf_pct = round(100 * leaf_area / img_area, 1)

    return {
        "detections": detections,
        "species_counts": species_counts,
        "total": total,
        "risk": risk,
        "leaf_coverage_pct": leaf_pct,
    }, annotated


def classify_pest(rel_size, aspect, circularity):
    """Heuristic species classification from blob geometry."""
    if rel_size < 0.0006 and circularity > 0.55:
        return "Aphid", (86, 214, 126)       # small, round -> aphid cluster member
    if aspect > 2.1 or aspect < 0.48:
        return "Locust", (92, 173, 226)       # elongated body -> locust/grasshopper
    if circularity < 0.4:
        return "Caterpillar", (234, 179, 89)  # irregular elongated blob -> caterpillar
    return "Beetle", (110, 130, 240)          # compact, medium round -> beetle


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
    app.run(debug=True, port=5000)
