/** Offline transform only. Never prints, returns separately or creates a secret. */
export function removeEmbeddedAuthFallback(source) {
  if (typeof source !== 'string') throw new TypeError('Source text required');
  let output = source;
  const seen = [];
  const removed = [];
  for (const environment of ['production', 'development']) {
    const pattern = new RegExp(`var ${environment} = (\\{[^\\n]*\\});`, 'g');
    const matches = [...output.matchAll(pattern)];
    if (matches.length !== 1) throw new Error('Unexpected environment configuration shape');
    const match = matches[0];
    const config = JSON.parse(match[1]);
    if (!Object.hasOwn(config, 'AUTH_SECRET') || typeof config.AUTH_SECRET !== 'string' || !config.AUTH_SECRET)
      throw new Error('Expected embedded authentication fallback is absent');
    removed.push(config.AUTH_SECRET);
    delete config.AUTH_SECRET;
    const replacement = `var ${environment} = ${JSON.stringify(config)};`;
    output = output.slice(0, match.index) + replacement + output.slice(match.index + match[0].length);
    seen.push(environment);
  }
  if (removed.some(value => output.includes(value)))
    throw new Error('Sensitive literal remains elsewhere; stop without emitting it');
  return { source: output, changedEnvironments: seen };
}
