-- Apply only to a dedicated, reviewed feedback D1 binding; never infer legacy schema.
CREATE TABLE feedback (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
 category TEXT NOT NULL, page_path TEXT NOT NULL, created_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','rejected','syncing','sync_failed','published')),
 reviewed_by TEXT, reviewed_at TEXT, review_note TEXT,
 issue_number INTEGER, issue_url TEXT
);
CREATE INDEX feedback_status_created ON feedback(status, created_at);
CREATE TABLE feedback_rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL);
