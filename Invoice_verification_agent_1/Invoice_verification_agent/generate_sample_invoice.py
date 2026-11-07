"""
generate_sample_invoice.py — Creates a sample invoice image for testing.

Run this script directly:
    python generate_sample_invoice.py

It generates 'sample_invoice.png' in the project root with realistic
invoice text that the OCR + parser pipeline can process.
"""

from PIL import Image, ImageDraw, ImageFont
import os

# ─── Output path ────────────────────────────────────────────────────────────
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "sample_invoice.png")

# ─── Canvas settings ────────────────────────────────────────────────────────
WIDTH, HEIGHT = 800, 600
BG_COLOR = (255, 255, 255)
TEXT_COLOR = (30, 30, 30)
LINE_COLOR = (180, 180, 180)
ACCENT = (0, 102, 204)

# ─── Invoice content ────────────────────────────────────────────────────────
INVOICE_LINES = [
    ("INVOICE", 28, ACCENT, 300, 30),
    ("Invoice No: INV-2026-0042", 18, TEXT_COLOR, 50, 90),
    ("Date: 12-03-2026", 18, TEXT_COLOR, 50, 120),
    ("", 0, TEXT_COLOR, 0, 0),  # spacer
    ("From: Acme Solutions Pvt Ltd", 16, TEXT_COLOR, 50, 170),
    ("GSTIN: 29ABCDE1234F1Z5", 16, TEXT_COLOR, 50, 200),
    ("", 0, TEXT_COLOR, 0, 0),  # spacer
    ("To: Beta Enterprises", 16, TEXT_COLOR, 50, 250),
    ("", 0, TEXT_COLOR, 0, 0),  # spacer
    ("Description               Qty    Rate      Amount", 14, (100, 100, 100), 50, 310),
    ("Web Development            1    40000.00   40000.00", 14, TEXT_COLOR, 50, 340),
    ("UI/UX Design               1    10000.00   10000.00", 14, TEXT_COLOR, 50, 365),
    ("", 0, TEXT_COLOR, 0, 0),  # spacer
    ("Grand Total: Rs. 50000.00", 20, ACCENT, 400, 430),
    ("", 0, TEXT_COLOR, 0, 0),  # spacer
    ("Payment Terms: Net 30 Days", 14, (120, 120, 120), 50, 500),
    ("Thank you for your business!", 14, (120, 120, 120), 50, 530),
]


def generate():
    """Render the sample invoice image and save to disk."""
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    # Draw a border
    draw.rectangle([20, 20, WIDTH - 20, HEIGHT - 20], outline=LINE_COLOR, width=2)

    # Horizontal divider lines
    draw.line([50, 155, WIDTH - 50, 155], fill=LINE_COLOR, width=1)
    draw.line([50, 295, WIDTH - 50, 295], fill=LINE_COLOR, width=1)
    draw.line([50, 410, WIDTH - 50, 410], fill=LINE_COLOR, width=1)
    draw.line([50, 480, WIDTH - 50, 480], fill=LINE_COLOR, width=1)

    for text, size, color, x, y in INVOICE_LINES:
        if not text:
            continue
        try:
            font = ImageFont.truetype("arial.ttf", size)
        except OSError:
            font = ImageFont.load_default()
        draw.text((x, y), text, fill=color, font=font)

    img.save(OUTPUT_PATH)
    print(f"✅ Sample invoice saved → {OUTPUT_PATH}")


if __name__ == "__main__":
    generate()
