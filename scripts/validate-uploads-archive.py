#!/usr/bin/env python3
"""Validate a TEKSHER HUB uploads archive without extracting it."""
import pathlib
import sys
import tarfile


def validate_archive(archive_path: str) -> None:
    try:
        with tarfile.open(archive_path, "r:gz") as archive:
            members = archive.getmembers()
            if not members:
                raise ValueError("archive is empty")
            root_found = False
            for member in members:
                raw = member.name
                if not raw or raw.startswith("/") or "\\" in raw:
                    raise ValueError(f"unsafe path: {raw!r}")
                parts = raw.rstrip("/").split("/")
                if not parts or parts[0] != "uploads" or any(p in ("", ".", "..") for p in parts):
                    raise ValueError(f"path escapes uploads/: {raw!r}")
                if not (member.isfile() or member.isdir()):
                    raise ValueError(f"links and special files are not allowed: {raw!r}")
                if raw.rstrip("/") == "uploads":
                    root_found = True
            if not root_found:
                raise ValueError("archive does not contain uploads/")
    except (OSError, tarfile.TarError, ValueError) as exc:
        raise ValueError(f"invalid uploads archive: {exc}") from exc


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: validate-uploads-archive.py <uploads.tar.gz>", file=sys.stderr)
        sys.exit(2)
    try:
        validate_archive(sys.argv[1])
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
