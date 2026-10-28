/** New-table-only D1 store. Does not migrate, connect itself, or read legacy users. */
export function createResourceAdminD1(db) {
  if(!db?.prepare||!db?.batch)throw new TypeError('D1_BINDING_REQUIRED');
  const list=async sql=>(await db.prepare(sql).all()).results;
  return {
    listVersions:()=>list('SELECT v.id,w.title,v.visibility FROM dg_resource_versions v JOIN dg_resource_works w ON w.id=v.work_id ORDER BY v.id LIMIT 50'),
    listBatches:()=>list('SELECT id,source_id AS sourceId,status FROM dg_ingest_batches ORDER BY created_at DESC LIMIT 50'),
    listChecks:()=>list('SELECT id,safe_summary AS safeSummary,result FROM dg_resource_checks ORDER BY checked_at DESC LIMIT 50'),
    listAudit:()=>list('SELECT id,resource_id AS resourceId,action FROM dg_resource_audit ORDER BY occurred_at DESC LIMIT 50'),
    async getVersion(id){
      const item=await db.prepare('SELECT v.id,w.title,v.visibility,s.source_url AS sourceUrl,v.content_version AS contentVersion,v.raw_sha256 AS rawSha256,v.normalized_sha256 AS normalizedSha256 FROM dg_resource_versions v JOIN dg_resource_works w ON w.id=v.work_id JOIN dg_resource_sources s ON s.id=v.source_id WHERE v.id=?').bind(id).first();
      if(!item)return null;
      const rights=await db.prepare('SELECT purpose,decision,revision FROM dg_resource_rights WHERE version_id=?').bind(id).all();
      return {...item,rights:Object.fromEntries(rights.results.map(r=>[r.purpose,r.decision])),rightsRevisions:Object.fromEntries(rights.results.map(r=>[r.purpose,r.revision]))};
    },
    async reviewRights(r){
      const op=crypto.randomUUID();
      const payload=JSON.stringify([r.versionId,r.purpose,r.decision,r.evidenceUrl]);
      const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload)))].map(x=>x.toString(16).padStart(2,'0')).join('');
      // D1 batch is transactional. Only the newly inserted audit ID can authorize
      // the matching right update; concurrent/repeated keys cannot mutate again.
      await db.batch([
        db.prepare("INSERT INTO dg_resource_audit(id,actor_id,action,resource_id,request_id,occurred_at,payload_sha256) SELECT ?,?,'rights-review',?,?,?,? WHERE EXISTS(SELECT 1 FROM dg_resource_versions WHERE id=?) ON CONFLICT(actor_id,request_id) DO NOTHING").bind(op,r.actorId,r.versionId,r.requestId,r.at,hash,r.versionId),
        db.prepare('INSERT INTO dg_resource_rights(version_id,purpose,decision,evidence_url,reviewer_id,reviewed_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM dg_resource_audit WHERE id=?) ON CONFLICT(version_id,purpose) DO UPDATE SET decision=excluded.decision,evidence_url=excluded.evidence_url,reviewer_id=excluded.reviewer_id,reviewed_at=excluded.reviewed_at,revision=dg_resource_rights.revision+1').bind(r.versionId,r.purpose,r.decision,r.evidenceUrl,r.actorId,r.at,op)
      ]);
      const saved=await db.prepare('SELECT id,payload_sha256 AS hash,resource_id AS resourceId,action FROM dg_resource_audit WHERE actor_id=? AND request_id=?').bind(r.actorId,r.requestId).first();
      if(!saved)return 'missing';
      if(saved.hash!==hash||saved.resourceId!==r.versionId||saved.action!=='rights-review')return 'conflict';
      return saved.id===op?'reviewed':'already-reviewed';
    }
  };
}
