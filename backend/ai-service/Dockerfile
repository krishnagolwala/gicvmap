FROM nvidia/cuda:12.4.1-base-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

# System deps — python3.11 becomes THE interpreter
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-dev python3.11-distutils python3.11-venv \
    libgl1 libglib2.0-0 libgomp1 libsm6 libxext6 libxrender-dev \
    ffmpeg wget ca-certificates unzip \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3.11 /usr/bin/python \
    && ln -sf /usr/bin/python3.11 /usr/bin/python3 \
    && ln -sf /usr/bin/pip3 /usr/bin/pip

# Ensure pip exists FOR 3.11 (apt's python3-pip targets the default 3.10; ensurepip isn't shipped with 3.11)
RUN wget -q https://bootstrap.pypa.io/get-pip.py -O /tmp/get-pip.py \
    && python3.11 /tmp/get-pip.py \
    && rm /tmp/get-pip.py \
    && python3.11 -m pip install --upgrade pip setuptools wheel

COPY requirements-gpu.txt .
# Install through python3.11's own pip — never the 3.10 pip
RUN python3.11 -m pip install --no-cache-dir --timeout 180 --retries 10 -r requirements-gpu.txt

# ── Pre-bake YOLO model ──────────────────────────────────────
RUN python3.11 -c "from ultralytics import YOLO; YOLO('yolov8n.pt'); print('YOLO OK')"

# ── Pre-bake EasyOCR models ──────────────────────────────────
ENV EASYOCR_MODULE_PATH=/root/.EasyOCR

RUN set -e; \
    MODEL_DIR=/root/.EasyOCR/model; \
    mkdir -p $MODEL_DIR; \
    echo "==> Downloading craft_mlt_25k.zip ..."; \
    wget -q --show-progress \
        "https://github.com/JaidedAI/EasyOCR/releases/download/pre-v1.1.6/craft_mlt_25k.zip" \
        -O /tmp/craft.zip; \
    unzip -o /tmp/craft.zip -d $MODEL_DIR; \
    rm /tmp/craft.zip; \
    echo "craft_mlt_25k.pth: $(du -sh $MODEL_DIR/craft_mlt_25k.pth)"; \
    echo "==> Downloading english_g2.zip ..."; \
    wget -q --show-progress \
        "https://github.com/JaidedAI/EasyOCR/releases/download/v1.3/english_g2.zip" \
        -O /tmp/english.zip; \
    unzip -o /tmp/english.zip -d $MODEL_DIR; \
    rm /tmp/english.zip; \
    echo "english_g2.pth: $(du -sh $MODEL_DIR/english_g2.pth)"

# ── Verify EasyOCR init ──────────────────────────────────────
RUN python3.11 -c "import easyocr, os; m='/root/.EasyOCR/model'; r=easyocr.Reader(['en'], gpu=False, verbose=False, model_storage_directory=m, download_enabled=False); print('EasyOCR OK')"

COPY main.py .

ENV NO_PROXY="*"
ENV no_proxy="*"

EXPOSE 8000
CMD ["python3.11", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]