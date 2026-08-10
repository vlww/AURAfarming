import threading

MODEL_ID = "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification"

_pipe = None
_pipe_lock = threading.Lock()


def get_disease_pipeline():

    global _pipe
    if _pipe is not None:
        return _pipe
    with _pipe_lock:
        if _pipe is not None:  # re-check inside the lock
            return _pipe
        from transformers import MobileNetV2ImageProcessor, MobileNetV2ForImageClassification, pipeline

        processor = MobileNetV2ImageProcessor.from_pretrained(MODEL_ID)
        model = MobileNetV2ForImageClassification.from_pretrained(MODEL_ID)
        _pipe = pipeline("image-classification", model=model, image_processor=processor, top_k=5)
    return _pipe


def parse_disease_label(raw_label):
    """PlantVillage labels look like 'Tomato___Late_blight' or
    'Apple___healthy' -- split into a readable crop + condition + healthy flag."""
    parts = raw_label.split("___")
    crop = parts[0].replace("_", " ").strip()
    condition = parts[1].replace("_", " ").strip() if len(parts) > 1 else "Unknown"
    is_healthy = condition.lower() == "healthy"
    return crop, condition, is_healthy


def warm_up():
    """Optional: call at app startup so the first web request isn't slow."""
    try:
        get_disease_pipeline()
        return True
    except Exception as exc:  # pragma: no cover - startup diagnostics only
        print(f"[disease_model] Could not load pretrained model: {exc}")
        return False