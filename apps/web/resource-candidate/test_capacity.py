import copy
import json
import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
from dataclasses import replace
import test_local_import as fixtures
from local_import import import_local, digest
from capacity_guard import Capacity, allocated_bytes, require_production_meter, safe_failure

class CapacityTests(unittest.TestCase):
    ingest=fixtures.OfflineResourceTests.ingest
    def setUp(self):
        fixtures.OfflineResourceTests.setUp(self)
        self.capacity=Capacity(allocated_bytes(self.db))

    def test_missing_physical_baseline_refuses(self):
        with self.assertRaisesRegex(ValueError,'CAPACITY_BASELINE_REQUIRED'):
            import_local(self.db,'b','k','source',[self.row],'fixture','now')
        self.assertEqual(self.db.execute('SELECT count(*) FROM dg_resource_versions').fetchone()[0],0)

    def test_physical_growth_rolls_back_before_commit(self):
        text='x'*200000
        self.row.update(raw=text,normalized=text,raw_sha256=digest(text.encode()),normalized_sha256=digest(text.encode()))
        self.capacity=replace(self.capacity,max_growth_bytes=0)
        with self.assertRaisesRegex(ValueError,'PHYSICAL_GROWTH_LIMIT'): self.ingest()
        for table in ('dg_resource_versions','dg_resource_fragments','dg_ingest_batches','dg_resource_audit'):
            self.assertEqual(self.db.execute('SELECT count(*) FROM '+table).fetchone()[0],0)

    def test_pilot_blocks_next_batch_until_explicit_acceptance(self):
        self.ingest()
        second=copy.deepcopy(self.row);second.update(id='v2',source_ref='ref2')
        with self.assertRaisesRegex(ValueError,'PILOT_ACCEPTANCE_REQUIRED'):
            import_local(self.db,'b2','k2','source',[second],'fixture','now',self.capacity)
        self.db.execute("INSERT INTO dg_resource_audit(id,actor_id,action,resource_id,request_id,occurred_at) VALUES('accept','fixture-reviewer','pilot-accepted','batch','accept','now')")
        self.db.commit()
        self.assertEqual(import_local(self.db,'b2','k2','source',[second],'fixture','now',self.capacity),'imported')

    def test_content_fragment_row_and_version_caps(self):
        for limit in ({'max_content_bytes':1},{'max_fragments':1},{'max_rows':1},{'max_versions':0}):
            with self.assertRaisesRegex(ValueError,'CAPACITY_LIMIT'):
                import_local(self.db,'b','k','source',[self.row],'fixture','now',replace(self.capacity,**limit))
        self.assertEqual(self.db.execute('SELECT count(*) FROM dg_ingest_batches').fetchone()[0],0)

    def test_utf8_32k_chunks_preserve_every_character(self):
        text='😀'*8193
        self.row.update(raw=text,normalized=text,raw_sha256=digest(text.encode()),normalized_sha256=digest(text.encode()))
        self.ingest()
        parts=[x[0] for x in self.db.execute("SELECT body FROM dg_resource_fragments WHERE kind='original' ORDER BY ordinal")]
        self.assertEqual(''.join(parts),text)
        self.assertEqual(max(len(p.encode()) for p in parts),32768)

    def test_unknown_production_meter_fails_closed(self):
        with self.assertRaisesRegex(ValueError,'PRODUCTION_PHYSICAL_GUARD_UNVERIFIED'):require_production_meter()
        with self.assertRaisesRegex(ValueError,'PRODUCTION_PHYSICAL_GUARD_UNVERIFIED'):require_production_meter(object())
        with self.assertRaisesRegex(ValueError,'PRODUCTION_PHYSICAL_GUARD_UNVERIFIED'):require_production_meter(object(),True)

    def test_physical_measurement_failure_is_not_estimated_from_text(self):
        class NoMeter:
            def execute(self,sql):raise RuntimeError('not supported')
        with self.assertRaisesRegex(ValueError,'PHYSICAL_MEASUREMENT_UNAVAILABLE'):allocated_bytes(NoMeter())

    def test_global_hundred_version_cap_cannot_be_increased_by_config(self):
        self.db.execute("INSERT INTO dg_ingest_batches(id,source_id,idempotency_key,manifest_sha256,status,planned,created_at) VALUES('seed','source','seed',?,'complete',10,'now')",('0'*64,))
        for n in range(100):
            self.db.execute("INSERT INTO dg_resource_versions VALUES(?, 'work','source',?,'v1',?,?,1,'seed','private')",(f'v{n}',f'ref{n}','0'*64,'0'*64))
        self.db.execute("INSERT INTO dg_resource_audit(id,actor_id,action,resource_id,request_id,occurred_at) VALUES('accepted','fixture','pilot-accepted','seed','accepted','now')")
        self.db.commit()
        self.capacity=Capacity(allocated_bytes(self.db),max_versions=1000)
        with self.assertRaisesRegex(ValueError,'CAPACITY_LIMIT'):self.ingest()
        self.assertEqual(self.db.execute('SELECT count(*) FROM dg_resource_versions').fetchone()[0],100)

    def test_error_receipt_never_logs_arbitrary_message(self):
        receipt=safe_failure(RuntimeError('DO-NOT-LOG-CONTENT'))
        self.assertEqual(receipt['error'],'STORAGE_FAILURE')
        self.assertNotIn('DO-NOT-LOG',json.dumps(receipt))
        self.assertEqual(safe_failure(ValueError('CAPACITY_LIMIT'))['error'],'CAPACITY_LIMIT')

    def test_two_connections_same_request_write_once(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'fixture.sqlite'
            target=sqlite3.connect(path);self.db.backup(target);target.close()
            results=[];errors=[];barrier=threading.Barrier(2)
            def worker(key,batch):
                db=sqlite3.connect(path,timeout=10);db.execute('PRAGMA foreign_keys=ON')
                try:
                    barrier.wait()
                    results.append(import_local(db,batch,key,'source',[self.row],'fixture','now',self.capacity))
                except Exception as error:errors.append(safe_failure(error)['error'])
                finally:db.close()
            threads=[threading.Thread(target=worker,args=('same-key','same-batch')) for _ in range(2)]
            for t in threads:t.start()
            for t in threads:t.join()
            self.assertEqual(errors,[]);self.assertEqual(sorted(results),['already-imported','imported'])
            db=sqlite3.connect(path)
            self.assertEqual(db.execute('SELECT count(*) FROM dg_resource_versions').fetchone()[0],1)
            self.assertEqual(db.execute("SELECT count(*) FROM dg_resource_audit WHERE action='import'").fetchone()[0],1)
            db.close()

    def test_concurrent_different_batches_cannot_skip_pilot_gate(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'fixture.sqlite'
            target=sqlite3.connect(path);self.db.backup(target);target.close()
            outcomes=[];barrier=threading.Barrier(2)
            def worker(n):
                db=sqlite3.connect(path,timeout=10);db.execute('PRAGMA foreign_keys=ON')
                row=copy.deepcopy(self.row);row.update(id=f'v{n}',source_ref=f'ref{n}')
                try:
                    barrier.wait()
                    outcomes.append(import_local(db,f'b{n}',f'k{n}','source',[row],'fixture','now',self.capacity))
                except Exception as error:outcomes.append(safe_failure(error)['error'])
                finally:db.close()
            threads=[threading.Thread(target=worker,args=(n,)) for n in range(2)]
            for t in threads:t.start()
            for t in threads:t.join()
            self.assertEqual(sorted(outcomes),['PILOT_ACCEPTANCE_REQUIRED','imported'])
            db=sqlite3.connect(path)
            self.assertEqual(db.execute('SELECT count(*) FROM dg_resource_versions').fetchone()[0],1)
            db.close()

if __name__=='__main__':unittest.main()
