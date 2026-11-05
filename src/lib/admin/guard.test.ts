import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import {getDefaultDestination} from "../auth/redirects";
import {isOfficialMasterAdminEmail} from "./bootstrap";

test("guard rejects changed identity, stale flags, revoked grants and provider failures without self-provisioning",async()=>{
 for(const scenario of ["active","changed-email","revoked","unconfirmed","rpc-outage","auth-outage","different-id","anonymous"]) {
  const exports: Record<string,(path:string,options:unknown)=>Promise<unknown>>={};
  const session={user:{id:"official",email:"plbrpc@gmail.com"},context:{emailConfirmed:true,intendedUse:"client",hasClientProfile:true,hasWorkspace:false,isPlatformAdmin:true,isOfficialPlatformOwner:true}};
  const user={id:scenario==="different-id"?"another":"official",email:scenario==="changed-email"?"changed@synthetic.invalid":"plbrpc@gmail.com",email_confirmed_at:scenario==="unconfirmed"?null:"2026-11-05"};
  const calls:string[]=[];
  const deps:Record<string,unknown>={
   "server-only":{},"next/navigation":{redirect:(path:string)=>{throw Error("redirect:"+path);}},
   "@/lib/auth/session":{loadAppSession:async()=>scenario==="anonymous"?null:session},
   "@/lib/auth/redirects":{getDefaultDestination},"./bootstrap":{isOfficialMasterAdminEmail},
   "@/lib/supabase/server":{createClient:async()=>({auth:{getUser:async()=>({data:{user},error:scenario==="auth-outage"?{}:null})},rpc:async(name:string)=>{calls.push(name);return {data:scenario!=="revoked",error:scenario==="rpc-outage"?{}:null};}})},
  };
  runInNewContext(ts.transpileModule(readFileSync("src/lib/admin/guard.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:(name:string)=>{if(!(name in deps))throw Error(name);return deps[name];}});
  if(scenario==="active") assert.equal((await exports.requirePlatformAdmin("/admin",{allowProvision:true}) as {provisionPending:boolean}).provisionPending,false);
  else await assert.rejects(exports.requirePlatformAdmin("/admin",{allowProvision:true}),error=>String(error).startsWith("Error: redirect:")&&!String(error).endsWith("redirect:/admin"));
  assert.ok(calls.every(name=>name==="is_platform_admin"));
 }
});
