import test from 'node:test';import assert from 'node:assert/strict';
import{isExpiredAccessRejection}from'./staging-auth-expiry-result.mjs';
test('natural expiry accepts GoTrue 403 bad_jwt and legacy 401 expired JWT responses',()=>{
 assert.equal(isExpiredAccessRejection(403,{code:403,error_code:'bad_jwt',msg:'invalid JWT: token is expired'}),true);
 assert.equal(isExpiredAccessRejection(401,{message:'JWT expired'}),true);
});
test('natural expiry refuses successful responses and unrelated authorization failures',()=>{
 assert.equal(isExpiredAccessRejection(200,{msg:'JWT expired'}),false);
 assert.equal(isExpiredAccessRejection(403,{error_code:'access_denied',msg:'token expired'}),false);
 assert.equal(isExpiredAccessRejection(403,{msg:'subscription expired'}),false);
 assert.equal(isExpiredAccessRejection(401,{error_code:'bad_jwt'}),false);
});
