-- LOCAL REVIEW CANDIDATE. Not applied to production. No changes to legacy tables.
CREATE TABLE dg_resource_sources (
 id TEXT PRIMARY KEY, source_url TEXT NOT NULL, pinned_version TEXT NOT NULL,
 license_evidence_url TEXT NOT NULL, reviewed_at TEXT
);
CREATE TABLE dg_resource_works (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, language TEXT NOT NULL, author TEXT
);
CREATE TABLE dg_ingest_batches (
 id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES dg_resource_sources(id),
 idempotency_key TEXT NOT NULL UNIQUE, manifest_sha256 TEXT NOT NULL CHECK(length(manifest_sha256)=64),
 status TEXT NOT NULL CHECK(status IN ('pending','complete','failed','quarantined')),
 planned INTEGER NOT NULL CHECK(planned BETWEEN 1 AND 10), succeeded INTEGER NOT NULL DEFAULT 0,
 failed INTEGER NOT NULL DEFAULT 0, error_class TEXT, created_at TEXT NOT NULL
);
CREATE TABLE dg_resource_versions (
 id TEXT PRIMARY KEY, work_id TEXT NOT NULL REFERENCES dg_resource_works(id),
 source_id TEXT NOT NULL REFERENCES dg_resource_sources(id), source_ref TEXT NOT NULL,
 content_version TEXT NOT NULL, raw_sha256 TEXT NOT NULL CHECK(length(raw_sha256)=64),
 normalized_sha256 TEXT NOT NULL CHECK(length(normalized_sha256)=64),
 content_bytes INTEGER NOT NULL CHECK(content_bytes BETWEEN 1 AND 524288),
 batch_id TEXT NOT NULL REFERENCES dg_ingest_batches(id),
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','published','quarantined')),
 UNIQUE(source_id,source_ref,content_version)
);
CREATE TABLE dg_resource_fragments (
 id TEXT PRIMARY KEY, version_id TEXT NOT NULL REFERENCES dg_resource_versions(id),
 kind TEXT NOT NULL CHECK(kind IN ('original','normalized')), ordinal INTEGER NOT NULL CHECK(ordinal>=0),
 locator TEXT NOT NULL, body TEXT NOT NULL CHECK(length(CAST(body AS BLOB))<=32768),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64), UNIQUE(version_id,kind,ordinal)
);
CREATE TABLE dg_resource_rights (
 version_id TEXT NOT NULL REFERENCES dg_resource_versions(id),
 purpose TEXT NOT NULL CHECK(purpose IN ('download','store','display','derivative','rag','train')),
 decision TEXT NOT NULL DEFAULT 'unknown' CHECK(decision IN ('allow','deny','unknown')),
 evidence_url TEXT NOT NULL, reviewer_id TEXT NOT NULL, reviewed_at TEXT NOT NULL,
 revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>=1),
 PRIMARY KEY(version_id,purpose), CHECK(purpose!='train' OR decision='deny')
);
CREATE TABLE dg_resource_checks (
 id TEXT PRIMARY KEY, batch_id TEXT NOT NULL REFERENCES dg_ingest_batches(id),
 version_id TEXT REFERENCES dg_resource_versions(id), check_kind TEXT NOT NULL,
 result TEXT NOT NULL CHECK(result IN ('pass','fail')), safe_summary TEXT NOT NULL, checked_at TEXT NOT NULL
);
CREATE TABLE dg_resource_audit (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, action TEXT NOT NULL, resource_id TEXT NOT NULL,
 request_id TEXT NOT NULL, occurred_at TEXT NOT NULL,
 payload_sha256 TEXT CHECK(payload_sha256 IS NULL OR length(payload_sha256)=64),
 rights_revision INTEGER CHECK(rights_revision IS NULL OR rights_revision>=1),
 UNIQUE(actor_id,request_id)
);
CREATE INDEX dg_versions_work ON dg_resource_versions(work_id);
CREATE INDEX dg_versions_batch ON dg_resource_versions(batch_id);
CREATE INDEX dg_fragments_version ON dg_resource_fragments(version_id,kind,ordinal);
CREATE INDEX dg_audit_resource ON dg_resource_audit(resource_id,occurred_at);
