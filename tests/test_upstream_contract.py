"""Fail visibly when the reviewed official update replacement scope changes."""
import hashlib
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


class UpstreamUpdateContract(unittest.TestCase):
    def test_reviewed_official_updater_preserves_extension_paths(self):
        contract = json.loads((ROOT / "portable/upstream-compatibility.json").read_text())
        source = (ROOT / "portable/Installer.cs").read_text(encoding="utf-8")
        method = source[source.index("    private static void UpdateExisting("):source.index("    private static void Launch(")].strip()
        self.assertEqual(
            hashlib.sha256(method.encode()).hexdigest(), contract["updateMethodSha256"],
            "O atualizador oficial mudou: revise o escopo de substituição e repita o teste de preservação antes de atualizar o contrato.",
        )
        self.assertIn('Path.Combine(destination, "apps", "OpenCode")', method)
        self.assertIn('Path.Combine(destination, "Abrir OpenCode.ps1")', method)
        self.assertNotIn('Path.Combine(destination, "profile")', method)
        self.assertNotIn('Path.Combine(destination, "portable")', method)

    def test_build_gate_rejects_a_changed_updater(self):
        source = (ROOT / "portable/Installer.cs").read_text(encoding="utf-8")
        changed = source.replace('private static void UpdateExisting(string destination, int processId)', 'private static void UpdateExisting(string destination, int processId) /* changed */')
        with tempfile.TemporaryDirectory() as folder:
            candidate = Path(folder) / "Installer.cs"
            candidate.write_text(changed, encoding="utf-8")
            result = subprocess.run(["node", str(ROOT / "portable/verify-upstream.cjs"), str(candidate)], capture_output=True, text=True, encoding="utf-8", errors="replace")
        self.assertNotEqual(result.returncode, 0, "O build aceitou um contrato de atualização alterado")


if __name__ == "__main__":
    unittest.main()
