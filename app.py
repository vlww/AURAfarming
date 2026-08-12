import io
import os
import time
import random
import uuid
from datetime import datetime

import cv2
import numpy as np
from flask import Flask, render_template, request, jsonify, url_for, Response

from pest_model import get_sahi_model, CONF_THRESHOLD, SLICE_SIZE, SLICE_OVERLAP, warm_up as pest_warm_up
from disease_model import predict as disease_predict, parse_disease_label, warm_up as disease_warm_up
from report import build_report_pdf

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
    moisture_score = 100 - abs(reading["moisture"] - 55) * 1.4
    salinity_score = 100 - max(0, reading["salinity"] - 1.2) * 35
    ph_score = 100 - abs(reading["ph"] - 6.5) * 22
    nitrogen_score = min(100, reading["nitrogen"] * 1.1)
    score = (moisture_score * 0.3 + salinity_score * 0.25 + ph_score * 0.25 + nitrogen_score * 0.2)
    return max(0, min(100, round(score)))


for _ in range(20):
    _next_soil_reading()


def _box_iou(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _box_ios(a, b):
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    iw, ih = max(0, ix2 - ix1), max(0, iy2 - iy1)
    inter = iw * ih
    area_a = max(0, ax2 - ax1) * max(0, ay2 - ay1)
    area_b = max(0, bx2 - bx1) * max(0, by2 - by1)
    smaller = min(area_a, area_b)
    return inter / smaller if smaller > 0 else 0.0


def _center_distance_ratio(a, b):
    """Distance between box centers, normalized by the boxes' average
    diagonal. Near 0 means the two boxes are centered on essentially the
    same point (the signature of a duplicate detection); closer to 1+
    means the boxes are offset by roughly a body-length or more, which is
    what two adjacent-but-distinct insects look like even when their edges
    overlap."""
    ax1, ay1, ax2, ay2 = a
    bx1, by1, bx2, by2 = b
    acx, acy = (ax1 + ax2) / 2, (ay1 + ay2) / 2
    bcx, bcy = (bx1 + bx2) / 2, (by1 + by2) / 2
    dist = ((acx - bcx) ** 2 + (acy - bcy) ** 2) ** 0.5
    diag_a = ((ax2 - ax1) ** 2 + (ay2 - ay1) ** 2) ** 0.5
    diag_b = ((bx2 - bx1) ** 2 + (by2 - by1) ** 2) ** 0.5
    avg_diag = (diag_a + diag_b) / 2
    return dist / avg_diag if avg_diag > 0 else 0.0


def _dedupe_detections(detections, iou_thresh=0.7, ios_thresh=0.88, center_dist_thresh=0.3):
    """Class-agnostic duplicate merge, applied on top of SAHI's own
    tile-boundary merge as a safety net.

    Deliberately strict: only merges boxes that are both heavily
    overlapping AND centered on essentially the same point. That combo is
    what a duplicate detection of one bug looks like (same instance, box
    jittered a few pixels by model noise). Two distinct bugs -- even
    sitting close together -- almost never hit both conditions at once, so
    this errs toward keeping separate detections separate rather than
    merging borderline cases.
    """
    ordered = sorted(detections, key=lambda d: d["confidence"], reverse=True)
    kept = []
    kept_boxes = []
    for d in ordered:
        box = (d["x"], d["y"], d["x"] + d["w"], d["y"] + d["h"])
        is_dup = any(
            (_box_iou(box, kb) > iou_thresh or _box_ios(box, kb) > ios_thresh)
            and _center_distance_ratio(box, kb) < center_dist_thresh
            for kb in kept_boxes
        )
        if not is_dup:
            kept.append(d)
            kept_boxes.append(box)
    return kept


def detect_pests(image_bgr):
    h, w = image_bgr.shape[:2]
    img_area = h * w

    work_img = image_bgr
    scale = 1.0
    max_dim = max(h, w)
    if max_dim < 900:
        scale = 900 / max_dim
        work_img = cv2.resize(image_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_CUBIC)

    sahi_model = get_sahi_model()
    from sahi.predict import get_sliced_prediction

    sliced = get_sliced_prediction(
        work_img[:, :, ::-1], 
        sahi_model,
        slice_height=SLICE_SIZE,
        slice_width=SLICE_SIZE,
        overlap_height_ratio=SLICE_OVERLAP,
        overlap_width_ratio=SLICE_OVERLAP,
        postprocess_type="GREEDYNMM",
        postprocess_match_metric="IOS",
        postprocess_match_threshold=0.8,
        postprocess_class_agnostic=True,
        verbose=0,
    )

    all_confidences = sorted((p.score.value for p in sliced.object_prediction_list), reverse=True)
    print(f"[pest debug] raw candidate boxes: {len(all_confidences)}, "
          f"top confidences: {[round(c, 2) for c in all_confidences[:8]]}, "
          f"threshold in use: {CONF_THRESHOLD}, upscale factor: {round(scale, 2)}")

    raw_detections = []

    for pred in sliced.object_prediction_list:
        conf_val = pred.score.value
        if conf_val < CONF_THRESHOLD:
            continue
        species = pred.category.name.replace("_", " ").title()
        confidence = round(conf_val * 100, 1)

        bx1, by1, bx2, by2 = pred.bbox.minx, pred.bbox.miny, pred.bbox.maxx, pred.bbox.maxy
        x1, y1, x2, y2 = (int(v / scale) for v in (bx1, by1, bx2, by2))
        x1, y1 = max(0, x1), max(0, y1)
        bw, bh = x2 - x1, y2 - y1

        raw_detections.append({
            "species": species, "x": x1, "y": y1, "w": bw, "h": bh, "confidence": confidence,
        })

    detections = _dedupe_detections(raw_detections)
    if len(raw_detections) != len(detections):
        print(f"[pest debug] deduped {len(raw_detections)} raw boxes down to {len(detections)}")
    # Full raw-box dump -- if two boxes here have near-zero overlap and still
    # end up merged, the merge isn't happening in _dedupe_detections (it
    # mathematically can't on non-overlapping boxes); look at whether SAHI
    # only ever returned one raw box for the region instead of two.
    for i, d in enumerate(raw_detections):
        print(f"[pest debug]   raw[{i}] {d['species']} conf={d['confidence']} "
              f"box=({d['x']},{d['y']},{d['x']+d['w']},{d['y']+d['h']})")

    annotated = image_bgr.copy()
    for d in detections:
        x1, y1, x2, y2 = d["x"], d["y"], d["x"] + d["w"], d["y"] + d["h"]
        species, confidence = d["species"], d["confidence"]
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


def _foreground_mask(image_bgr):
    h, w = image_bgr.shape[:2]
    mask = np.zeros((h, w), np.uint8)
    bgd_model = np.zeros((1, 65), np.float64)
    fgd_model = np.zeros((1, 65), np.float64)
    margin_x, margin_y = int(w * 0.06), int(h * 0.06)
    rect = (margin_x, margin_y, w - 2 * margin_x, h - 2 * margin_y)
    try:
        cv2.grabCut(image_bgr, mask, rect, bgd_model, fgd_model, 5, cv2.GC_INIT_WITH_RECT)
        fg = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)
    except cv2.error:
        fg = None

    if fg is None or cv2.countNonZero(fg) < 0.03 * h * w:
        fg = np.full((h, w), 255, np.uint8)
    return fg


def detect_disease(image_bgr):
    h, w = image_bgr.shape[:2]

    from PIL import Image
    rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb)

    predictions = disease_predict(pil_img, top_k=3)  # sorted list of {"label", "score"}

    top = predictions[0]
    crop, condition, is_healthy = parse_disease_label(top["label"])
    confidence = round(top["score"] * 100, 1)
    diagnosis = "Healthy" if is_healthy else condition.title()

    top_predictions = []
    for p in predictions[:3]:
        p_crop, p_condition, p_healthy = parse_disease_label(p["label"])
        label = "Healthy" if p_healthy else p_condition.title()
        top_predictions.append({"label": label, "crop": p_crop, "confidence": round(p["score"] * 100, 1)})

    print(f"[disease debug] top prediction: {top['label']} ({confidence}%)")

    fg_mask = _foreground_mask(image_bgr)

    hsv = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2HSV)
    green_mask = cv2.inRange(hsv, (30, 40, 40), (95, 255, 255))
    dark_mask = cv2.inRange(hsv, (0, 0, 0), (180, 255, 40))  # near-black, any hue/saturation

    non_green = cv2.bitwise_and(fg_mask, cv2.bitwise_not(green_mask))
    non_green = cv2.bitwise_or(non_green, dark_mask)

    kernel = np.ones((5, 5), np.uint8)
    non_green = cv2.morphologyEx(non_green, cv2.MORPH_OPEN, kernel, iterations=1)
    non_green = cv2.morphologyEx(non_green, cv2.MORPH_CLOSE, kernel, iterations=2)

    # Dark spots can fall outside fg_mask, so widen the leaf-area
    # denominator to match, or affected_pct could read over 100%.
    leaf_mask = cv2.bitwise_or(fg_mask, dark_mask)
    leaf_px = cv2.countNonZero(leaf_mask)
    disease_px = cv2.countNonZero(non_green)
    affected_pct = round(100 * disease_px / leaf_px, 1) if leaf_px > 0 else 0.0

    overlay = image_bgr.copy()
    contours = []
    if not is_healthy:
        red_layer = np.zeros_like(image_bgr)
        red_layer[:, :] = (40, 40, 235)  # BGR red-ish
        mask_bool = non_green.astype(bool)
        overlay[mask_bool] = cv2.addWeighted(image_bgr, 0.45, red_layer, 0.55, 0)[mask_bool]

        contours, _ = cv2.findContours(non_green, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        contours = [c for c in contours if cv2.contourArea(c) > (h * w) * 0.0008]
        cv2.drawContours(overlay, contours, -1, (40, 40, 235), 2)
    else:
        affected_pct = 0.0  # trust the real classifier's healthy call over the color heuristic

    if is_healthy:
        severity = "None"
    elif affected_pct < 12:
        severity = "Minor"
    elif affected_pct < 28:
        severity = "Moderate"
    else:
        severity = "Severe"

    recommendations = {
        "None": "No action needed. Continue routine monitoring.",
        "Minor": "Monitor closely and improve airflow around plants; remove any early affected leaves.",
        "Moderate": "Remove affected leaves and consider a labeled treatment for the diagnosed condition. Avoid overhead watering.",
        "Severe": "Isolate affected plants promptly and treat. Disease appears to be spreading.",
    }

    return {
        "diagnosis": diagnosis,
        "crop": crop,
        "condition": condition,
        "top_predictions": top_predictions,
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
        active_page="dashboard",
    )


@app.route("/pests")
def pests_page():
    return render_template("pests.html", result=STATE["last_pest"], active_page="pests")


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
    return render_template("disease.html", result=STATE["last_disease"], active_page="disease")


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
    return render_template("soil.html", active_page="soil")


@app.route("/api/soil/latest")
def api_soil_latest():
    reading = _next_soil_reading()
    reading["score"] = _soil_score(reading)
    return jsonify(reading)


@app.route("/api/soil/history")
def api_soil_history():
    return jsonify(STATE["soil_history"])


@app.route("/export/pdf")
def export_pdf():
    latest_soil = STATE["soil_history"][-1] if STATE["soil_history"] else None
    soil_score = _soil_score(latest_soil) if latest_soil else None
    pdf_bytes = build_report_pdf(
        pest=STATE["last_pest"],
        disease=STATE["last_disease"],
        soil=latest_soil,
        soil_score=soil_score,
    )
    filename = f"aurafarming_report_{datetime.now().strftime('%Y%m%d_%H%M')}.pdf"
    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


if __name__ == "__main__":
    print("Loading pest-detection model (downloads on first run)...")
    pest_warm_up()
    print("Loading plant-disease model (downloads on first run)...")
    disease_warm_up()
    app.run(debug=True, port=5001)