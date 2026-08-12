import io
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas
from reportlab.pdfbase.pdfmetrics import stringWidth

PAGE_W, PAGE_H = letter

INK = HexColor("#2B3A27")
INK_SOFT = HexColor("#5C6E56")
INK_FAINT = HexColor("#8A9C83")

GREEN_900 = HexColor("#2F4A2C")
GREEN_700 = HexColor("#497A44")
GREEN_500 = HexColor("#7FB073")
GREEN_150 = HexColor("#DCEFD3")
BG_ALT = HexColor("#F4FAF0")

EARTH_600 = HexColor("#B87A3D")
EARTH_100 = HexColor("#F6E9D6")

AMBER_TEXT = HexColor("#96660E")
AMBER_BG = HexColor("#FBEDCB")

GOOD_TEXT = HexColor("#3E7A3C")
GOOD_BG = HexColor("#E1F1DD")
RUST_TEXT = HexColor("#A6472A")
RUST_BG = HexColor("#F7DED4")

WHITE = HexColor("#FFFFFF")

MARGIN = 40
CARD_RADIUS = 10


def _wrapped_lines(c, text, font, size, max_width):
    return simpleSplit(text, font, size, max_width)


def _draw_header(c, generated_at):
    # deep green banner
    banner_h = 64
    c.setFillColor(GREEN_900)
    c.rect(0, PAGE_H - banner_h, PAGE_W, banner_h, stroke=0, fill=1)

    # simple leaf mark
    lx, ly = MARGIN, PAGE_H - banner_h / 2
    c.setFillColor(GREEN_500)
    c.circle(lx + 10, ly, 12, stroke=0, fill=1)
    c.setFillColor(GREEN_900)
    c.setLineWidth(1.2)
    c.setStrokeColor(GREEN_900)
    c.line(lx + 10, ly - 7, lx + 10, ly + 7)

    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 17)
    c.drawString(MARGIN + 32, PAGE_H - banner_h / 2 - 2, "AURAfarming")
    c.setFont("Helvetica", 9.5)
    c.setFillColor(GREEN_150)
    c.drawString(MARGIN + 32, PAGE_H - banner_h / 2 - 15, "Field Health Report")

    c.setFont("Helvetica", 9)
    c.setFillColor(GREEN_150)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - banner_h / 2 - 2, "Generated")
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(WHITE)
    c.drawRightString(PAGE_W - MARGIN, PAGE_H - banner_h / 2 - 15, generated_at)

    # leaf-vein style divider dots under the banner
    y = PAGE_H - banner_h - 14
    colors = [GREEN_500, GREEN_150, EARTH_600]
    x = MARGIN
    step = (PAGE_W - 2 * MARGIN) / 26
    for i in range(27):
        c.setFillColor(colors[i % 3])
        c.circle(x, y, 1.4, stroke=0, fill=1)
        x += step


def _status_box(c, x, y, w, h, is_concern, message, has_data=True):
    """Red box for a flagged concern, green box for all-clear / no data."""
    if is_concern:
        bg, fg, icon = RUST_BG, RUST_TEXT, "!"
    else:
        bg, fg, icon = GOOD_BG, GOOD_TEXT, "OK"

    c.setFillColor(bg)
    c.roundRect(x, y, w, h, 6, stroke=0, fill=1)

    badge_r = 9
    bx, by = x + 16, y + h / 2
    c.setFillColor(fg)
    c.circle(bx, by, badge_r, stroke=0, fill=1)
    c.setFillColor(WHITE)
    c.setFont("Helvetica-Bold", 8.5 if icon == "OK" else 11)
    c.drawCentredString(bx, by - 3, icon)

    text_x = bx + badge_r + 12
    max_w = x + w - 14 - text_x
    c.setFillColor(fg)
    c.setFont("Helvetica-Bold", 9.5)
    lines = _wrapped_lines(c, message, "Helvetica-Bold", 9.5, max_w)
    n = len(lines)
    line_h = 12
    start_y = by + (n - 1) * line_h / 2
    for i, line in enumerate(lines[:3]):
        c.drawString(text_x, start_y - i * line_h - 3, line)


def _draw_icon(c, cx, cy, r, icon_type, color):
    c.setFillColor(color)
    c.setStrokeColor(color)
    if icon_type == "pest":
        c.setLineWidth(1.3)
        c.ellipse(cx - r * 0.42, cy - r * 0.6, cx + r * 0.42, cy + r * 0.6, stroke=0, fill=1)
        for dx, dy in [(-1, 0.5), (1, 0.5), (-1, -0.5), (1, -0.5)]:
            c.line(cx + dx * r * 0.35, cy + dy * r * 0.5, cx + dx * r * 0.9, cy + dy * r * 0.85)
    elif icon_type == "disease":
        p = c.beginPath()
        p.moveTo(cx - r * 0.7, cy - r * 0.6)
        p.curveTo(cx - r * 0.7, cy + r * 0.7, cx + r * 0.7, cy + r * 0.7, cx + r * 0.7, cy - r * 0.2)
        p.curveTo(cx + r * 0.2, cy - r * 0.2, cx - r * 0.1, cy - r * 0.5, cx - r * 0.7, cy - r * 0.6)
        p.close()
        c.drawPath(p, stroke=0, fill=1)
    else:  # soil / droplet
        p = c.beginPath()
        p.moveTo(cx, cy + r * 0.75)
        p.curveTo(cx - r * 0.65, cy + r * 0.05, cx - r * 0.65, cy - r * 0.55, cx, cy - r * 0.75)
        p.curveTo(cx + r * 0.65, cy - r * 0.55, cx + r * 0.65, cy + r * 0.05, cx, cy + r * 0.75)
        p.close()
        c.drawPath(p, stroke=0, fill=1)


def _section_card(c, x, y, w, h, icon_tint, icon_fg, icon_type, title, stat_rows, concern, concern_msg):
    # card background
    c.setFillColor(WHITE)
    c.setStrokeColor(HexColor("#E4EEE0"))
    c.setLineWidth(1)
    c.roundRect(x, y, w, h, CARD_RADIUS, stroke=1, fill=1)

    pad = 16
    icon_d = 30
    icon_box_x = x + pad
    icon_box_y = y + h - pad - icon_d
    c.setFillColor(icon_tint)
    c.roundRect(icon_box_x, icon_box_y, icon_d, icon_d, 7, stroke=0, fill=1)
    _draw_icon(c, icon_box_x + icon_d / 2, icon_box_y + icon_d / 2, icon_d / 2 - 4, icon_type, icon_fg)

    c.setFillColor(GREEN_900)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(x + pad + icon_d + 10, y + h - pad - icon_d / 2 - 4, title)

    row_y = y + h - pad - icon_d - 20
    row_h = 16
    col_w = (w - 2 * pad) / 2
    for i, (label, value) in enumerate(stat_rows):
        col = i % 2
        row = i // 2
        rx = x + pad + col * col_w
        ry = row_y - row * row_h
        c.setFont("Helvetica", 8.7)
        c.setFillColor(INK_SOFT)
        c.drawString(rx, ry, label)
        c.setFont("Helvetica-Bold", 8.7)
        c.setFillColor(GREEN_900)
        c.drawRightString(rx + col_w - 10, ry, str(value))

    # status box pinned to bottom of card
    box_h = 34
    box_y = y + pad - 4
    _status_box(c, x + pad, box_y, w - 2 * pad, box_h, concern, concern_msg)


def _pest_section_data(pest):
    if not pest:
        return (
            [("Status", "No scan yet"), ("Detections", "--"), ("Leaf coverage", "--"), ("Last scan", "--")],
            False,
            "No pest data yet. Run a pest scan to check this field.",
        )
    rows = [
        ("Risk level", pest.get("risk", "--")),
        ("Pests detected", pest.get("total", 0)),
        ("Leaf coverage", f"{pest.get('leaf_coverage_pct', '--')}%"),
        ("Last scan", pest.get("time", "--")),
    ]
    species = pest.get("species_counts") or {}
    if species:
        top_species = ", ".join(f"{name} ({n})" for name, n in list(species.items())[:4])
    else:
        top_species = "None identified"
    risk = pest.get("risk", "Low")
    is_concern = risk in ("Moderate", "High")
    if is_concern:
        msg = f"{risk} pest risk, {pest.get('total', 0)} detected: {top_species}."
    else:
        msg = "No significant pest concern from the latest scan."
    return rows, is_concern, msg


def _disease_section_data(disease):
    if not disease:
        return (
            [("Status", "No scan yet"), ("Diagnosis", "--"), ("Affected area", "--"), ("Last scan", "--")],
            False,
            "No disease data yet. Run a disease scan to check this field.",
        )
    rows = [
        ("Diagnosis", disease.get("diagnosis", "--")),
        ("Crop", disease.get("crop") or "--"),
        ("Severity", disease.get("severity", "--")),
        ("Affected area", f"{disease.get('affected_pct', '--')}%"),
        ("Confidence", f"{disease.get('confidence', '--')}%"),
        ("Last scan", disease.get("time", "--")),
    ]
    severity = disease.get("severity", "None")
    is_concern = severity not in ("None", None)
    if is_concern:
        msg = f"{disease.get('diagnosis', 'Disease detected')}, {severity.lower()} severity, {disease.get('affected_pct', 0)}% of leaf affected."
    else:
        msg = "No disease detected in the latest scan. Plant appears healthy."
    return rows, is_concern, msg


def _soil_section_data(soil, soil_score):
    if not soil or soil_score is None:
        return (
            [("Status", "No sensor data"), ("Moisture", "--"), ("pH level", "--"), ("Last reading", "--")],
            False,
            "No soil sensor data yet.",
        )
    rows = [
        ("Soil score", f"{soil_score} / 100"),
        ("Moisture", f"{soil.get('moisture', '--')}%"),
        ("Salinity (EC)", f"{soil.get('salinity', '--')} dS/m"),
        ("pH level", soil.get("ph", "--")),
        ("Nitrogen", f"{soil.get('nitrogen', '--')} ppm"),
        ("Last reading", soil.get("label", "--")),
    ]
    is_concern = soil_score < 60
    if is_concern:
        issues = []
        if soil.get("moisture") is not None and not (30 <= soil["moisture"] <= 75):
            issues.append("moisture out of range")
        if soil.get("ph") is not None and not (6.0 <= soil["ph"] <= 7.2):
            issues.append("pH out of range")
        if soil.get("salinity") is not None and soil["salinity"] > 1.6:
            issues.append("salinity elevated")
        detail = "; ".join(issues) if issues else "readings trending outside healthy range"
        msg = f"Soil score {soil_score}/100, {detail}."
    else:
        msg = f"Soil score {soil_score}/100, readings within a healthy range."
    return rows, is_concern, msg


def build_report_pdf(pest, disease, soil, soil_score):
    """Returns PDF bytes for the one-page field health report."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)

    generated_at = datetime.now().strftime("%b %d, %Y at %I:%M %p")
    _draw_header(c, generated_at)

    content_top = PAGE_H - 64 - 34
    card_gap = 16
    card_w = PAGE_W - 2 * MARGIN
    card_h = (content_top - MARGIN - 2 * card_gap) / 3

    sections = [
        ("Pest activity", GREEN_150, GREEN_700, "pest", _pest_section_data(pest)),
        ("Plant disease", EARTH_100, EARTH_600, "disease", _disease_section_data(disease)),
        ("Soil health", AMBER_BG, AMBER_TEXT, "soil", _soil_section_data(soil, soil_score)),
    ]

    y = content_top - card_h
    for title, tint, fg, icon_type, (rows, concern, msg) in sections:
        _section_card(c, MARGIN, y, card_w, card_h, tint, fg, icon_type, title, rows, concern, msg)
        y -= card_h + card_gap

    # footer
    c.setFont("Helvetica", 7.5)
    c.setFillColor(INK_FAINT)
    c.drawCentredString(
        PAGE_W / 2, MARGIN / 2,
        "Generated by AURAfarming. For field reference only, not a substitute for professional agronomic advice.",
    )

    c.showPage()
    c.save()
    buf.seek(0)
    return buf.read()
