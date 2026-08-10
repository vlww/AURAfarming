import threading

MODEL_ID = "linkanjarad/mobilenet_v2_1.0_224-plant-disease-identification"

_processor = None
_model = None
_model_lock = threading.Lock()


def get_disease_model():
    """Lazily load the processor + model (thread-safe, loads once)."""
    global _processor, _model
    if _model is not None:
        return _processor, _model
    with _model_lock:
        if _model is not None:  # re-check inside the lock
            return _processor, _model
        from transformers import MobileNetV2ImageProcessor, MobileNetV2ForImageClassification

        _processor = MobileNetV2ImageProcessor.from_pretrained(MODEL_ID)
        _model = MobileNetV2ForImageClassification.from_pretrained(MODEL_ID)
        _model.eval()
    return _processor, _model


def predict(pil_image, top_k=3):
    import torch

    processor, model = get_disease_model()
    inputs = processor(images=pil_image, return_tensors="pt")
    with torch.no_grad():
        logits = model(**inputs).logits[0]
    probs = torch.softmax(logits, dim=-1)

    k = min(top_k, probs.shape[-1])
    top_probs, top_idxs = torch.topk(probs, k=k)

    id2label = model.config.id2label
    results = []
    for score, idx in zip(top_probs.tolist(), top_idxs.tolist()):
        # id2label keys are ints after HF loads the config, but fall back
        # to string lookup just in case, so a lookup miss can't silently
        # turn into a fake "LABEL_N" placeholder again.
        label = id2label.get(idx, id2label.get(str(idx)))
        if label is None:
            label = f"LABEL_{idx}"
        results.append({"label": label, "score": score})
    return results


# Tried in order, most-specific first. Covers the canonical PlantVillage
# "Crop___Condition" format as well as looser variants, so a formatting
# change in the raw label can never make this fall back to "Unknown" --
# worst case it just doesn't manage to split off a crop name.
_LABEL_SEPARATORS = ["___", "__", " - ", "-"]


def parse_disease_label(raw_label):
    """Split a raw model label into (crop, condition, is_healthy).

    Labels are expected to look like 'Tomato___Late_blight' or
    'Apple___healthy', but this doesn't hard-require that exact separator:
    it tries a few common variants and, if none match, just treats the
    whole label as the condition rather than reporting "Unknown".
    """
    raw_label = (raw_label or "").strip()
    crop, condition = "", raw_label

    for sep in _LABEL_SEPARATORS:
        if sep in raw_label:
            crop_part, _, condition_part = raw_label.partition(sep)
            if crop_part.strip() and condition_part.strip():
                crop, condition = crop_part, condition_part
                break

    crop = crop.replace("_", " ").strip()
    condition = condition.replace("_", " ").strip()
    is_healthy = condition.lower() == "healthy"
    return crop, condition, is_healthy


def warm_up():
    """Optional: call at app startup so the first web request isn't slow."""
    try:
        get_disease_model()
        return True
    except Exception as exc:  # pragma: no cover - startup diagnostics only
        print(f"[disease_model] Could not load pretrained model: {exc}")
        return False