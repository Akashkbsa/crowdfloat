"""
ocr_service.py — Stage 1: OCR Extraction using Tesseract.

Upgraded preprocessing pipeline for real-world invoice photos:
  1. Load & upscale small/medium images for sharper OCR
  2. Denoise using fastNlMeans
  3. Convert to grayscale
  4. Adaptive thresholding (handles uneven lighting from photos)
  5. Deskew (straighten rotated documents)
  6. Run pytesseract with PSM 6 (uniform block of text)
"""

import os
import re
import cv2
import numpy as np
import pytesseract

# PDF dependencies are optional but recommended for PDF input support.
try:
    from pdf2image import convert_from_path
except ImportError:
    convert_from_path = None

try:
    from pdfminer.high_level import extract_text as extract_pdf_text
except ImportError:
    extract_pdf_text = None

from app.config import TESSERACT_CMD, POPPLER_PATH
from app.utils.helpers import log_stage

pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

# Target long-side resolution for OCR; upscale if smaller, cap if much larger
OCR_TARGET_PX = 2400


def _resize_for_ocr(img: np.ndarray) -> np.ndarray:
    """
    Scale image so the longest side = OCR_TARGET_PX.
    Upscaling blurry photos helps Tesseract; downscaling massive images speeds it up.
    """
    h, w = img.shape[:2]
    longest = max(h, w)
    if longest == OCR_TARGET_PX:
        return img
    scale = OCR_TARGET_PX / longest
    new_w, new_h = int(w * scale), int(h * scale)
    interp = cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA
    return cv2.resize(img, (new_w, new_h), interpolation=interp)


def _deskew(gray: np.ndarray) -> np.ndarray:
    """
    Detect and correct document skew using minAreaRect on thresholded edges.
    Falls back to original if deskew angle is negligible (<0.5°).
    """
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1]
    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) == 0:
        return gray
    angle = cv2.minAreaRect(coords)[-1]
    # minAreaRect returns angles in [-90, 0); convert to [-45, 45)
    if angle < -45:
        angle = 90 + angle
    # Occasionally OpenCV returns values that still imply a ~90° rotation.
    # Clamp to a small skew correction range to avoid turning a portrait
    # invoice sideways.
    if angle > 45:
        angle -= 90
    if angle < -45:
        angle += 90
    if abs(angle) < 0.5:      # skip tiny corrections
        return gray
    h, w = gray.shape
    center = (w // 2, h // 2)
    M = cv2.getRotationMatrix2D(center, angle, 1.0)
    rotated = cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC,
                              borderMode=cv2.BORDER_REPLICATE)
    log_stage("OCR", f"Deskewed by {angle:.2f}°")
    return rotated


def _preprocess(img: np.ndarray) -> np.ndarray:
    """
    Full preprocessing chain:
    upscale → denoise → grayscale → deskew → adaptive threshold
    """
    # 1. Resize to target resolution
    img = _resize_for_ocr(img)

    # 2. Denoise (handles camera noise from phone photos)
    img = cv2.fastNlMeansDenoisingColored(img, None, h=10, hColor=10,
                                          templateWindowSize=7, searchWindowSize=21)

    # 3. Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 4. Deskew
    gray = _deskew(gray)

    # 5. Adaptive thresholding — handles uneven lighting / shadows in photos
    #    (much better than global Otsu for real scanned / photographed invoices)
    thresh = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=31,   # neighbourhood size (must be odd)
        C=11            # constant subtracted from mean
    )
    return thresh


def _tesseract_attempts(img: np.ndarray) -> str:
    """
    Try various tesseract configs and rotations, return best text hit.

    Performance note:
    This is intentionally "heavy". `extract_text()` does a fast first-pass
    and only calls this when that first-pass is too weak.
    """
    checks = []

    def score_text(text: str) -> int:
        # Encourage text with alnum density, numbers, and words.
        if not text:
            return 0
        tokens = re.findall(r"[A-Za-z0-9]{2,}", text)
        digits = re.findall(r"\d{2,}", text)
        return len(tokens) + len(digits) * 2

    # crops / variants to examine
    imgs = [img]
    imgs.append(cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE))
    imgs.append(cv2.rotate(img, cv2.ROTATE_180))
    imgs.append(cv2.rotate(img, cv2.ROTATE_90_COUNTERCLOCKWISE))

    configs = ["--oem 3 --psm 6", "--oem 3 --psm 3", "--oem 3 --psm 11"]

    for variant in imgs:
        for cfg in configs:
            try:
                text = pytesseract.image_to_string(variant, config=cfg)
                checks.append((score_text(text), cfg, text))
            except Exception:
                continue

    if not checks:
        return ""

    checks.sort(key=lambda x: x[0], reverse=True)
    best_score, best_cfg, best_text = checks[0]
    log_stage("OCR", f"Best OCR candidate score={best_score} cfg={best_cfg}")
    return best_text


def extract_text(image_path: str) -> str:
    """
    Run OCR on the image/PDF at *image_path* and return the best raw text.
    """
    log_stage("OCR", f"Starting OCR on: {image_path}")

    if not os.path.isfile(image_path):
        raise FileNotFoundError(f"Invoice file not found: {image_path}")

    ext = os.path.splitext(image_path)[1].lower()

    temp_pdf_image = None

    if ext == ".pdf":
        if not extract_pdf_text and not convert_from_path:
            raise RuntimeError("PDF support not installed: install pdfminer.six and pdf2image")

        if extract_pdf_text:
            try:
                pdf_text = extract_pdf_text(image_path).strip()
                if pdf_text and len(pdf_text) > 30:
                    log_stage("OCR", f"Extracted {len(pdf_text)} chars from PDF text parser")
                    return pdf_text
            except Exception as exc:
                log_stage("OCR", f"PDF text extraction failed: {exc}")

        if not convert_from_path:
            raise RuntimeError("pdf2image not installed or unavailable for PDF image conversion")

        try:
            images = convert_from_path(image_path, dpi=300, poppler_path=POPPLER_PATH)
        except Exception as exc:
            raise RuntimeError(f"PDF conversion to image failed: {exc}") from exc

        if not images:
            raise RuntimeError("No pages found in PDF")

        temp_pdf_image = os.path.join(os.path.dirname(image_path), "_pdf_page_1.png")
        images[0].save(temp_pdf_image, format="PNG")
        image_path = temp_pdf_image

    img = cv2.imread(image_path)
    if img is None:
        raise RuntimeError(f"OpenCV could not read file as image: {image_path}")

    log_stage("OCR", f"Original size: {img.shape[1]}×{img.shape[0]}")

    processed = _preprocess(img)

    # Fast first-pass (most invoices succeed here).
    fast_cfg = "--oem 3 --psm 6"
    raw_fast = ""
    try:
        raw_fast = pytesseract.image_to_string(processed, config=fast_cfg)
    except Exception:
        raw_fast = ""

    def score_text(text: str) -> int:
        if not text:
            return 0
        tokens = re.findall(r"[A-Za-z0-9]{2,}", text)
        digits = re.findall(r"\d{2,}", text)
        return len(tokens) + len(digits) * 2

    def looks_like_invoice(text: str) -> bool:
        if not text:
            return False
        t = text.upper()
        keywords = (
            "INVOICE",
            "GST",
            "GSTIN",
            "TOTAL",
            "AMOUNT",
            "BILL",
            "DATE",
            "RS",
            "INR",
            "TAX",
        )
        return any(k in t for k in keywords)

    fast_len = len(raw_fast.strip()) if raw_fast else 0
    fast_score = score_text(raw_fast)

    # If fast OCR looks readable, accept it; otherwise fall back.
    # (Length alone is not enough; some failures produce long symbol noise.)
    if raw_fast and fast_len >= 120 and fast_score >= 30 and looks_like_invoice(raw_fast):
        candidate = raw_fast
        log_stage("OCR", f"Fast OCR succeeded (len={len(candidate)} score={fast_score}) cfg={fast_cfg}")
    else:
        log_stage("OCR", f"Fast OCR too weak (len={fast_len} score={fast_score}) → falling back")
        raw_processed = _tesseract_attempts(processed)
        # Only try original image if processed attempt is still weak.
        if raw_processed and len(raw_processed.strip()) >= 80 and score_text(raw_processed) >= 20:
            candidate = raw_processed
        else:
            raw_original = _tesseract_attempts(img)
            candidate = raw_processed if len(raw_processed) >= len(raw_original) else raw_original

    log_stage("OCR", f"Selected OCR text length: {len(candidate)}")

    if temp_pdf_image and os.path.isfile(temp_pdf_image):
        try:
            os.remove(temp_pdf_image)
            log_stage("OCR", f"Removed temp PDF page image: {temp_pdf_image}")
        except OSError:
            pass

    return candidate
