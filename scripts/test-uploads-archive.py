#!/usr/bin/env python3
"""Unit tests for safe uploads archive validation."""
import io
import pathlib
import tarfile
import tempfile
import unittest

from validate_uploads_archive import validate_archive


class UploadsArchiveValidationTest(unittest.TestCase):
    def create_archive(self, members):
        temp = tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False)
        temp.close()
        path = pathlib.Path(temp.name)
        with tarfile.open(path, "w:gz") as archive:
            for name, kind, linkname in members:
                info = tarfile.TarInfo(name)
                if kind == "dir":
                    info.type = tarfile.DIRTYPE
                    archive.addfile(info)
                elif kind == "symlink":
                    info.type = tarfile.SYMTYPE
                    info.linkname = linkname
                    archive.addfile(info)
                elif kind == "hardlink":
                    info.type = tarfile.LNKTYPE
                    info.linkname = linkname
                    archive.addfile(info)
                else:
                    data = b"sample"
                    info.size = len(data)
                    archive.addfile(info, io.BytesIO(data))
        self.addCleanup(path.unlink, missing_ok=True)
        return str(path)

    def test_accepts_normal_uploads_archive(self):
        path = self.create_archive([
            ("uploads/", "dir", ""),
            ("uploads/abc.txt", "file", ""),
            ("uploads/nested/", "dir", ""),
            ("uploads/nested/def.pdf", "file", ""),
        ])
        validate_archive(path)

    def test_rejects_parent_traversal(self):
        path = self.create_archive([
            ("uploads/", "dir", ""),
            ("uploads/../../etc/evil", "file", ""),
        ])
        with self.assertRaises(ValueError):
            validate_archive(path)

    def test_rejects_absolute_and_outside_paths(self):
        for bad in ("/etc/evil", "other/file", "uploads\\evil", "uploads//evil"):
            with self.subTest(path=bad):
                path = self.create_archive([("uploads/", "dir", ""), (bad, "file", "")])
                with self.assertRaises(ValueError):
                    validate_archive(path)

    def test_rejects_symbolic_and_hard_links(self):
        for kind in ("symlink", "hardlink"):
            with self.subTest(kind=kind):
                path = self.create_archive([
                    ("uploads/", "dir", ""),
                    ("uploads/link", kind, "../../etc/passwd"),
                ])
                with self.assertRaises(ValueError):
                    validate_archive(path)

    def test_rejects_archive_without_uploads_root(self):
        path = self.create_archive([("unrelated.txt", "file", "")])
        with self.assertRaises(ValueError):
            validate_archive(path)


if __name__ == "__main__":
    unittest.main(verbosity=2)
