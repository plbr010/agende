// GoTrue can reject an expired JWT with 403 bad_jwt as well as legacy 401.
// A generic forbidden response must never count as natural-expiry evidence.
export function isExpiredAccessRejection(status,body){
 if(![401,403].includes(status)||!body||typeof body!=='object')return false;
 const code=body.error_code??body.code;
 if(typeof code==='string'&&!['bad_jwt','jwt_expired'].includes(code))return false;
 const message=String(body.msg??body.message??body.error_description??'');
 return /\b(jwt|token)\b.*\bexpired\b|\bexpired\b.*\b(jwt|token)\b/i.test(message);
}
