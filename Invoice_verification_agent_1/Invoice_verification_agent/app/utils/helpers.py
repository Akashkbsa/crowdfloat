"""
helpers.py — Shared utility functions.

Keeps route / service code clean by centralising file-handling
and logging helpers.
"""

import os
import logging
from fastapi import UploadFile

# ─── Set up a module-level logger ────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
)
logger = logging.getLogger("invoice_system")


async def save_upload_file(upload_file: UploadFile, destination: str) -> str:
    """
    Persist an uploaded file to *destination* and return the full path.

    Parameters
    ----------
    upload_file : UploadFile
        The file received from the client.
    destination : str
        Directory where the file should be saved.

    Returns
    -------
    str
        Absolute path of the saved file.
    """
    os.makedirs(destination, exist_ok=True)
    file_path = os.path.join(destination, upload_file.filename)

    contents = await upload_file.read()
    with open(file_path, "wb") as f:
        f.write(contents)

    logger.info("Saved uploaded file → %s (%d bytes)", file_path, len(contents))
    return file_path


def log_stage(stage_name: str, message: str) -> None:
    """Convenience wrapper that prefixes log lines with a stage label."""
    logger.info("[%s] %s", stage_name, message)
