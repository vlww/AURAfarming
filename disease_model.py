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

        label = id2label.get(idx, id2label.get(str(idx)))
        if label is None:
            label = f"LABEL_{idx}"
        results.append({"label": label, "score": score})
    return results


def parse_disease_label(raw_label):

    parts = raw_label.split("___")
    crop = parts[0].replace("_", " ").strip()
    condition = parts[1].replace("_", " ").strip() if len(parts) > 1 else "Unknown"
    is_healthy = condition.lower() == "healthy"
    return crop, condition, is_healthy


def warm_up():
    try:
        get_disease_model()
        return True
    except Exception as exc:  # pragma: no cover - startup diagnostics only
        print(f"[disease_model] Could not load pretrained model: {exc}")
        return False