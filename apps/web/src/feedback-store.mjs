/** A dedicated FEEDBACK_DB D1 database; no dependency on the legacy schema. */
export function createFeedbackStore(db) {
 const run=(sql,...args)=>db.prepare(sql).bind(...args).run();
 return {
  async allow(bucket) {
   await run('DELETE FROM feedback_rate_limits WHERE bucket < ?', bucket.slice(0,13));
   const r=await db.prepare('INSERT INTO feedback_rate_limits(bucket,count) VALUES (?,1) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket).first();
   return r.count<=5;
  },
  insert: r=>run('INSERT INTO feedback(id,title,description,category,page_path,created_at) VALUES (?,?,?,?,?,?)',r.id,r.title,r.description,r.category,r.page_path,r.created_at),
  get: id=>db.prepare('SELECT * FROM feedback WHERE id=?').bind(id).first(),
  async list(status,offset) {return (await db.prepare('SELECT * FROM feedback WHERE (? IS NULL OR status=?) ORDER BY created_at DESC,id DESC LIMIT 51 OFFSET ?').bind(status,status,offset).all()).results;},
  async claim(id,actor) {return (await run("UPDATE feedback SET status='syncing',reviewed_by=?,reviewed_at=? WHERE id=? AND status IN ('pending','sync_failed')",actor,new Date().toISOString(),id)).meta.changes===1;},
  async reject(id,actor,note) {return (await run("UPDATE feedback SET status='rejected',reviewed_by=?,reviewed_at=?,review_note=? WHERE id=? AND status='pending'",actor,new Date().toISOString(),note,id)).meta.changes===1;},
  failed: id=>run("UPDATE feedback SET status='sync_failed' WHERE id=? AND status='syncing'",id),
  published:(id,issue)=>run("UPDATE feedback SET status='published',issue_number=?,issue_url=? WHERE id=? AND status='syncing'",issue.number,issue.html_url,id),
 };
}
