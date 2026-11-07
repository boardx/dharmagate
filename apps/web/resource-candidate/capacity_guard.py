"""Offline SQLite capacity checks; not a production D1 storage meter.

Allocated database pages are measured in the same exclusive write transaction.
WAL/journal disk usage is not included. Production D1 admission MUST remain disabled
until an authoritative size meter and atomic rollback guarantee are verified there.
"""
from dataclasses import dataclass

@dataclass(frozen=True)
class Capacity:
    baseline_bytes: int
    max_growth_bytes: int = 75 * 1024 * 1024
    max_content_bytes: int = 50 * 1024 * 1024
    max_versions: int = 100
    max_fragments: int = 20000
    max_rows: int = 100000

def allocated_bytes(db):
    try:
        count = db.execute('PRAGMA page_count').fetchone()[0]
        size = db.execute('PRAGMA page_size').fetchone()[0]
        if (not isinstance(count, int) or count <= 0 or not isinstance(size, int)
                or size < 512 or size > 65536 or size & (size - 1)):
            raise ValueError()
        return count * size
    except Exception:
        raise ValueError('PHYSICAL_MEASUREMENT_UNAVAILABLE') from None

def check_physical(db, capacity):
    if not isinstance(capacity, Capacity) or not isinstance(capacity.baseline_bytes, int) or capacity.baseline_bytes <= 0:
        raise ValueError('CAPACITY_BASELINE_REQUIRED')
    if min(capacity.max_growth_bytes, capacity.max_content_bytes, capacity.max_versions, capacity.max_fragments, capacity.max_rows) < 0:
        raise ValueError('INVALID_CAPACITY')
    current = allocated_bytes(db)
    if current < capacity.baseline_bytes:
        raise ValueError('CAPACITY_BASELINE_MISMATCH')
    if current - capacity.baseline_bytes > min(capacity.max_growth_bytes,75 * 1024 * 1024):
        raise ValueError('PHYSICAL_GROWTH_LIMIT')
    return current

def require_production_meter(meter=None, atomic_rollback_verified=False):
    # No boolean fallback, estimates or body-size proxy can enable admission.
    # This release has NO verified D1 physical-meter/atomic-import implementation.
    # Even caller-supplied flags cannot enable an unimplemented production path.
    raise ValueError('PRODUCTION_PHYSICAL_GUARD_UNVERIFIED')

def safe_failure(error):
    allowed = {'BATCH_LIMIT','VERSION_BYTES','FRAGMENT_BYTES','INTEGRITY','RIGHTS_NOT_APPROVED',
               'RIGHTS_EVIDENCE_REQUIRED','IDEMPOTENCY_CONFLICT','PILOT_ACCEPTANCE_REQUIRED','CAPACITY_LIMIT',
               'PHYSICAL_MEASUREMENT_UNAVAILABLE','CAPACITY_BASELINE_REQUIRED','CAPACITY_BASELINE_MISMATCH',
               'PHYSICAL_GROWTH_LIMIT','INVALID_CAPACITY','PRODUCTION_PHYSICAL_GUARD_UNVERIFIED'}
    # Never propagate exception text, SQL, file paths, body content or identities.
    code = str(error) if isinstance(error, ValueError) and str(error) in allowed else 'STORAGE_FAILURE'
    return {'status':'rejected','error':code,'content_or_identity_logged':False}

