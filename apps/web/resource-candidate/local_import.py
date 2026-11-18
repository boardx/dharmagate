"""Offline SQLite contract prototype. No network, cloud credentials or production wiring.

Caller is a test harness, NOT an authenticated admin API. Production deployment is blocked
until real legacy session verification and authoritative admin role checks are wired.
"""
import hashlib
import json
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit
from capacity_guard import check_physical

PURPOSES = ('download', 'store', 'display', 'derivative', 'rag', 'train')
MAX_BYTES = 50 * 1024 * 1024
MAX_VERSIONS = 100
MAX_FRAGMENTS = 20000
MAX_ROWS = 100000

def digest(value):
    return hashlib.sha256(value).hexdigest()

def migrate_local(db):
    """Refuse collisions; execute the complete additive schema in one transaction."""
    schema = Path(__file__).with_name('schema-v1.sql').read_text()
    try:
        db.executescript('BEGIN IMMEDIATE;\n' + schema + '\nCOMMIT;')
    except sqlite3.Error:
        if db.in_transaction:
            db.rollback()
        raise ValueError('SCHEMA_COLLISION_OR_INVALID') from None

def import_local(db, batch_id, key, source_id, rows, actor_id, now, capacity=None):
    if not 1 <= len(rows) <= 10:
        raise ValueError('BATCH_LIMIT')
    validated = []
    for row in rows:
        raw = row['raw'].encode('utf-8')
        normal = row['normalized'].encode('utf-8')
        if not raw or not normal or len(raw) + len(normal) > 524288:
            raise ValueError('VERSION_BYTES')
        if digest(raw) != row['raw_sha256'] or digest(normal) != row['normalized_sha256']:
            raise ValueError('INTEGRITY')
        rights = row['rights']
        if (set(rights) != set(PURPOSES) or any(x not in ('allow','deny','unknown') for x in rights.values())
                or rights['download'] != 'allow' or rights['store'] != 'allow' or rights['derivative'] != 'allow' or rights['train'] != 'deny'):
            raise ValueError('RIGHTS_NOT_APPROVED')
        try:
            evidence_text=row.get('evidence_url','')
            if not isinstance(evidence_text,str) or any(c.isspace() or ord(c)<32 or ord(c)==127 for c in evidence_text):
                raise ValueError('INVALID_URL')
            evidence=urlsplit(evidence_text)
            valid_evidence=(evidence.scheme=='https' and bool(evidence.hostname) and evidence.username is None and evidence.password is None)
            evidence.port  # Reject malformed port specifications without logging the URL.
        except (ValueError,TypeError):valid_evidence=False
        if not valid_evidence or not row.get('reviewer_id'):
            raise ValueError('RIGHTS_EVIDENCE_REQUIRED')
        fragments = []
        for kind, text in (('original', row['raw']), ('normalized', row['normalized'])):
            # Preserve every character. Never split UTF-8 bytes mid-codepoint.
            for ordinal, offset in enumerate(range(0, len(text), 8192)):
                body = text[offset:offset + 8192]
                if len(body.encode('utf-8')) > 32768:
                    raise ValueError('FRAGMENT_BYTES')
                fragments.append((kind, ordinal, body))
        validated.append((row, len(raw) + len(normal), fragments))
    canonical = json.dumps(rows, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()
    manifest = digest(canonical)
    db.execute('BEGIN IMMEDIATE')
    try:
        check_physical(db, capacity)
        existing = db.execute('SELECT manifest_sha256,status FROM dg_ingest_batches WHERE idempotency_key=?', (key,)).fetchone()
        if existing:
            if existing != (manifest, 'complete'):
                raise ValueError('IDEMPOTENCY_CONFLICT')
            db.rollback()
            return 'already-imported'
        count, used = db.execute('SELECT count(*),coalesce(sum(content_bytes),0) FROM dg_resource_versions').fetchone()
        pilot_accepted = db.execute("SELECT count(*) FROM dg_resource_audit WHERE action='pilot-accepted'").fetchone()[0] > 0
        existing_batches = db.execute("SELECT count(*) FROM dg_ingest_batches WHERE status='complete'").fetchone()[0]
        if existing_batches and not pilot_accepted:
            raise ValueError('PILOT_ACCEPTANCE_REQUIRED')
        fragments_count = db.execute('SELECT count(*) FROM dg_resource_fragments').fetchone()[0]
        total_rows = sum(db.execute('SELECT count(*) FROM ' + table).fetchone()[0] for table in (
            'dg_resource_sources','dg_resource_works','dg_resource_versions','dg_resource_fragments',
            'dg_resource_rights','dg_ingest_batches','dg_resource_checks','dg_resource_audit'))
        new_fragments = sum(len(x[2]) for x in validated)
        if (count + len(rows) > min(MAX_VERSIONS, capacity.max_versions) or used + sum(x[1] for x in validated) > min(MAX_BYTES, capacity.max_content_bytes)
                or fragments_count + new_fragments > min(MAX_FRAGMENTS, capacity.max_fragments)
                or total_rows + 2 + len(rows) * 8 + new_fragments > min(MAX_ROWS, capacity.max_rows)):
            raise ValueError('CAPACITY_LIMIT')
        db.execute('INSERT INTO dg_ingest_batches(id,source_id,idempotency_key,manifest_sha256,status,planned,created_at) VALUES(?,?,?,?,?,?,?)',
                   (batch_id,source_id,key,manifest,'pending',len(rows),now))
        for row, size, fragments in validated:
            db.execute('INSERT INTO dg_resource_versions(id,work_id,source_id,source_ref,content_version,raw_sha256,normalized_sha256,content_bytes,batch_id) VALUES(?,?,?,?,?,?,?,?,?)',
                       (row['id'],row['work_id'],source_id,row['source_ref'],row['version'],row['raw_sha256'],row['normalized_sha256'],size,batch_id))
            for kind, ordinal, body in fragments:
                db.execute('INSERT INTO dg_resource_fragments VALUES(?,?,?,?,?,?,?)',
                           (f"{row['id']}-{kind}-{ordinal}",row['id'],kind,ordinal,f'char:{ordinal * 8192}',body,digest(body.encode())))
            for purpose in PURPOSES:
                db.execute('INSERT INTO dg_resource_rights(version_id,purpose,decision,evidence_url,reviewer_id,reviewed_at) VALUES(?,?,?,?,?,?)',
                           (row['id'],purpose,row['rights'][purpose],row['evidence_url'],row['reviewer_id'],now))
            db.execute('INSERT INTO dg_resource_checks VALUES(?,?,?,?,?,?,?)',
                       (row['id']+'-integrity',batch_id,row['id'],'sha256','pass','raw-and-normalized-verified',now))
        db.execute("UPDATE dg_ingest_batches SET status='complete',succeeded=? WHERE id=?",(len(rows),batch_id))
        db.execute('INSERT INTO dg_resource_audit(id,actor_id,action,resource_id,request_id,occurred_at,payload_sha256) VALUES(?,?,?,?,?,?,?)',(batch_id+'-audit',actor_id,'import',batch_id,key,now,manifest))
        # Trial writes are uncommitted. Check real allocated SQLite pages, including
        # indexes, and roll back the entire import before COMMIT if growth exceeds cap.
        check_physical(db, capacity)
        db.commit()
        return 'imported'
    except Exception:
        db.rollback()
        raise
