import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as mutations from "./mutations";

function actionFor(role: string) {
  const calls: Array<{name:string;args:Record<string,unknown>}> = [];
  const paths: string[] = [];
  const exports: {managementAction?: (previous: object, form: FormData) => Promise<{error?:string;success?:string}>} = {};
  const source=readFileSync(new URL("./actions.ts",import.meta.url),"utf8");
  const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}});
  runInNewContext(outputText,{exports,require(name:string){
    if(name === "./mutations") return mutations;
    if(name === "next/cache") return {revalidatePath:(path:string)=>paths.push(path)};
    if(name === "@/lib/auth/session") return {requireConfirmedSession:async()=>({workspaces:[{id:"session-workspace",role}]})};
    if(name === "@/lib/supabase/server") return {createClient:async()=>({rpc:async(name:string,args:Record<string,unknown>)=>{calls.push({name,args});return {data:"saved",error:null};}})};
    throw Error(name);
  }});
  assert.ok(exports.managementAction);
  return {run:exports.managementAction,calls,paths};
}
function form(values: Record<string,string>) {const data=new FormData();for(const [key,value] of Object.entries(values))data.set(key,value);return data;}
const id="10000000-0000-4000-8000-000000000001";
test("server actions refuse professional/receptionist even if the outer guard is bypassed",async()=>{
  for(const role of ["professional","receptionist"]) {
    const action=actionFor(role);
    assert.ok((await action.run({},form({action:"trial",plan:"equipe"}))).error);
    assert.equal(action.calls.length,0);
  }
});
test("server actions derive tenant from session and call the real RPC contract",async()=>{
  for(const [input,rpc] of [
    [{action:"trial",plan:"salao"},"change_trial_plan"],
    [{action:"movement",id,type:"adjustment",quantity:"0",reason:"Contagem"},"apply_inventory_movement"],
    [{action:"product-archive",id},"archive_inventory_product"],
    [{action:"product-reactivate",id},"reactivate_inventory_product"],
    [{action:"package-sell",id,client:id},"sell_service_package"],
    [{action:"package-cancel",id},"cancel_client_package"],
    [{action:"finance-paid",id,method:"pix"},"mark_financial_entry_paid"],
    [{action:"finance-cancel",id},"cancel_financial_entry"],
    [{action:"finance-reopen",id},"reopen_financial_entry"],
  ] as Array<[Record<string,string>,string]>) {
    const action=actionFor("owner");
    const result=await action.run({},form({...input,workspaceId:"attacker-workspace"}));
    assert.ok(result.success);
    assert.equal(action.calls[0].name,rpc);
    assert.equal(action.calls[0].args.p_workspace_id,"session-workspace");
    if(input.action === "movement") { assert.equal(action.calls[0].args.p_new_quantity,0);assert.equal(action.calls[0].args.p_quantity,undefined); }
    assert.ok(action.paths.includes("/app/relatorios"));
  }
});
test("invalid form input never reaches the database",async()=>{
  const action=actionFor("owner");
  assert.ok((await action.run({},form({action:"trial",plan:"enterprise"}))).error);
  assert.equal(action.calls.length,0);
});
