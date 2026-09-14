# AI/ML Pipeline Design
## GICVMAP — Video Analytics Pipeline

---

## 1. Pipeline Overview

### 1.1 Objectives
- Detect vehicles and persons in live CCTV streams
- Recognize license plates (ANPR) with Indian plate format normalization
- Optional: Extract facial embeddings for facial recognition
- Cross-camera vehicle tracking via plate number matching
- Real-time alert generation on watchlist matches

### 1.2 Pipeline Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    AI/ML PIPELINE ARCHITECTURE                     │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                   STAGE 1: FRAME CAPTURE                  │    │
│  │                                                            │    │
│  │  Camera (RTSP) → MediaMTX → OpenCV VideoCapture           │    │
│  │  Frame extraction at configurable FPS (default: 2)         │    │
│  │  Output: BGR numpy array (1920x1080 or 640x480)          │    │
│  └──────────────────────────┬───────────────────────────────┘    │
│                              │                                    │
│  ┌──────────────────────────▼───────────────────────────────┐    │
│  │                   STAGE 2: OBJECT DETECTION               │    │
│  │                                                            │    │
│  │  Model: YOLOv8n (nano) or YOLOv8s (small)                │    │
│  │  Input: 640x640 RGB tensor                                │    │
│  │  Output: [{class, confidence, bbox}]                       │    │
│  │  Classes: car, truck, motorcycle, bus, person              │    │
│  │  Threshold: confidence >= 0.5                              │    │
│  └──────────────────────────┬───────────────────────────────┘    │
│                              │                                    │
│              ┌───────────────┴───────────────┐                   │
│              │                               │                   │
│  ┌───────────▼───────────┐     ┌─────────────▼─────────────┐   │
│  │ STAGE 3a: PLATE DETE  │     │ STAGE 3b: FACE DETECT+EMB │   │
│  │                       │     │                             │   │
│  │ Crop vehicle bbox     │     │ Crop person bbox            │   │
│  │ → Plate detector      │     │ → RetinaFace detection      │   │
│  │ → Plate bbox          │     │ → ArcFace embedding (512-d) │   │
│  └───────────┬───────────┘     └─────────────┬─────────────┘   │
│              │                               │                   │
│  ┌───────────▼───────────┐                   │                   │
│  │ STAGE 4: PLATE OCR    │                   │                   │
│  │                       │                   │                   │
│  │ EasyOCR v3          │                   │                   │
│  │ Input: plate image    │                   │                   │
│  │ Output: raw text      │                   │                   │
│  └───────────┬───────────┘                   │                   │
│              │                               │                   │
│  ┌───────────▼───────────┐                   │                   │
│  │ STAGE 5: NORMALIZE    │                   │                   │
│  │                       │                   │                   │
│  │ Regex cleanup         │                   │                   │
│  │ Indian plate format   │                   │                   │
│  │ Output: "GJ01AB1234"  │                   │                   │
│  └───────────┬───────────┘                   │                   │
│              │                               │                   │
│              └───────────────┬───────────────┘                   │
│                              │                                    │
│  ┌──────────────────────────▼───────────────────────────────┐    │
│  │                   STAGE 6: EVENT CREATION                 │    │
│  │                                                            │    │
│  │  DetectionEvent JSON → Event Bus (Redis/Kafka)            │    │
│  │  Parallel: Store + Watchlist Match + (Future: Analytics)   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2. Model Specifications

### 2.1 Object Detection — YOLOv8

| Property | Value |
|----------|-------|
| Model | YOLOv8n (nano, 3.2M params) or YOLOv8s (small, 11.2M params) |
| Framework | PyTorch (Ultralytics) |
| Input Size | 640×640 RGB |
| Output | Bounding boxes + class + confidence |
| Classes | car, truck, motorcycle, bus, person (COCO subset) |
| NMS Threshold | 0.45 |
| Confidence Threshold | 0.5 (configurable) |
| Inference Time (CPU) | ~50-100ms per frame (YOLOv8n) |
| Inference Time (GPU) | ~10-20ms per frame (YOLOv8n) |

**Usage:**
```python
from ultralytics import YOLO

model = YOLO("yolov8n.pt")
results = model(frame, conf=0.5, classes=[2, 3, 5, 7, 0])  # car,truck,bus,motorcycle,person

for r in results:
    for box in r.boxes:
        cls = int(box.cls[0])
        conf = float(box.conf[0])
        x1, y1, x2, y2 = box.xyxy[0].tolist()
```

### 2.2 Plate Detection — YOLOv8 Custom

| Property | Value |
|----------|-------|
| Model | Fine-tuned YOLOv8n on plate detection dataset |
| Input Size | 320×320 (cropped from vehicle region) |
| Output | Plate bounding box within vehicle crop |
| Confidence Threshold | 0.6 |
| Training Data | Indian license plate datasets (CCPD, custom) |
| File Size | ~5MB |

**Fallback Approach (no custom model):**
- Heuristic cropping of lower 30% of vehicle bounding box
- Apply edge detection to find plate region
- Pass to OCR directly

### 2.3 Plate OCR — EasyOCR

| Property | Value |
|----------|-------|
| Model | EasyOCR v3 (det + rec + cls) |
| Languages | English |
| Input | Cropped plate image |
| Output | Raw text string |
| Confidence Threshold | 0.5 |
| Inference Time | ~20-50ms per plate |

**Usage:**
```python
from EasyOCR import EasyOCR

ocr = EasyOCR(use_angle_cls=True, lang='en', show_log=False)
result = ocr.ocr(plate_image, cls=True)

# Extract text
raw_text = ""
for line in result[0]:
    text = line[1][0]
    confidence = line[1][1]
    raw_text += text
```

### 2.4 Plate Normalization — Regex

```python
import re

# Indian plate format: XX ## XX ####
# Examples: GJ01AB1234, MH12DE1234, DL01CA1234
INDIAN_PLATE_REGEX = re.compile(
    r'^[A-Z]{2}'           # State code (2 letters)
    r'[0-9]{1,2}'          # District code (1-2 digits)
    r'[A-Z]{1,3}'          # Series (1-3 letters)
    r'[0-9]{4}$'           # Number (4 digits)
)

def normalize_plate(raw_text: str) -> str | None:
    """Normalize OCR output to standard Indian plate format."""
    # Remove spaces, special characters
    cleaned = re.sub(r'[^A-Z0-9]', '', raw_text.upper())
    
    # Try direct match
    if INDIAN_PLATE_REGEX.match(cleaned):
        return cleaned
    
    # Try with common OCR errors
    # O → 0, I → 1, S → 5, B → 8
    corrections = {'O': '0', 'I': '1', 'S': '5', 'B': '8'}
    corrected = cleaned
    for old, new in corrections.items():
        test = corrected.replace(old, new)
        if INDIAN_PLATE_REGEX.match(test):
            return test
    
    # Return cleaned version even if not perfectly matching
    if len(cleaned) >= 8:
        return cleaned
    
    return None
```

### 2.5 Face Recognition — InsightFace (Optional)

| Property | Value |
|----------|-------|
| Detection Model | RetinaFace |
| Embedding Model | ArcFace (InsightFace) |
| Embedding Dimension | 512 |
| Similarity Metric | Cosine similarity |
| Match Threshold | 0.6 (configurable) |
| Storage | pgvector in PostgreSQL |

**Usage:**
```python
from insightface.app import FaceAnalysis

app = FaceAnalysis(name='buffalo_l', providers=['CPUExecutionProvider'])
app.add_detector(det_name='retinaface', det_thresh=0.5)
app.prepare(ctx_id=0)

faces = app.get(frame)
for face in faces:
    embedding = face.embedding  # 512-dim vector
    bbox = face.bbox
    det_score = face.det_score
```

---

## 3. Inference Service API

### 3.1 Request/Response

**POST /api/v1/infer**

Request:
```
Content-Type: multipart/form-data

frame: <JPEG image>
camera_id: "b3f1a2c4-..."
timestamp: "2026-09-10T14:32:05.123Z"
```

Response:
```json
{
  "detections": [
    {
      "detection_type": "vehicle",
      "plate_number": "GJ01AB1234",
      "plate_confidence": 0.87,
      "plate_raw_ocr": "GJ 01 AB 1234",
      "object_class": "car",
      "object_confidence": 0.92,
      "bbox": {"x": 120, "y": 340, "w": 200, "h": 90},
      "processing_time_ms": 145
    },
    {
      "detection_type": "person",
      "object_class": "person",
      "object_confidence": 0.78,
      "bbox": {"x": 500, "y": 200, "w": 80, "h": 180},
      "processing_time_ms": 145
    }
  ],
  "processing_time_ms": 145,
  "model_version": "yolov8n-1.0",
  "frame_size": {"width": 1920, "height": 1080}
}
```

### 3.2 Internal Pipeline Flow

```python
# ai-service/pipeline.py

class InferencePipeline:
    def __init__(self):
        self.detector = YOLO("yolov8n.pt")
        self.plate_detector = YOLO("yolov8-plate.pt")
        self.ocr = EasyOCR(use_angle_cls=True, lang='en')
        self.face_app = None  # Optional
    
    async def process_frame(self, frame: np.ndarray, camera_id: str, timestamp: str) -> dict:
        detections = []
        
        # Stage 1: Object Detection
        results = self.detector(frame, conf=0.5, classes=[0, 2, 3, 5, 7])
        
        for r in results:
            for box in r.boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                
                if cls == 0:  # person
                    # Stage 3b: Face detection (optional)
                    person_crop = frame[int(y1):int(y2), int(x1):int(x2)]
                    detection = {
                        "detection_type": "person",
                        "object_class": "person",
                        "object_confidence": conf,
                        "bbox": {"x": int(x1), "y": int(y1), 
                                 "w": int(x2-x1), "h": int(y2-y1)}
                    }
                    detections.append(detection)
                
                else:  # vehicle (car=2, motorcycle=3, bus=5, truck=7)
                    vehicle_crop = frame[int(y1):int(y2), int(x1):int(x2)]
                    
                    # Stage 2: Plate detection
                    plate_result = self.plate_detector(vehicle_crop, conf=0.6)
                    
                    plate_number = None
                    plate_confidence = 0.0
                    
                    if plate_result and plate_result[0].boxes:
                        plate_box = plate_result[0].boxes[0]
                        px1, py1, px2, py2 = plate_box.xyxy[0].tolist()
                        plate_crop = vehicle_crop[int(py1):int(py2), int(px1):int(px2)]
                        
                        # Stage 3: Plate OCR
                        ocr_result = self.ocr.ocr(plate_crop, cls=True)
                        
                        if ocr_result and ocr_result[0]:
                            raw_text = ocr_result[0][0][1][0]
                            plate_confidence = ocr_result[0][0][1][1]
                            
                            # Stage 4: Normalize
                            plate_number = normalize_plate(raw_text)
                    
                    detection = {
                        "detection_type": "vehicle",
                        "plate_number": plate_number,
                        "plate_confidence": plate_confidence,
                        "plate_raw_ocr": raw_text if plate_number else None,
                        "object_class": self._class_name(cls),
                        "object_confidence": conf,
                        "bbox": {"x": int(x1), "y": int(y1),
                                 "w": int(x2-x1), "h": int(y2-y1)}
                    }
                    detections.append(detection)
        
        return {
            "detections": detections,
            "processing_time_ms": 0,  # Measured externally
            "model_version": "yolov8n-1.0"
        }
```

---

## 4. Performance Optimization

### 4.1 CPU Optimization

| Technique | Implementation |
|-----------|---------------|
| Model quantization | INT8 quantization via ONNX Runtime |
| Frame resizing | Process at 640x640, display full resolution |
| Batch processing | Process multiple frames simultaneously |
| Async pipeline | Frame capture overlaps with inference |
| Selective processing | Skip frames if queue is full |

### 4.2 GPU Optimization

| Technique | Implementation |
|-----------|---------------|
| CUDA acceleration | PyTorch CUDA for inference |
| Mixed precision | FP16 inference for faster processing |
| TensorRT export | Export YOLOv8 to TensorRT for max GPU perf |
| Batch inference | Process N frames simultaneously on GPU |
| Multi-stream | Process multiple camera streams on same GPU |

### 4.3 Performance Targets

| Metric | CPU (YOLOv8n) | GPU (YOLOv8n) | GPU (YOLOv8s) |
|--------|--------------|---------------|---------------|
| Inference time/frame | 50-100ms | 10-20ms | 15-30ms |
| Max concurrent cameras | 5-10 | 20-40 | 15-30 |
| FPS throughput | 10-20 | 50-100 | 30-50 |
| Memory usage | ~500MB | ~2GB | ~4GB |

---

## 5. Model Configuration

```yaml
# config/ai_config.yaml

pipeline:
  fps_sampling: 2                    # Frames per second per camera
  batch_size: 1                      # Frames per batch
  max_concurrent_cameras: 20         # Max cameras processed simultaneously
  device: "cpu"                      # "cpu" or "cuda:0"
  frame_resize: [640, 640]          # Resize before inference
  save_snapshots: true               # Save detection snapshots to MinIO
  snapshot_quality: 85               # JPEG quality for snapshots

detection:
  model: "yolov8n.pt"
  input_size: 640
  confidence_threshold: 0.5
  nms_threshold: 0.45
  classes: ["person", "car", "motorcycle", "bus", "truck"]
  class_ids: [0, 2, 3, 5, 7]        # COCO class IDs

plate_detection:
  model: "yolov8-plate.pt"
  input_size: 320
  confidence_threshold: 0.6
  crop_padding: 10                   # Pixels to add around plate bbox

ocr:
  engine: "EasyOCR"                # "EasyOCR" or "easyocr"
  languages: ["en"]
  confidence_threshold: 0.5
  max_plate_length: 12
  min_plate_length: 8

normalization:
  indian_plate_regex: "^[A-Z]{2}[0-9]{1,2}[A-Z]{1,3}[0-9]{4}$"
  apply_ocr_corrections: true        # Fix common OCR mistakes

face_recognition:
  enabled: false                     # Optional feature
  detection_model: "retinaface"
  embedding_model: "arcface"
  embedding_dim: 512
  similarity_threshold: 0.6
  storage: "pgvector"                # "pgvector" or "faiss"

tracking:
  enable_within_camera: true         # ByteTrack for single-camera tracking
  iou_threshold: 0.3                 # IOU for track association
  max_age: 30                        # Frames to keep lost track
```

---

## 6. Model Training & Fine-Tuning (Future)

### 6.1 Plate Detection Dataset

| Dataset | Size | Purpose |
|---------|------|---------|
| CCPD (Chinese License Plate) | 250K+ images | Base training |
| Indian Plate Dataset (custom) | 5K+ images | Fine-tuning for Indian plates |
| Synthetic Plates | Generated | Augmentation |

### 6.2 Fine-Tuning Process

```bash
# Fine-tune YOLOv8 for plate detection
yolo detect train \
    model=yolov8n.pt \
    data=indian_plates.yaml \
    epochs=50 \
    imgsz=320 \
    batch=16 \
    name=plate_detector
```

---

*End of AI/ML Pipeline Design*
