import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import * as config from "../../lib/booking/config";
import * as validation from "../../lib/booking/validation";

type Node = {props?: Record<string, unknown>};
function harness(slotsFailure = false) {
 const hooks: unknown[] = [], effects: (() => unknown)[] = []; let index=0,work: Promise<unknown>|undefined,calls=0;
 const noop=()=>null;
 const react={
  useState:(initial: unknown)=>{const i=index++;if(!(i in hooks))hooks[i]=typeof initial==="function"?(initial as ()=>unknown)():initial;return [hooks[i],(value: unknown)=>{hooks[i]=typeof value==="function"?(value as (old:unknown)=>unknown)(hooks[i]):value;}];},
  useRef:(value:unknown)=>{const i=index++;if(!(i in hooks))hooks[i]={current:value};return hooks[i];},
  useMemo:(fn:()=>unknown)=>fn(),
  useEffect:(fn:()=>unknown,deps:unknown[])=>{const i=index++;const old=hooks[i] as unknown[]|undefined;if(!old||deps.some((v,n)=>v!==old[n])){hooks[i]=deps;effects.push(fn);}},
  useTransition:()=>[false,(fn:()=>Promise<unknown>)=>{work=fn();}],
 };
 const exports: Record<string, (props:unknown)=>Node> = {};
 const dependencies: Record<string,unknown>={
  react,"react/jsx-runtime":{jsx:(type:unknown,props:unknown)=>({type,props}),jsxs:(type:unknown,props:unknown)=>({type,props})},
  "@/lib/booking/config":config,"@/lib/booking/validation":validation,
  "@/lib/booking/actions":{createPublicAppointmentAction:async()=>{calls++;throw new Error("private provider/network details");},fetchPublicSlotsAction:async()=>{calls++;if(calls===1)throw new Error("network disconnected");return {slots:["2026-10-23T13:00:00Z"]};}},
  "@/lib/validation/money":{formatCentsToReais:()=>"R$ 50,00"},
 };
 const stub=new Proxy({},{get:()=>noop});
 runInNewContext(ts.transpileModule(readFileSync("src/components/booking/public-booking-flow.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:(name:string)=>dependencies[name]??stub});
 const id="11111111-1111-4111-8111-111111111111";
 const props={catalog:{slug:"owned",name:"Owned",timezone:"America/Sao_Paulo",horizonDays:90,minLeadMinutes:60,services:[{id,name:"Corte",priceCents:5000,durationMinutes:30}],professionals:[{id,displayName:"Ana",serviceIds:[id],offerings:[]}]},today:"2026-10-20",prefill:{fullName:"Maria Silva",phone:"+5532999991234",email:"test@example.invalid"},authenticated:true,initialDraft:{slug:"owned",serviceId:id,professionalMemberId:id,startsAt:"2026-10-23T13:00:00Z",localDate:"2026-10-23"},initialDraftSlotUnavailable:slotsFailure};
 return {render:()=>{index=0;return exports.PublicBookingFlow(props);},effects:()=>{for(const effect of effects.splice(0))effect();},done:()=>work,count:()=>calls};
}
function nodes(value:unknown):Node[]{if(!value||typeof value!=="object")return [];if(Array.isArray(value))return value.flatMap(nodes);const n=value as Node;return [n,...nodes(n.props?.children)];}
function click(tree:Node,label:string){const n=nodes(tree).find(n=>n.props?.children===label);assert.ok(n,label);(n.props!.onClick as ()=>void)();}

test("slot transport failure stays in the picker and explicit retry loads availability",async()=>{
 const h=harness(true);h.render();h.effects();await h.done();let tree=h.render();
 assert.ok(nodes(tree).some(n=>n.props?.children==="Não foi possível carregar os horários. Tente novamente."));
 click(tree,"Tentar carregar horários novamente");h.render();h.effects();await h.done();tree=h.render();
 assert.equal(h.count(),2);assert.ok(nodes(tree).some(n=>n.props?.onClick&&n.props?.children!=="Tentar carregar horários novamente"));
 assert.ok(!nodes(tree).some(n=>n.props?.children==="Não foi possível carregar os horários. Tente novamente."));
});

test("unknown confirmation outcome cannot show a receipt or dispatch a retry and links to history",async()=>{
 const h=harness();let tree=h.render();click(tree,"Reservar este horário");await h.done();tree=h.render();
 assert.ok(nodes(tree).some(n=>n.props?.href==="/cliente/agendamentos"));
 const confirm=nodes(tree).find(n=>n.props?.children==="Reservar este horário");assert.equal(confirm?.props?.disabled,true);
 const back=nodes(tree).find(n=>n.props?.children==="Voltar");assert.equal(back?.props?.disabled,true);
 assert.ok(!JSON.stringify(tree).includes("private provider/network details"));assert.ok(!JSON.stringify(tree).includes("Solicitação recebida"));
 click(tree,"Reservar este horário");assert.equal(h.count(),1);
 click(tree,"Voltar");assert.equal(h.count(),1);
});
