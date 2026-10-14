import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as validation from "./validation";
import * as timezone from "../time/timezone";
import * as workspaceTimezone from "../workspace/timezone";

const id="11111111-1111-4111-8111-111111111111";
const row={id,workspace_name:"Salão sintético",slug:"local-test",service_name:"Corte",professional_name:"Pessoa",starts_at:"2026-10-20T12:00:00Z",ends_at:"2026-10-20T12:30:00Z"};
function harness(data: unknown, readError=false) {
  let mutations=0;
  const paths:string[]=[];
  const dependencies:Record<string,unknown>={
    "@/lib/supabase/server":{createClient:async()=>({rpc:async(name:string)=>{
      if(name==="reschedule_my_appointment"){mutations++;return {data:null,error:null};}
      assert.equal(name,"list_my_appointments");
      return {data,error:readError?{message:"synthetic transport failure"}:null};
    }})},
    "@/lib/workspace/public":{publicLogoUrl:()=>null},
    "@/lib/time/timezone":timezone,
    "@/lib/workspace/timezone":workspaceTimezone,
    "@/lib/booking/validation":validation,
    "@/lib/booking/ip":{hashClientIp:async()=>null},
    "next/cache":{revalidatePath:(path:string)=>paths.push(path)},
    "next/headers":{cookies:async()=>({delete(){}})},
    "./draft":{BOOKING_DRAFT_COOKIE:"agende_booking_draft"},
    zod:{z},
  };
  function load(file:string){
    const source=readFileSync(new URL(file,import.meta.url),"utf8");
    const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}});
    const exports:Record<string,(...args:unknown[])=>Promise<unknown>>={};
    runInNewContext(outputText,{exports,require:(name:string)=>{assert.ok(name in dependencies,name);return dependencies[name];}});
    return exports;
  }
  const queries=load("./queries.ts");dependencies["@/lib/booking/queries"]=queries;
  const actions=load("./actions.ts");
  return {queries,actions,paths,mutations:()=>mutations};
}
test("a committed reschedule followed by a failed reload never replaces the list with empty success",async()=>{
  const h=harness(null,true);
  const result=await h.actions.rescheduleMyAppointmentAction({appointmentId:id,professionalMemberId:id,startsAt:row.starts_at}) as {error?:string;appointments?:unknown[]};
  assert.equal(h.mutations(),1);
  assert.equal(result.appointments,undefined);
  assert.match(result.error??"",/Reagendamento salvo/);
  assert.ok(h.paths.includes("/cliente/agendamentos"));
});
test("malformed appointment read models produce an error instead of silently losing rows",async()=>{
  for(const data of [null,{},[row,{}]]){
    const h=harness(data);
    const result=await h.queries.loadMyAppointmentsResult() as {error:string|null};
    assert.ok(result.error);
  }
});
test("valid empty and populated lists remain successful after strict read validation",async()=>{
  for(const data of [[],[row]]){
    const result=await harness(data).queries.loadMyAppointmentsResult() as {error:string|null;appointments:unknown[]};
    assert.equal(result.error,null);assert.equal(result.appointments.length,data.length);
  }
});
