"""
parser_service.py — Stage 2: Text Parsing.

Converts raw OCR text into a structured dict with the following fields:
  • invoice_id   — e.g. "25-26/174", "INV-001"
  • gst          — 15-char Indian GSTIN, e.g. "33DSZPP0624K1Z7"
  • amount       — Grand Total / Net Amount as float
  • date         — invoice date as string

Designed to handle real-world invoice photos with OCR noise:
  - Common label variants (INVOICE.NO / INVOICE NO / INV NO, etc.)
  - DD.MM.YYYY and DD-MM-YYYY and DD/MM/YYYY date formats
  - GSTIN with partial label corruption ("GSTIN:", "TIN:", "STIN:")
  - Grand total with or without spaces ("GRANDTOTAL", "GRAND TOTAL")
  - OCR character substitutions (O↔0, I↔1, S↔5, B↔8)
"""

import re
from typing import Dict, Any, Optional
from app.utils.helpers import log_stage


# ─── OCR noise cleanup ──────────────────────────────────────────────────────

def _clean_ocr_noise(text: str) -> str:
    """
    Normalise common OCR misreads before pattern matching.

    Transformations applied:
    • O / o between digits → 0
    • I / l / | between digits → 1
    • S between digits → 5 (if likely), B between digits → 8
    • Remove non-printing control characters (but preserve newlines!)
    • Collapse multiple spaces / tabs to single space
    • Normalize multiple newlines → single newline
    """
    text = text.replace("\r", "")  # Remove CR (carriage return), keep LF (newline)
    text = re.sub(r"(?<=\d)[Oo](?=\d)", "0", text)   # O → 0 between digits
    text = re.sub(r"(?<=\d)[Il|](?=\d)", "1", text)   # I/l/| → 1 between digits
    text = re.sub(r"(?<=\d)[Ss](?=\d)", "5", text)   # S → 5 between digits
    text = re.sub(r"(?<=\d)[Bb](?=\d)", "8", text)   # B → 8 between digits
    # Strip control chars BUT PRESERVE newlines (\x0a = LF)
    text = re.sub(r"[\x00-\x09\x0b-\x1f\x7f]+", "", text)  # Remove controls except LF
    text = re.sub(r"[ \t]+", " ", text)  # Collapse spaces/tabs
    text = re.sub(r"\n{2,}", "\n", text)  # Collapse multiple newlines
    return text


# ─── Regex patterns ─────────────────────────────────────────────────────────

# --- GSTIN ---
# 15-char format: 2 digits + 5 uppercase + 4 digits + 1 uppercase + 1 digit + 1 uppercase + 1 alphanumeric
_GST_STANDALONE = re.compile(
    # Keep this broad; `_is_valid_gstin` will enforce structural correctness.
    r"\b([0-9A-Z]{15})\b",
    re.IGNORECASE,
)
_GST_LABELLED = re.compile(
    r"(?:GSTIN|GSTN|GST\s*NO|GST|STIN|TIN|PAN|PARTY\s*GST\s*NO)\s*[:\-#]?\s*([A-Z0-9]{15})\b",
    re.IGNORECASE,
)

# --- Invoice ID ---
# Supports specific labels and fallback heuristics
_INVOICE_ID_LABELLED = re.compile(
    r"(?:INVOICE\s*NO|INVOICE\s*NUMBER|INV(?:O?ICE)?\s*NO|BILL\s*NO|VOUCHER\s*NO|DOC\s*NO|S\.?\s*NO)"
    r"\s*[:\-#]?\s*([A-Z0-9][A-Z0-9\-/]{1,40})",
    re.IGNORECASE,
)
_INVOICE_ID_GENERIC = re.compile(
    r"\bINV(?:O?ICE)?\s*[#:\-]?\s*([A-Z0-9\-\/]{3,30})\b",
    re.IGNORECASE,
)

# --- Date ---
# Handles: INVOICE DATE, DATE OF INVOICE, BILL DATE, plain DD/MM/YYYY, YYYY-MM-DD, DD-MMM-YY
_DATE_LABELLED = re.compile(
    r"(?:INVOICE\s*DATE|DATE\s*OF\s*INVOICE|BILL\s*DATE|DATE)\s*[:\-]?\s*(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4})",
    re.IGNORECASE,
)
_DATE_MONTH_ABBR = re.compile(
    r"\b(\d{1,2}[-/](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[-/]\d{2,4})\b",
    re.IGNORECASE,
)
_DATE_MONTH_PARTS = re.compile(
    r"\b(\d{1,2})[-/](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*[-/](\d{2,4})\b",
    re.IGNORECASE,
)
_DATE_ISO = re.compile(
    r"\b(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})\b"
)
_DATE_STANDALONE = re.compile(
    r"\b(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4})\b"
)
_DATE_STANDALONE_2YEAR = re.compile(
    r"\b(\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2})\b"
)

# --- Amount (Grand Total) ---
# Handles: "GRAND TOTAL  10,499"  "GRANDTOTAL 10499"  "AMOUNT DUE  ₹10,499.00" etc.
_AMOUNT_OUTSTANDING = re.compile(
    r"Total\s*Outstanding\s*(?:Rs\.?|₹)?\s*[:\s]*([\d\,]+(?:\.\d+)?)",
    re.IGNORECASE,
)
_AMOUNT_CHARGEABLE = re.compile(
    r"(?:Amount\s*Chargeable|Grand\s*Total|Total\s*Amount|Invoice\s*Total|Total)\s*[:\s₹Rs\.]*([\d\,]+(?:\.\d+)?)",
    re.IGNORECASE,
)
_AMOUNT_GRAND = re.compile(
    r"(?:GRAND\s*TOTAL|GRANDTOTAL|NET\s*TOTAL|TOTAL\s*AMOUNT|NET\s*AMOUNT|TOTAL\s*PAYABLE|INVOICE\s*TOTAL|AMOUNT\s*DUE|BILL\s*AMOUNT)"
    r"[\s:₹Rs.INR]*(\d{1,3}(?:[\,\s]\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)",
    re.IGNORECASE,
)
# Fallback on currency label value
_AMOUNT_FALLBACK = re.compile(
    r"(?:Rs\.?|INR|₹)\s*(\d{1,3}(?:[\,\s]\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)",
    re.IGNORECASE,
)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _extract_invoice_id(text: str) -> Optional[str]:
    """Try multiple invoice-id patterns and fallbacks."""
    # 0) Explicit invoice label: try the same-line value or next non-empty line.
    inv_label = re.search(r"\bInvoice\s*(?:No(?:\.|\b)|Number)\s*[:\-]?\s*(.*)", text, re.IGNORECASE)
    if inv_label:
        candidate = inv_label.group(1).strip().upper()
        if not candidate:
            remaining_lines = text[inv_label.end():].strip().splitlines()
            for line in remaining_lines:
                line = line.strip()
                if line and not re.match(r"^(GSTIN|GST|E-INVOICE|IRN|ACK|DELIVERY|BUYER|ONE|TOTAL)$", line, re.IGNORECASE):
                    candidate = line.upper()
                    break
        candidate = re.sub(r"[\\|]", "", candidate).replace(" ", "")
        if len(candidate) >= 3 and not candidate.isalpha() and not _looks_like_date(candidate) and not re.match(r"^(E-INVOICE|INVOICE|IRN)$", candidate, re.IGNORECASE):
            return candidate

    for pattern in (_INVOICE_ID_LABELLED, _INVOICE_ID_GENERIC):
        m = pattern.search(text)
        if m:
            candidate = m.group(1).strip().upper()
            candidate = re.sub(r"[\\|]", "", candidate)
            candidate = candidate.replace(" ", "")
            # Keep only first contiguous invoice pattern; drop trailing non-ID letters.
            m2 = re.match(r"([0-9A-Z\-\/]{2,})(?:[A-Z]+)?$", candidate)
            if m2:
                candidate = m2.group(1)
            if len(candidate) >= 3 and not candidate.isalpha():
                return candidate

    # fallback: any line containing invoice-like token but not the label-only case
    for line in text.splitlines():
        if re.search(r"\b(?:INV(?:O?ICE)?|BILL|DOC|S\.)\b", line, re.IGNORECASE):
            m = re.search(r"([A-Z0-9][A-Z0-9\-/]{2,35})", line, re.IGNORECASE)
            if m:
                candidate = m.group(1).strip().upper()
                if len(candidate) >= 3 and not candidate.isalpha() and not _looks_like_date(candidate):
                    return candidate

    # stronger fallback: recognize invoice-number tokens separated by spaces/newlines
    for line in text.splitlines():
        if re.search(r"\bINVOICE\b", line, re.IGNORECASE):
            m = re.search(r"([0-9A-Z][0-9A-Z\-/]{2,40})", line, re.IGNORECASE)
            if m:
                candidate = m.group(1).strip().upper()
                candidate = re.sub(r"[\\|]", "", candidate).replace(" ", "")
                m2 = re.match(r"([0-9A-Z\-/]{2,})(?:[A-Z]+)?$", candidate)
                if m2:
                    candidate = m2.group(1)
                if len(candidate) >= 3 and not candidate.isalpha() and not _looks_like_date(candidate):
                    return candidate

    # final catch-all heuristic: likely invoice-id tokens
    for token in re.findall(r"\b[0-9A-Z]{2,}[\-/][0-9A-Z]{1,}[\-/]?[0-9A-Z]*\b", text):
        token_clean = token.strip().upper()
        if re.search(r"\d", token_clean) and len(token_clean) >= 3 and not _looks_like_date(token_clean):
            return token_clean

    return None


def _normalize_gstin_candidate(candidate: str) -> str:
    """Normalise OCR-fuzzy GSTIN candidate to a clean upper-case string."""
    candidate = candidate.upper().strip()
    candidate = candidate.replace(" ", "")
    # Remove accidental punctuation/spaces.
    candidate = re.sub(r"[^A-Z0-9]", "", candidate)
    # Fix common OCR confusions in *digit* positions of GSTIN.
    # GSTIN pattern: 2 digits + 5 letters + 4 digits + 1 letter + 1 digit + 1 letter + 1 alnum
    if len(candidate) == 15:
        chars = list(candidate)
        digit_positions = {0, 1, 7, 8, 9, 10, 12}
        digit_fix = {"O": "0", "I": "1", "L": "1", "S": "5", "B": "8"}
        for i in digit_positions:
            if chars[i] in digit_fix:
                chars[i] = digit_fix[chars[i]]
        candidate = "".join(chars)
    # Ensure exactly 15 chars (GSTIN format requirement)
    if len(candidate) != 15:
        return ""  # Return empty if not exactly 15 chars
    return candidate


def _looks_like_date(token: str) -> bool:
    """Check whether token is a numeric date in common formats."""
    token_clean = token.strip()
    if re.match(r"^\d{1,2}[\-/]\d{1,2}[\-/]\d{2,4}$", token_clean):
        return True
    if re.match(r"^\d{4}[\-/]\d{1,2}[\-/]\d{1,2}$", token_clean):
        return True
    return False


def _extract_gst(text: str) -> Optional[str]:
    """Locate GSTIN from labelled text or standalone 15-char string."""
    log_stage("PARSER", f"[GST] Starting GST extraction...")
    log_stage("PARSER", f"[GST] Text preview (first 300 chars): {repr(text[:300])}")
    
    # 1) label-based extraction (strict)
    log_stage("PARSER", f"[GST] Trying _GST_LABELLED pattern...")
    label_match = _GST_LABELLED.search(text)
    if label_match:
        candidate = _normalize_gstin_candidate(label_match.group(1))
        log_stage("PARSER", f"[GST] Label match found: '{label_match.group(1)}' → normalized: '{candidate}'")
        if _is_valid_gstin(candidate):
            log_stage("PARSER", f"[GST] Valid GSTIN extracted: {candidate}")
            return candidate
        log_stage("PARSER", f"[GST] Label candidate failed validation: {candidate}")
    else:
        log_stage("PARSER", f"[GST] _GST_LABELLED pattern did NOT match")

    # 1b) fallback for explicit party GST no label
    log_stage("PARSER", f"[GST] Trying Party GST pattern...")
    party_match = re.search(r"Party\s*GST\s*No\s*[:\-#]?\s*([A-Z0-9]{15})\b", text, re.IGNORECASE)
    if party_match:
        candidate = _normalize_gstin_candidate(party_match.group(1))
        log_stage("PARSER", f"[GST] Party GST match found: '{party_match.group(1)}' → normalized: '{candidate}'")
        if _is_valid_gstin(candidate):
            log_stage("PARSER", f"[GST] Valid Party GST extracted: {candidate}")
            return candidate
    else:
        log_stage("PARSER", f"[GST] Party GST pattern did NOT match")

    # 2) standalone 15-char search with normalisation
    log_stage("PARSER", f"[GST] Trying _GST_STANDALONE pattern...")
    standalone_hits = _GST_STANDALONE.findall(text)
    log_stage("PARSER", f"[GST] _GST_STANDALONE found {len(standalone_hits)} matches: {standalone_hits}")
    for candidate in standalone_hits:
        candidate = _normalize_gstin_candidate(candidate)
        log_stage("PARSER", f"[GST] Standalone candidate: '{candidate}'")
        if _is_valid_gstin(candidate):
            log_stage("PARSER", f"[GST] Valid standalone GSTIN: {candidate}")
            return candidate

    # 3) any 15-char segment in text judged likely GSTIN
    log_stage("PARSER", f"[GST] Trying 15-char word boundary pattern...")
    fifteen_hits = re.findall(r"\b([0-9A-Z]{15})\b", text)
    log_stage("PARSER", f"[GST] 15-char pattern found {len(fifteen_hits)} matches: {fifteen_hits}")
    for cand in fifteen_hits:
        candidate = _normalize_gstin_candidate(cand)
        log_stage("PARSER", f"[GST] 15-char candidate: '{candidate}'")
        if _is_valid_gstin(candidate):
            log_stage("PARSER", f"[GST] Valid GSTIN from 15-char: {candidate}")
            return candidate

    # 4) Explicit GSTIN pattern match (2 digits, 5 letters, 4 digits, letter, digit, letter, alphanumeric)
    log_stage("PARSER", f"[GST] Trying explicit GSTIN format pattern on each line...")
    for i, line in enumerate(text.splitlines()):
        m = re.search(r"\b(\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z0-9])\b", line, re.IGNORECASE)
        if m:
            candidate = _normalize_gstin_candidate(m.group(1))
            log_stage("PARSER", f"[GST] Explicit GSTIN pattern match (line {i}): '{m.group(1)}' → '{candidate}'")
            if _is_valid_gstin(candidate):
                log_stage("PARSER", f"[GST] Valid GSTIN from explicit pattern: {candidate}")
                return candidate

    # 5) Fuzzy recovery from compacted text (handles spacing/punctuation corruption)
    fuzzy = _try_fuzzy_gstin_from_compact(text)
    if fuzzy:
        log_stage("PARSER", f"[GST] Fuzzy recovery succeeded → {fuzzy}")
        return fuzzy

    log_stage("PARSER", f"[GST] No valid GSTIN found after all attempts")
    return None


def _extract_date(text: str) -> Optional[str]:
    """Parse date in multiple formats and standardize as DD-MM-YYYY or YYYY-MM-DD."""
    date = (
        _search(_DATE_LABELLED, text)
        or _search(_DATE_MONTH_ABBR, text)
        or _search(_DATE_STANDALONE_2YEAR, text)
        or _search(_DATE_STANDALONE, text)
        or _search(_DATE_ISO, text)
    )
    if date:
        date = date.strip()
        m = _DATE_MONTH_PARTS.search(date)
        if m:
            day = int(m.group(1))
            mon = m.group(2).lower()[:3]
            year = int(m.group(3))
            if year < 100:
                year += 2000
            months = {
                'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12,
            }
            if mon in months:
                return f"{day:02d}-{months[mon]:02d}-{year:04d}"
        if re.match(r"^\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}$", date):
            parts = re.split(r"[.\-/]", date)
            return f"{int(parts[2]):02d}-{int(parts[1]):02d}-{int(parts[0]):04d}"
        date_norm = re.sub(r"[.\/]", "-", date)
        # Convert 2-digit years into 20YY.
        m2 = re.match(r"^(\d{1,2})-(\d{1,2})-(\d{2})$", date_norm)
        if m2:
            day = int(m2.group(1))
            mon = int(m2.group(2))
            yy = int(m2.group(3))
            return f"{day:02d}-{mon:02d}-{(2000 + yy):04d}"
        # Normalize DD-MM-YYYY.
        m3 = re.match(r"^(\d{1,2})-(\d{1,2})-(\d{4})$", date_norm)
        if m3:
            return f"{int(m3.group(1)):02d}-{int(m3.group(2)):02d}-{int(m3.group(3)):04d}"
        return date_norm
    return None


def _extract_amounts_from_items(text: str) -> list[float]:
    """Parse amounts from an 'Amount' column section if present."""
    lines = text.splitlines()
    amount_index = next((i for i,l in enumerate(lines) if re.search(r"\bAmount\b", l, re.IGNORECASE)), None)
    if amount_index is None:
        return []

    scraped = []
    # OCR text for tables can interleave headers/columns; scan a wider window
    # and stop early when a totals/tax section is encountered.
    for line in lines[amount_index + 1: amount_index + 30]:
        # break if heading likely ended or we reached other section
        if re.search(r"\b(Total|SubTotal|Grand|Net|Tax)\b", line, re.IGNORECASE):
            break
        # Money values normally have a decimal part; requiring '.' avoids picking
        # up quantities/HSN/line numbering that don't include decimals.
        for num in re.findall(r"\b\d{1,3}(?:[\,\s]\d{3})*\.\d+\b|\b\d+\.\d+\b", line):
            val = _to_float(num)
            if val is not None and val > 0:
                scraped.append(val)
    if not scraped:
        return []
    # Prefer "line totals" over smaller "rate" values.
    max_val = max(scraped)
    threshold = max_val * 0.4
    large = [v for v in scraped if v >= threshold]
    return large if large else scraped


def _extract_amount(text: str) -> Optional[float]:
    """Parse amount from label or currency-prefixed values."""
    for pattern in (_AMOUNT_OUTSTANDING, _AMOUNT_CHARGEABLE, _AMOUNT_GRAND, _AMOUNT_FALLBACK):
        raw = _search(pattern, text)
        amount = _to_float(raw)
        if amount is not None:
            return amount

    # Heuristic: use the maximum probable invoice line amount in table if no explicit total.
    # Prefer values appearing in the tail of the document because totals are
    # often near the bottom (reduces false positives from PIN/phone numbers).
    tail_text = text[int(len(text) * 0.4):]
    decimal_hits = re.findall(r"\b\d{1,3}(?:[\,\s]\d{3})*\.\d+\b|\b\d+\.\d+\b", tail_text)
    integer_hits = re.findall(r"\b\d{4,9}\b", tail_text)

    def _add_if_reasonable(hit: str) -> Optional[float]:
        val = _to_float(hit.replace(",", "").strip())
        if val is None:
            return None
        # Ignore very small values and very large identifiers.
        if val < 10 or val > 1e9:
            return None
        return val

    decimal_amounts: list[float] = []
    for h in decimal_hits:
        v = _add_if_reasonable(h)
        if v is not None:
            decimal_amounts.append(v)

    integer_amounts: list[float] = []
    for h in integer_hits:
        v = _add_if_reasonable(h)
        if v is not None:
            integer_amounts.append(v)

    amounts = decimal_amounts + integer_amounts

    if amounts:
        # Try to infer from amount table column first.
        item_amounts = _extract_amounts_from_items(text)
        if item_amounts:
            # if there are multiple line items, sum them
            line_sum = sum(item_amounts)
            if line_sum > 0:
                return round(line_sum, 2)

        # The invoice total is often max value (or sum of line amounts if no explicit total label).
        candidate_total = max(decimal_amounts) if decimal_amounts else max(amounts)

        # If dataset includes clear line items (multiple large amounts), sum them.
        if len(amounts) > 2:
            line_sum = sum([a for a in amounts if a >= 1.0])
            if abs(line_sum - candidate_total) > 1e-6 and line_sum > candidate_total:
                return round(line_sum, 2)

        return candidate_total

    return None



def _search(pattern: re.Pattern, text: str) -> Optional[str]:
    """Return first capture group stripped, or None."""
    m = pattern.search(text)
    return m.group(1).strip() if m else None


def _to_float(s: Optional[str]) -> Optional[float]:
    """Convert '10,499.00' → 10499.0, return None on failure."""
    if not s:
        return None
    try:
        return float(s.replace(",", "").strip())
    except ValueError:
        return None


def _is_valid_gstin(gstin: str) -> bool:
    """Basic structural check on a 15-char GSTIN."""
    if not gstin or len(gstin) != 15:
        return False
    return bool(re.match(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][A-Z][A-Z0-9]$", gstin))


def _try_fuzzy_gstin_from_compact(text: str) -> Optional[str]:
    """
    Last-resort GSTIN recovery:
    - Remove non-alphanumerics to repair broken spacing/punctuation.
    - Slide a 15-char window and validate via `_is_valid_gstin`.
    - Apply common digit OCR substitutions (O->0, I/L->1, S->5, B->8).
    """
    compact = re.sub(r"[^A-Za-z0-9]", "", text).upper()
    if len(compact) < 15:
        return None

    trans_digit_fix = str.maketrans({
        "O": "0",
        "I": "1",
        "L": "1",
        "S": "5",
        "B": "8",
    })
    compact_fixed = compact.translate(trans_digit_fix)

    for i in range(0, len(compact) - 15 + 1):
        cand = compact[i:i + 15]
        if _is_valid_gstin(cand):
            return cand
        cand_fixed = compact_fixed[i:i + 15]
        if _is_valid_gstin(cand_fixed):
            return cand_fixed
    return None


# ─── Main parse function ─────────────────────────────────────────────────────

def parse_invoice_text(raw_text: str) -> Dict[str, Any]:
    """
    Parse structured invoice fields from raw OCR text.

    Parameters
    ----------
    raw_text : str
        Raw text from the OCR service.

    Returns
    -------
    dict
        Keys: invoice_id, gst, amount (float | None), date.
    """
    log_stage("PARSER", "Parsing raw OCR text …")
    log_stage("PARSER", f"--- RAW OCR (first 600 chars) ---\n{raw_text[:600]}\n---")

    cleaned = _clean_ocr_noise(raw_text)

    # ── Invoice ID ───────────────────────────────────────────────────────────
    invoice_id = _extract_invoice_id(cleaned)

    # ── GSTIN ───────────────────────────────────────────────────────────────
    gst = _extract_gst(cleaned)

    # ── Date ─────────────────────────────────────────────────────────────────
    date = _extract_date(cleaned)

    # ── Amount ──────────────────────────────────────────────────────────────
    amount = _extract_amount(cleaned)

    parsed = {
        "invoice_id": invoice_id,
        "gst":        gst,
        "amount":     amount,
        "date":       date,
    }

    log_stage("PARSER", f"Parsed result → {parsed}")
    return parsed
