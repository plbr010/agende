import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import * as redirects from "./redirects";
import {postConfirmationPath} from "./signup-journey";

function callback(failSession=false,exchangeError: string|null=null){
 const calls:string[]=[],exports:Record<string,(request:Request)=>Promise<Response>>={};
 const dependencies:Record<string,unknown>={
  "next/server":{NextResponse:{redirect:(url:string)=>new Response(null,{status:307,headers:{location:url}})}},
  "@/lib/supabase/server":{createClient:async()=>({auth:{exchangeCodeForSession:async()=>{calls.push("exchange");return {error:exchangeError?{code:exchangeError}:null};}}})},
  "@/lib/auth/actions":{getPendingJourney:async()=>"client",clearPendingJourney:async()=>{calls.push("clear_pending");}},
  "@/lib/auth/redirects":redirects,"@/lib/auth/signup-journey":{postConfirmationPath},
  "@/lib/auth/session":{loadAppSession:async()=>{calls.push("session");if(failSession)throw Error("private provider details");return {context:{emailConfirmed:true,intendedUse:"client",hasClientProfile:true,hasWorkspace:false}};}},
 };
 runInNewContext(ts.transpileModule(readFileSync("src/app/auth/callback/route.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,URL,console:{error:(name:string)=>calls.push(name)},require:(name:string)=>dependencies[name]});
 return {get:()=>exports.GET(new Request("https://agende.test/auth/callback?code=owned-test")),calls};
}
test("successful confirmation preserves client onboarding and clears pending journey",async()=>{
 const h=callback(),response=await h.get();assert.equal(response.headers.get("location"),"https://agende.test/cliente/perfil?inicio=1");assert.ok(h.calls.includes("clear_pending"));
});
test("session read failure after exchange redirects to recoverable view without leaking or clearing pending journey",async()=>{
 const h=callback(true),response=await h.get();assert.equal(response.headers.get("location"),"https://agende.test/verificar-email?status=session_unavailable");assert.ok(!h.calls.includes("clear_pending"));assert.ok(h.calls.includes("auth_session_after_confirmation_unavailable"));assert.ok(!JSON.stringify(h.calls).includes("private provider details"));
});
test("PKCE verifier failure still refuses the browser before loading a session",async()=>{
 const h=callback(false,"pkce_code_verifier_not_found"),response=await h.get();assert.equal(response.headers.get("location"),"https://agende.test/verificar-email?status=browser_mismatch");assert.deepEqual(h.calls,["exchange"]);
});
test("public recovery view avoids repeating the failed read and offers login without claiming confirmation",async()=>{
 let sessionReads=0;
 const exports:Record<string,(props:unknown)=>Promise<unknown>>={};
 const dependencies:Record<string,unknown>={
  "react/jsx-runtime":{jsx:(type:unknown,props:unknown)=>({type,props}),jsxs:(type:unknown,props:unknown)=>({type,props})},
  "@/lib/auth/session":{loadAppSession:async()=>{sessionReads++;throw Error("private unavailable session");}},
  "@/lib/auth/actions":{getPendingEmail:async()=>null,getPendingNext:async()=>null,getPendingIntent:async()=>"client",getPendingJourney:async()=>"client"},
  "@/lib/auth/redirects":redirects,"next/navigation":{redirect:()=>{throw Error("unexpected redirect");}},
 };
 runInNewContext(ts.transpileModule(readFileSync("src/app/(auth)/verificar-email/page.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:(name:string)=>dependencies[name]??{}});
 const result=await exports.default({searchParams:Promise.resolve({status:"session_unavailable"})});
 assert.equal(sessionReads,0);assert.ok(JSON.stringify(result).includes('"href":"/login"'));assert.ok(!JSON.stringify(result).includes("E-mail confirmado"));
});
