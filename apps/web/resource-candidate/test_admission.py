"""Independent admission regressions. Artificial in-memory rows only.
Set QA_IMPORTER_PATH to a proposed implementation for before/after comparison.
"""
import importlib.util
import os
from pathlib import Path
import sqlite3
import sys
import unittest

CORE=Path(__file__).resolve().parent
sys.path.insert(0,str(CORE))
target=Path(os.environ.get('QA_IMPORTER_PATH',str(CORE/'local_import.py')))
spec=importlib.util.spec_from_file_location('qa_import_target',target)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
from capacity_guard import Capacity,allocated_bytes

class ImportAdmissionRegression(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        module.migrate_local(self.db)
        self.db.execute("INSERT INTO dg_resource_sources VALUES('s','https://example.test','pinned','https://example.test/license','now')")
        self.db.execute("INSERT INTO dg_resource_works VALUES('w','ARTIFICIAL QA FIXTURE','pli',NULL)")
        self.db.commit()
        self.capacity=Capacity(allocated_bytes(self.db))

    def row(self,derivative='allow',evidence='https://example.test/license'):
        raw='Artificial original';normal='Artificial normalized'
        return {'id':'v','work_id':'w','source_ref':'fixture','version':'v1','raw':raw,'normalized':normal,
                'raw_sha256':module.digest(raw.encode()),'normalized_sha256':module.digest(normal.encode()),
                'rights':{'download':'allow','store':'allow','display':'deny','derivative':derivative,'rag':'deny','train':'deny'},
                'evidence_url':evidence,'reviewer_id':'fixture-reviewer'}

    def ingest(self,row):
        return module.import_local(self.db,'b','request','s',[row],'fixture-admin','now',self.capacity)

    def test_derivative_deny_rejects_normalized_production(self):
        with self.assertRaisesRegex(ValueError,'RIGHTS_NOT_APPROVED'):
            self.ingest(self.row('deny'))
        self.assertEqual(self.db.execute('SELECT count(*) FROM dg_resource_versions').fetchone()[0],0)

    def test_derivative_unknown_rejects_normalized_production(self):
        with self.assertRaisesRegex(ValueError,'RIGHTS_NOT_APPROVED'):
            self.ingest(self.row('unknown'))

    def test_evidence_url_userinfo_rejected(self):
        with self.assertRaisesRegex(ValueError,'RIGHTS_EVIDENCE_REQUIRED'):
            self.ingest(self.row(evidence='https://fixture-user@example.test/license'))

    def test_evidence_url_missing_hostname_rejected(self):
        with self.assertRaisesRegex(ValueError,'RIGHTS_EVIDENCE_REQUIRED'):
            self.ingest(self.row(evidence='https:///license'))

    def test_evidence_url_control_character_rejected(self):
        with self.assertRaisesRegex(ValueError,'RIGHTS_EVIDENCE_REQUIRED'):
            self.ingest(self.row(evidence='https://example.test/\nlicense'))

    def test_valid_purpose_specific_admission_remains_private(self):
        self.assertEqual(self.ingest(self.row()),'imported')
        self.assertEqual(self.db.execute('SELECT visibility FROM dg_resource_versions').fetchone()[0],'private')

if __name__=='__main__':unittest.main()
