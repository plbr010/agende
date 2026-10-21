import assert from 'node:assert/strict';
export function homologationEvidence(name){
 const prefix=process.env.AGENDE_HOMOLOGATION_PREFIX??'final20';
 assert.match(prefix,/^[a-z][a-z0-9-]{0,30}$/);assert.match(name,/^[a-z0-9-]+[.]json$/);
 return `docs/homologation/${prefix}-${name}`;
}
