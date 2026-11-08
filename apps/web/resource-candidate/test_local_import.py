import copy
import sqlite3
import unittest
from local_import import migrate_local, import_local, digest, PURPOSES
from capacity_guard import Capacity, allocated_bytes

class OfflineResourceTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.execute('PRAGMA foreign_keys=ON')
        self.db.execute('CREATE TABLE legacy_sentinel(value TEXT)')
        self.db.execute("INSERT INTO legacy_sentinel VALUES('unchanged')")
        self.db.commit()
        self.capacity = Capacity(allocated_bytes(self.db))
        migrate_local(self.db)
        self.db.execute("INSERT INTO dg_resource_sources VALUES('source','https://example.org','pinned','https://example.org/license','now')")
        self.db.execute("INSERT INTO dg_resource_works VALUES('work','fixture','pli',NULL)")
        self.db.commit()
        self.row = dict(id='version',work_id='work',source_ref='fixture',version='v1',raw='巴利text',normalized='巴利text',
                        raw_sha256=digest('巴利text'.encode()), normalized_sha256=digest('巴利text'.encode()),
                        rights={p: ('allow' if p in ('store','download','derivative') else 'deny') for p in PURPOSES},
                        evidence_url='https://example.org/license',reviewer_id='fixture-reviewer')

    def ingest(self, rows=None, key='key'):
        return import_local(self.db,'batch',key,'source',rows or [self.row],'fixture-admin','now',self.capacity)

    def test_roundtrip_and_private_default(self):
        self.assertEqual(self.ingest(),'imported')
        self.assertEqual(self.db.execute('SELECT visibility FROM dg_resource_versions').fetchone()[0],'private')
        self.assertEqual(self.db.execute("SELECT body FROM dg_resource_fragments WHERE kind='original'").fetchone()[0],self.row['raw'])
        self.assertEqual(self.db.execute('SELECT count(*) FROM dg_resource_audit').fetchone()[0],1)

    def test_idempotent_retry(self):
        self.ingest()
        self.assertEqual(self.ingest(),'already-imported')
        self.assertEqual(self.db.execute('SELECT count(*) FROM dg_resource_versions').fetchone()[0],1)

    def test_idempotency_conflict(self):
        self.ingest()
        changed=copy.deepcopy(self.row); changed['version']='v2'
        with self.assertRaisesRegex(ValueError,'IDEMPOTENCY_CONFLICT'): self.ingest([changed])

    def test_hash_tampering_rejected(self):
        self.row['raw']='different'
        with self.assertRaisesRegex(ValueError,'INTEGRITY'): self.ingest()

    def test_unknown_storage_permission_rejected(self):
        self.row['rights']['store']='unknown'
        with self.assertRaisesRegex(ValueError,'RIGHTS_NOT_APPROVED'): self.ingest()

    def test_training_permission_rejected(self):
        self.row['rights']['train']='allow'
        with self.assertRaisesRegex(ValueError,'RIGHTS_NOT_APPROVED'): self.ingest()

    def test_partial_batch_failure_atomic(self):
        second=copy.deepcopy(self.row); second['id']='second';second['work_id']='missing'
        with self.assertRaises(sqlite3.IntegrityError): self.ingest([self.row,second])
        for table in ('dg_resource_versions','dg_resource_fragments','dg_ingest_batches','dg_resource_audit'):
            self.assertEqual(self.db.execute('SELECT count(*) FROM '+table).fetchone()[0],0)

    def test_schema_collision_refuses_without_touching_legacy(self):
        with self.assertRaisesRegex(ValueError,'SCHEMA_COLLISION'): migrate_local(self.db)
        self.assertEqual(self.db.execute('SELECT value FROM legacy_sentinel').fetchone()[0],'unchanged')

    def test_batch_over_ten_rejected(self):
        with self.assertRaisesRegex(ValueError,'BATCH_LIMIT'): self.ingest([self.row]*11)

    def test_version_byte_limit_rejected(self):
        self.row['raw']='x'*524288
        with self.assertRaisesRegex(ValueError,'VERSION_BYTES'): self.ingest()

if __name__=='__main__': unittest.main()
