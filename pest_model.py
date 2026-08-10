import os
import threading
 
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
os.makedirs(MODEL_DIR, exist_ok=True)
 
HF_REPO_ID = "underdogquality/yolo11s-pest-detection"
HF_FILENAME = "best.pt"

CONF_THRESHOLD = float(os.environ.get("PEST_CONF_THRESHOLD", "0.15"))
IMG_SIZE = 640
 
_model = None
_model_lock = threading.Lock()
 
 
def _download_weights():
    """Download (or reuse cached) model weights from the Hugging Face Hub."""
    from huggingface_hub import hf_hub_download
 
    return hf_hub_download(
        repo_id=HF_REPO_ID,
        filename=HF_FILENAME,
        local_dir=MODEL_DIR,
    )
 
 
def get_model():
    """Lazily load the pretrained YOLO pest-detection model (thread-safe, loads once)."""
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
 
 
def warm_up():
    """Optional: call at app startup so the first web request isn't slow."""
    try:
        get_model()
        return True
    except Exception as exc:  # pragma: no cover - startup diagnostics only
        print(f"[pest_model] Could not load pretrained model: {exc}")
        return False