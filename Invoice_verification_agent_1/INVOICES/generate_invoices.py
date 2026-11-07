from __future__ import annotations

import argparse
import csv
import random
import string
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import List, Tuple

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas


@dataclass(frozen=True)
class LineItem:
    sno: int
    description: str
    hsn: str
    qty: float
    rate: float
    uom: str

    @property
    def amount(self) -> float:
        return round(self.qty * self.rate, 2)


@dataclass(frozen=True)
class InvoiceData:
    invoice_no: str
    invoice_date: date
    po_no: str
    po_date: date
    buyer_name: str
    buyer_address_lines: List[str]
    buyer_gstin: str
    seller_gstin: str
    total: float
    items: List[LineItem]


def _rand_upper_letters(n: int) -> str:
    return "".join(random.choice(string.ascii_uppercase) for _ in range(n))


def _rand_digits(n: int) -> str:
    return "".join(random.choice(string.digits) for _ in range(n))


def generate_gstin() -> str:
    # GSTIN format: 2 digits (state code) + 10 char PAN + 1 entity + 'Z' + 1 checksum (alnum)
    state_code = f"{random.randint(1, 37):02d}"
    pan = f"{_rand_upper_letters(5)}{_rand_digits(4)}{_rand_upper_letters(1)}"
    entity = random.choice(string.digits[1:] + string.ascii_uppercase)
    checksum = random.choice(string.digits + string.ascii_uppercase)
    return f"{state_code}{pan}{entity}Z{checksum}"


def generate_invoice_no(inv_date: date, seq: int) -> str:
    fy_start = inv_date.year if inv_date.month >= 4 else inv_date.year - 1
    fy_end = (fy_start + 1) % 100
    return f"{str(fy_start)[-2:]}-{fy_end:02d}/{seq:03d}"


def generate_po_no(inv_date: date, seq: int) -> str:
    # Simple, readable PO format: PO/YYYYMM/#### (unique per invoice)
    return f"PO/{inv_date.strftime('%Y%m')}/{seq:04d}"


def money(x: float) -> str:
    # Match the sample style: 2 decimals, no thousands separators.
    return f"{x:.2f}"


def pick_items() -> List[LineItem]:
    catalog: List[Tuple[str, str, str]] = [
        ("SUPERON TIG 308L 2.4MM", "7223", "Kgs"),
        ("SUPERON TIG 309L 2.4MM", "7223", "Kgs"),
        ("SUPERON TIG 316L 2.4MM", "7223", "Kgs"),
        ("SUPERON MIG WIRE ER70S-6 0.8MM", "8311", "Kgs"),
        ("SUPERON MIG WIRE ER70S-6 1.0MM", "8311", "Kgs"),
        ("SUPERON E6013 3.15MM", "8311", "Kgs"),
        ("SUPERON E7018 3.15MM", "8311", "Kgs"),
        ("CUTTING DISC 4 INCH", "6804", "Nos"),
        ("GRINDING DISC 4 INCH", "6804", "Nos"),
        ("WELDING GLOVES LEATHER", "4203", "Pair"),
    ]
    n = random.randint(1, 4)
    chosen = random.sample(catalog, n)
    items: List[LineItem] = []
    for i, (desc, hsn, uom) in enumerate(chosen, start=1):
        if uom == "Kgs":
            qty = round(random.choice([5, 10, 15, 20]) + random.choice([0.0, 0.5]), 2)
            rate = round(random.uniform(220, 520), 2)
        elif uom == "Nos":
            qty = float(random.randint(2, 30))
            rate = round(random.uniform(25, 220), 2)
        else:
            qty = float(random.randint(1, 10))
            rate = round(random.uniform(120, 750), 2)
        items.append(LineItem(sno=i, description=desc, hsn=hsn, qty=qty, rate=rate, uom=uom))
    return items


def build_invoice(inv_date: date, seq: int, seller_gstin: str) -> InvoiceData:
    buyer_names = [
        "SR ENTERPRISES",
        "KAVIN TRADERS",
        "SRI LAKSHMI STEELS",
        "ARUN WELDING MART",
        "KONGU HARDWARES",
        "SENTHIL ENGINEERING SUPPLIES",
        "VIGNESH FABRICATIONS",
        "MURUGAN INDUSTRIALS",
    ]
    cities = [
        ("Tiruchirappalli", "620021"),
        ("Coimbatore", "641025"),
        ("Madurai", "625001"),
        ("Salem", "636001"),
        ("Erode", "638001"),
        ("Tirunelveli", "627001"),
    ]
    streets = [
        "12A, RANIMANGAMMAL SALAI, PATEL STREET",
        "45, GANDHI ROAD",
        "18/31A, ABBAS GARDENS STREET",
        "7, INDUSTRIAL ESTATE",
        "101, MAIN BAZAAR",
        "22, TVS NAGAR",
    ]

    buyer_name = random.choice(buyer_names)
    city, pincode = random.choice(cities)
    addr1 = random.choice(streets)
    addr2 = f"K.K.NAGAR, {city}"
    addr3 = f"{city}, {pincode}"

    items = pick_items()
    total = round(sum(i.amount for i in items), 2)

    return InvoiceData(
        invoice_no=generate_invoice_no(inv_date, seq),
        invoice_date=inv_date,
        po_no=generate_po_no(inv_date, seq),
        po_date=inv_date - timedelta(days=random.randint(1, 21)),
        buyer_name=buyer_name,
        buyer_address_lines=[addr1, addr2, addr3],
        buyer_gstin=generate_gstin(),
        seller_gstin=seller_gstin,
        total=total,
        items=items,
    )


def draw_box(c: canvas.Canvas, x: float, y: float, w: float, h: float, stroke=1) -> None:
    c.setLineWidth(stroke)
    c.rect(x, y, w, h, stroke=1, fill=0)


def draw_text(
    c: canvas.Canvas,
    x: float,
    y: float,
    text: str,
    font: str = "Helvetica",
    size: int = 9,
    bold: bool = False,
) -> None:
    fname = font + ("-Bold" if bold and not font.endswith("-Bold") else "")
    c.setFont(fname, size)
    c.drawString(x, y, text)


def draw_right_text(c: canvas.Canvas, x_right: float, y: float, text: str, font="Helvetica", size=9, bold=False) -> None:
    fname = font + ("-Bold" if bold and not font.endswith("-Bold") else "")
    c.setFont(fname, size)
    c.drawRightString(x_right, y, text)


def render_invoice_pdf(inv: InvoiceData, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(out_path), pagesize=A4)
    page_w, page_h = A4

    margin = 10 * mm
    x0, y0 = margin, margin
    w, h = page_w - 2 * margin, page_h - 2 * margin

    # Outer border
    draw_box(c, x0, y0, w, h, stroke=1.2)

    # Header strip
    header_h = 35 * mm
    draw_box(c, x0, page_h - margin - header_h, w, header_h, stroke=1.2)

    # Title line
    title_y = page_h - margin - 9 * mm
    draw_text(c, x0 + w / 2 - 22 * mm, title_y, "TAX INVOICE", size=12, bold=True)
    draw_right_text(c, x0 + w - 4 * mm, title_y, "Original for Buyer", size=9, bold=True)

    # Seller block (left)
    seller_x = x0 + 4 * mm
    seller_y = page_h - margin - 16 * mm
    draw_text(c, seller_x, seller_y, "WELD MART", size=14, bold=True)
    draw_text(c, seller_x, seller_y - 6 * mm, "18/31A, Abbas Gardens Street, Coimbatore,", size=9, bold=True)
    draw_text(c, seller_x, seller_y - 11 * mm, "Luna Nagar, TVS Nagar, Coimbatore - 641025, TamilNadu", size=9, bold=True)
    draw_text(c, seller_x, seller_y - 16 * mm, "Email:", size=9, bold=True)
    draw_text(c, seller_x + 12 * mm, seller_y - 16 * mm, "sales@weldmartt.com", size=9, bold=True)
    draw_right_text(c, x0 + w - 4 * mm, seller_y - 16 * mm, "Phone No: 9600927223", size=9, bold=True)

    draw_right_text(c, x0 + w - 4 * mm, seller_y, f"GSTIN: {inv.seller_gstin}", size=10, bold=True)

    # Customer & invoice meta row
    mid_top = page_h - margin - header_h - 0 * mm
    meta_h = 48 * mm
    draw_box(c, x0, mid_top - meta_h, w, meta_h, stroke=1.2)

    split_x = x0 + w * 0.57
    c.line(split_x, mid_top, split_x, mid_top - meta_h)

    # Left: customer
    left_pad = 4 * mm
    y = mid_top - 7 * mm
    draw_text(c, x0 + left_pad, y, "Customer Name Address:", bold=True)
    y -= 8 * mm
    draw_text(c, x0 + left_pad, y, inv.buyer_name, bold=True, size=11)
    y -= 6 * mm
    for line in inv.buyer_address_lines:
        draw_text(c, x0 + left_pad, y, line, size=9)
        y -= 5 * mm
    y -= 2 * mm
    draw_text(c, x0 + left_pad, y, f"Party GST No  : {inv.buyer_gstin}", bold=True)

    # Right: invoice meta
    rx0 = split_x + left_pad
    ry = mid_top - 10 * mm
    label_w = 24 * mm
    val_x = split_x + label_w + 12 * mm
    meta_lines = [
        ("Invoice No", inv.invoice_no),
        ("Inv. Date", inv.invoice_date.strftime("%d/%m/%Y")),
        ("PO. No", inv.po_no),
        ("PoDate", inv.po_date.strftime("%d/%m/%Y")),
        ("Vehicle.No", ""),
        ("Transport Ref", ""),
    ]
    for label, value in meta_lines:
        draw_text(c, rx0, ry, label, bold=True, size=10)
        draw_text(c, rx0 + label_w, ry, ":", bold=True, size=10)
        draw_text(c, val_x, ry, value, bold=True if value else False, size=10)
        ry -= 7 * mm

    # Items table
    table_top = mid_top - meta_h
    table_h = h - header_h - meta_h - 20 * mm
    table_y0 = table_top - table_h
    draw_box(c, x0, table_y0, w, table_h, stroke=1.2)

    # Columns: S.No | Description | HSN | Qty | Rate | UOM | Amount
    col_ws = [
        10 * mm,
        w * 0.43,
        18 * mm,
        18 * mm,
        22 * mm,
        16 * mm,
        w - (10 * mm + w * 0.43 + 18 * mm + 18 * mm + 22 * mm + 16 * mm),
    ]
    xs = [x0]
    for cw in col_ws:
        xs.append(xs[-1] + cw)
    for x in xs[1:-1]:
        c.line(x, table_top, x, table_y0)

    header_row_h = 10 * mm
    c.line(x0, table_top - header_row_h, x0 + w, table_top - header_row_h)

    headers = ["S.No", "Description of Goods", "HSN Code", "Qty", "Rate", "UOM", "Amount"]
    hy = table_top - 7 * mm
    for i, htxt in enumerate(headers):
        draw_text(c, xs[i] + 2 * mm, hy, htxt, bold=True)

    # Rows
    row_h = 8 * mm
    start_y = table_top - header_row_h - 6 * mm
    y = start_y
    c.setFont("Helvetica", 9)
    for item in inv.items:
        draw_text(c, xs[0] + 3 * mm, y, str(item.sno))
        draw_text(c, xs[1] + 2 * mm, y, item.description)
        draw_right_text(c, xs[2] + col_ws[2] - 2 * mm, y, item.hsn)
        draw_right_text(c, xs[3] + col_ws[3] - 2 * mm, y, money(item.qty))
        draw_right_text(c, xs[4] + col_ws[4] - 2 * mm, y, money(item.rate))
        draw_text(c, xs[5] + 2 * mm, y, item.uom)
        draw_right_text(c, x0 + w - 2 * mm, y, money(item.amount))
        y -= row_h

    # Total strip at bottom
    total_h = 12 * mm
    total_y0 = y0 + 6 * mm
    draw_box(c, x0, total_y0, w, total_h, stroke=1.2)
    draw_text(c, x0 + 4 * mm, total_y0 + 4 * mm, "Total Amount", bold=True, size=11)
    draw_right_text(c, x0 + w - 4 * mm, total_y0 + 4 * mm, money(inv.total), bold=True, size=12)

    c.showPage()
    c.save()


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate sample invoice PDFs (20 by default).")
    parser.add_argument("--count", type=int, default=20, help="Number of invoices to generate.")
    parser.add_argument(
        "--outdir",
        type=str,
        default="generated_invoices",
        help="Output directory for generated PDFs and CSV summary.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed for reproducible generation.",
    )
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    seller_gstin = "33AKCPP4134A3ZR"  # from your sample invoice

    # Generate dates in a recent window; ensure variety.
    base = date.today()
    start = base - timedelta(days=180)
    dates = [start + timedelta(days=random.randint(0, (base - start).days)) for _ in range(args.count)]
    dates.sort()

    rows = []
    for i in range(args.count):
        inv = build_invoice(dates[i], seq=i + 1, seller_gstin=seller_gstin)
        pdf_name = f"invoice_{inv.invoice_no.replace('/', '-')}_{inv.invoice_date.strftime('%Y%m%d')}.pdf"
        pdf_path = outdir / pdf_name
        render_invoice_pdf(inv, pdf_path)
        rows.append(
            {
                "pdf": str(pdf_path),
                "invoice_no": inv.invoice_no,
                "invoice_date": inv.invoice_date.isoformat(),
                "po_no": inv.po_no,
                "po_date": inv.po_date.isoformat(),
                "buyer_gstin": inv.buyer_gstin,
                "total_amount": f"{inv.total:.2f}",
            }
        )

    with (outdir / "summary.csv").open("w", newline="", encoding="utf-8") as f:
        wcsv = csv.DictWriter(
            f,
            fieldnames=["pdf", "invoice_no", "invoice_date", "po_no", "po_date", "buyer_gstin", "total_amount"],
        )
        wcsv.writeheader()
        wcsv.writerows(rows)

    print(f"Generated {args.count} invoices in: {outdir.resolve()}")
    print(f"Summary CSV: {(outdir / 'summary.csv').resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

