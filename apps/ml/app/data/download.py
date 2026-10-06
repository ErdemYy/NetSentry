import os
import hashlib
import json
import time
from pathlib import Path
import requests

BASE_DIR = Path(__file__).resolve().parent.parent.parent
RAW_DATA_DIR = BASE_DIR / "data" / "raw"
MANIFEST_PATH = BASE_DIR / "data" / "dataset_manifest.json"

DATASET_FILES = [
    "Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv",
    "Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv",
    "Friday-WorkingHours-Morning.pcap_ISCX.csv",
    "Monday-WorkingHours.pcap_ISCX.csv",
    "Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv",
    "Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv",
    "Tuesday-WorkingHours.pcap_ISCX.csv",
    "Wednesday-workingHours.pcap_ISCX.csv",
]

BASE_URL = "https://huggingface.co/datasets/c01dsnap/CIC-IDS2017/resolve/main/"


def compute_sha256(filepath: Path) -> str:
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(1024 * 1024), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()


def download_file(filename: str) -> dict:
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)
    destination = RAW_DATA_DIR / filename
    url = f"{BASE_URL}{filename}"

    if destination.exists() and destination.stat().st_size > 1024 * 1024:
        print(f"[EXISTS] {filename} ({destination.stat().st_size / (1024*1024):.2f} MB)")
        sha256 = compute_sha256(destination)
        return {
            "filename": filename,
            "status": "cached",
            "size_bytes": destination.stat().st_size,
            "size_mb": round(destination.stat().st_size / (1024 * 1024), 2),
            "sha256": sha256,
            "url": url,
        }

    print(f"[DOWNLOADING] {filename} from {url}...")
    t0 = time.time()
    response = requests.get(url, stream=True, timeout=30)
    response.raise_for_status()

    total_size = int(response.headers.get("content-length", 0))
    downloaded = 0

    temp_path = destination.with_suffix(".tmp")
    with open(temp_path, "wb") as f:
        for chunk in response.iter_content(chunk_size=1024 * 1024):
            if chunk:
                f.write(chunk)
                downloaded += len(chunk)
                percent = (downloaded / total_size * 100) if total_size else 0
                elapsed = time.time() - t0
                speed = (downloaded / (1024 * 1024)) / elapsed if elapsed > 0 else 0
                if int(percent) % 25 == 0:
                    print(f"  -> {filename}: {percent:.1f}% ({downloaded / (1024*1024):.1f}/{total_size/(1024*1024):.1f} MB) at {speed:.2f} MB/s", end="\r")

    print()
    temp_path.rename(destination)
    sha256 = compute_sha256(destination)
    print(f"[COMPLETE] {filename} in {time.time() - t0:.1f}s | SHA-256: {sha256[:16]}...")

    return {
        "filename": filename,
        "status": "downloaded",
        "size_bytes": destination.stat().st_size,
        "size_mb": round(destination.stat().st_size / (1024 * 1024), 2),
        "sha256": sha256,
        "url": url,
    }


def download_all(files_to_download=None):
    if files_to_download is None:
        files_to_download = DATASET_FILES

    print(f"Starting download of {len(files_to_download)} CIC-IDS2017 files to {RAW_DATA_DIR}...")
    manifest = {
        "dataset_name": "CIC-IDS2017",
        "provider": "Canadian Institute for Cybersecurity (UNB)",
        "official_url": "https://www.unb.ca/cic/datasets/ids-2017.html",
        "download_mirror": "https://huggingface.co/datasets/c01dsnap/CIC-IDS2017",
        "download_date": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "files": [],
    }

    for f in files_to_download:
        info = download_file(f)
        manifest["files"].append(info)

    with open(MANIFEST_PATH, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Manifest written to {MANIFEST_PATH}")
    return manifest


if __name__ == "__main__":
    download_all()
