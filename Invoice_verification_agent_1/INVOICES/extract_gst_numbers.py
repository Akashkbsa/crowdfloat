import csv
import re
from pathlib import Path

from pdfminer.high_level import extract_text


# GSTIN format: 15 chars
# 2 digits state code + 10-char PAN + entity code + 'Z' + checksum
GST_PATTERN = re.compile(r"\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b")


def extract_gst_from_pdf(pdf_path: Path) -> list[str]:
    """Extract all unique GST numbers from a single PDF file."""
    try:
        text = extract_text(str(pdf_path)) or ""
    except Exception as exc:
        print(f"[WARN] Could not read {pdf_path.name}: {exc}")
        return []

    matches = GST_PATTERN.findall(text.upper())
    # Preserve order while removing duplicates.
    return list(dict.fromkeys(matches))


def scrape_folder(folder_path: Path) -> list[dict[str, str]]:
    """Scan all PDFs in folder and return invoice -> GST mapping rows."""
    rows: list[dict[str, str]] = []

    pdf_files = sorted(folder_path.glob("*.pdf"))
    if not pdf_files:
        print(f"[INFO] No PDF files found in: {folder_path}")
        return rows

    for pdf_file in pdf_files:
        gst_numbers = extract_gst_from_pdf(pdf_file)

        if gst_numbers:
            for gst in gst_numbers:
                rows.append(
                    {
                        "file_name": pdf_file.name,
                        "gst_number": gst,
                    }
                )
        else:
            rows.append(
                {
                    "file_name": pdf_file.name,
                    "gst_number": "NOT_FOUND",
                }
            )

    return rows


def write_csv(rows: list[dict[str, str]], output_csv: Path) -> None:
    """Write GST extraction results to CSV."""
    output_csv.parent.mkdir(parents=True, exist_ok=True)
    with output_csv.open("w", newline="", encoding="utf-8") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=["file_name", "gst_number"])
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    invoices_dir = Path(r"D:\vscode\SAEC\Invoice_verification_agent_1\INVOICES\generated_invoices")
    output_csv = invoices_dir / "gst_numbers_extracted.csv"

    rows = scrape_folder(invoices_dir)
    write_csv(rows, output_csv)

    found_count = sum(1 for row in rows if row["gst_number"] != "NOT_FOUND")
    print(f"[DONE] Processed {len(rows)} rows.")
    print(f"[DONE] GST matches found: {found_count}")
    print(f"[DONE] Output written to: {output_csv}")


if __name__ == "__main__":
    main()
