# AURAfarming

Demo of a smart farming dashboard computer vision models to detect crop pests, disease, and soil health. Runs locally from the terminal with Python and Flask. The two CV pages run real image-processing on the pixels of whatever photo you upload.

## Setup

```bash
# from the aurafarming/ folder
python3 -m venv venv
source venv/bin/activate    # on Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Run

```bash
python app.py
```

Then open **http://127.0.0.1:5000** in your browser.
