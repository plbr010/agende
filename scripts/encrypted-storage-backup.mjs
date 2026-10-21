import assert from 'node:assert/strict';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join} from 'node:path';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function seal(directory,file,bytes,key){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from('storage/'+file));
 const encrypted=Buffer.concat([cipher.update(bytes),cipher.final()]);
 writeFileSync(join(directory,file),encrypted,{flag:'wx'});
 return {file,iv:iv.toString('hex'),tag:cipher.getAuthTag().toString('hex'),sha256:hash(encrypted),bytes:encrypted.length};
}
function open(directory,entry,key){
 assert.match(entry.file,/^(?:index|object-\d{6})\.enc$/);
 const encrypted=readFileSync(join(directory,entry.file));
 assert.equal(encrypted.length,entry.bytes);assert.equal(hash(encrypted),entry.sha256);
 const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(entry.iv,'hex'));
 decipher.setAAD(Buffer.from('storage/'+entry.file));decipher.setAuthTag(Buffer.from(entry.tag,'hex'));
 return Buffer.concat([decipher.update(encrypted),decipher.final()]);
}
// Caller owns/private-ACL protects both directories. No names become local paths.
export async function exportEncryptedStorage({directory,key,inventory,download}){
 assert.ok(!existsSync(directory));mkdirSync(directory);
 assert.ok(inventory.objects.length<1000000);
 const entries=[],index={buckets:inventory.buckets,objects:[]};
 for(const [i,object] of inventory.objects.entries()){
  const bytes=Buffer.from(await download(object));
  if(object.metadata?.size!==undefined)assert.equal(bytes.length,Number(object.metadata.size),'storage_size_changed');
  const entry=seal(directory,'object-'+String(i).padStart(6,'0')+'.enc',bytes,key);
  entries.push(entry);index.objects.push({object,file:entry.file,plaintext_sha256:hash(bytes),bytes:bytes.length});bytes.fill(0);
 }
 const encoded=Buffer.from(JSON.stringify(index));
 const indexEntry=seal(directory,'index.enc',encoded,key);encoded.fill(0);
 return {format:1,index:indexEntry,objects:entries,object_count:entries.length,bucket_count:inventory.buckets.length};
}
export function restoreEncryptedStorage({directory,destination,key,manifest}){
 assert.equal(manifest.format,1);assert.ok(!existsSync(destination));mkdirSync(destination);
 const encoded=open(directory,manifest.index,key);let index;
 try{index=JSON.parse(encoded.toString('utf8'));}finally{encoded.fill(0);}
 assert.equal(index.objects.length,manifest.object_count);assert.equal(manifest.objects.length,manifest.object_count);
 assert.equal(index.buckets.length,manifest.bucket_count);
 assert.equal(new Set(manifest.objects.map(e=>e.file)).size,manifest.object_count);
 for(const [i,item] of index.objects.entries()){
  const entry=manifest.objects[i];assert.equal(entry.file,item.file);
  const bytes=open(directory,entry,key);
  try{
   assert.equal(bytes.length,item.bytes);assert.equal(hash(bytes),item.plaintext_sha256);
   const destinationFile=join(destination,'object-'+String(i).padStart(6,'0')+'.bin');
   writeFileSync(destinationFile,bytes,{flag:'wx'});assert.equal(hash(readFileSync(destinationFile)),item.plaintext_sha256);
  }finally{bytes.fill(0);}
 }
 writeFileSync(join(destination,'inventory.json'),JSON.stringify(index),{flag:'wx'});
 return {passed:true,object_count:manifest.object_count,bucket_count:manifest.bucket_count,all_object_bytes_recovered:true,inventory_recovered:true,storage_service_restored:false};
}
