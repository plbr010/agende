import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {exportEncryptedStorage,restoreEncryptedStorage} from './encrypted-storage-backup.mjs';

test('encrypted Storage round trip preserves bytes and private mapping, rejects tampering and wrong key',async t=>{
 const root=mkdtempSync(join(tmpdir(),'agende-storage-test-'));t.after(()=>rmSync(root,{recursive:true}));
 const key=randomBytes(32);t.after(()=>key.fill(0));
 const inventory={buckets:[{id:'private',public:false}],objects:[{bucket_id:'private',name:'../../never-a-local-path',metadata:{size:3}}]};
 const directory=join(root,'encrypted'),manifest=await exportEncryptedStorage({directory,key,inventory,download:async()=>Buffer.from('abc')});
 assert.ok(!readFileSync(join(directory,'index.enc')).includes(Buffer.from('never-a-local-path')));
 const result=restoreEncryptedStorage({directory,destination:join(root,'recovered'),key,manifest});
 assert.equal(result.all_object_bytes_recovered,true);assert.equal(result.storage_service_restored,false);
 assert.equal(readFileSync(join(root,'recovered','object-000000.bin'),'utf8'),'abc');
 assert.throws(()=>restoreEncryptedStorage({directory,destination:join(root,'wrong-key'),key:randomBytes(32),manifest}));
 const file=join(directory,manifest.objects[0].file),bytes=readFileSync(file);bytes[0]^=1;writeFileSync(file,bytes);
 assert.throws(()=>restoreEncryptedStorage({directory,destination:join(root,'tampered'),key,manifest}));
});
test('Storage export aborts when downloaded bytes differ from snapshot metadata',async t=>{
 const root=mkdtempSync(join(tmpdir(),'agende-storage-size-test-'));t.after(()=>rmSync(root,{recursive:true}));
 await assert.rejects(exportEncryptedStorage({directory:join(root,'encrypted'),key:randomBytes(32),inventory:{buckets:[],objects:[{metadata:{size:100}}]},download:async()=>Buffer.from('bad')}),/storage_size_changed/);
});
