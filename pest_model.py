
import os
import threading

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

HF_REPO_ID = "underdogquality/yolo11s-pest-detection"
HF_FILENAME = "best.pt"


CONF_THRESHOLD = float(os.environ.get("PEST_CONF_THRESHOLD", "0.15"))
IMG_SIZE = 640


SAHI_CONF_FLOOR = 0.05


SLICE_SIZE = 512
SLICE_OVERLAP = 0.2

_model = None
_sahi_model = None
_model_lock = threading.Lock()


def _download_weights():
    from huggingface_hub import hf_hub_download

    return hf_hub_download(
        repo_id=HF_REPO_ID,
        filename=HF_FILENAME,
        local_dir=MODEL_DIR,
    )


def get_model():
    global _model
    if _model is not None:
        return _model
    with _model_lock:
        if _model is not None:  # re-check inside the lock
            return _model
        from ultralytics import YOLO

        weights_path = _download_weights()
        _model = YOLO(weights_path)
    return _model


def get_sahi_model():
    global _sahi_model
    if _sahi_model is not None:
        return _sahi_model
    with _model_lock:
        if _sahi_model is not None:
            return _sahi_model
        from sahi import AutoDetectionModel

        weights_path = _download_weights()
        _sahi_model = AutoDetectionModel.from_pretrained(
            model_type="ultralytics",
            model_path=weights_path,
            confidence_threshold=SAHI_CONF_FLOOR,
            device="cpu",  # change to "cuda:0" if you have a GPU available
        )
    return _sahi_model


def warm_up():
    try:
        get_model()
        get_sahi_model()
        return True
    except Exception as exc:  # pragma: no cover - startup diagnostics only
        print(f"[pest_model] Could not load pretrained model: {exc}")
        return False