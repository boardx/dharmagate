/** Reuses an injected, server-verified legacy session. Never accepts HTTP role claims. */
export function createIdentityBoundary({ readLegacySession, lookupMembership, clock = () => Date.now() }) {
  if (typeof readLegacySession !== 'function' || typeof lookupMembership !== 'function')
    throw new TypeError('Existing server session resolver and authoritative membership lookup required');
  const issued = new WeakSet();
  const anonymous = Object.freeze({ authenticated: false });
  const roles = new Set(['member', 'editor', 'reviewer']);
  return {
    async resolve(request, tenantId) {
      if (typeof tenantId !== 'string' || !tenantId) return anonymous;
      const session = await readLegacySession(request);
      const expires = Date.parse(session?.expires);
      if (!session?.user?.id || !Number.isFinite(expires) || expires <= clock()) return anonymous;
      const membership = await lookupMembership(session.user.id, tenantId);
      if (membership?.subjectId !== session.user.id || membership?.tenantId !== tenantId || !roles.has(membership?.role)) return anonymous;
      const principal = Object.freeze({ authenticated: true, subjectId: session.user.id, tenantId, role: membership.role, expires });
      issued.add(principal);
      return principal;
    },
    canReadPrivate(principal, resource) {
      return Boolean(principal && issued.has(principal) && principal.expires > clock() &&
        principal.tenantId === resource?.tenantId && principal.subjectId === resource?.ownerId);
    },
    canApprovePublication(principal, submission) {
      return Boolean(principal && issued.has(principal) && principal.expires > clock() &&
        principal.role === 'reviewer' && principal.tenantId === submission?.tenantId &&
        typeof submission?.submittedBy === 'string' && principal.subjectId !== submission.submittedBy);
    },
  };
}
