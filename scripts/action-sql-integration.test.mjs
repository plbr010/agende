import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { z } from 'zod';
import { createLocalDatabase } from './local-database.mjs';
import * as catalogValidation from '../src/lib/validation/catalog.ts';
import * as agendaValidation from '../src/lib/validation/agenda.ts';
import * as money from '../src/lib/validation/money.ts';
import * as phone from '../src/lib/validation/phone.ts';
import * as plans from '../src/lib/billing/plans.ts';
import * as redirects from '../src/lib/auth/redirects.ts';
import * as signup from '../src/lib/validation/signup.ts';
import * as email from '../src/lib/validation/email.ts';
import * as bookingValidation from '../src/lib/booking/validation.ts';
import * as reviewValidation from '../src/lib/reviews/validation.ts';
import * as mutationValidation from '../src/lib/modules/mutations.ts';
import * as agendaStatus from '../src/lib/agenda/status.ts';
import * as periodRules from '../src/lib/agenda/period-rules.ts';
import * as timezone from '../src/lib/time/timezone.ts';
import * as workspaceTimezone from '../src/lib/workspace/timezone.ts';

// Real server modules -> a synthetic Supabase transport -> real in-memory SQL.
// No browser, PostgREST, Auth server, SMTP or Stripe service is supplied here.
function moduleFrom(path, dependencies) {
  const { outputText } = ts.transpileModule(readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  runInNewContext(outputText, { exports, URL, FormData, Set, Map, process: { env: { NODE_ENV: 'test' } },
    require(name) { if (name in dependencies) return dependencies[name]; throw new Error('Unexpected dependency ' + name); } });
  return exports;
}
const form = values => { const f = new FormData(); for (const [key,value] of Object.entries(values)) f.set(key,String(value)); return f; };
const identifier = value => { assert.match(value, /^[a-z_]+$/); return '"' + value + '"'; };

test('server actions and SQL integrate workspace, catalog, booking, finance, stock, packages and reviews', async t => {
  const db = await createLocalDatabase(); t.after(() => db.close());
  await db.exec(readFileSync('supabase/tests/helpers.sql','utf8'));
  const user = async (email,intent='professional') => (await db.query('select test_helpers.create_auth_user($1,$2,true) id',[email,intent])).rows[0].id;
  const owner = await user('owner@action-sql.invalid');
  const customer = await user('client@action-sql.invalid','client');
  const other = await user('other@action-sql.invalid');
  let actor = owner, workspaceId, memberId, serviceId, appointmentId, localDate, clientId;
  const execute = (sql, args=[]) => db.transaction(async tx => {
    if (actor) await tx.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role','authenticated',true)",[actor]);
    await tx.exec(actor ? 'set local role authenticated' : 'set local role anon');
    return tx.query(sql,args);
  });
  const client = {
    auth: { getUser: async () => ({ data: { user: actor ? { id:actor,email:actor===customer?'client@action-sql.invalid':'owner@action-sql.invalid',email_confirmed_at:'2026-10-01' } : null } }) },
    async rpc(name,args={}) {
      try {
        const keys = Object.keys(args);
        const values = keys.map(key => key==='p_items'?JSON.stringify(args[key]):args[key]);
        const tableResult=['list_public_available_slots','list_my_reschedule_slots'].includes(name);
        const call=`public.${identifier(name)}(${keys.map((key,index)=>identifier(key)+' => $'+(index+1)).join(',')})`;
        const result = await execute(tableResult?`select * from ${call}`:`select ${call} result`,values);
        return { data:JSON.parse(JSON.stringify(tableResult?result.rows:result.rows[0]?.result??null)), error:null };
      } catch(error) { return { data:null,error:{ message:error.message,code:error.code } }; }
    },
    from(table) {
      assert.ok(['professional_profiles','workspace_members','professional_working_hours','professional_breaks','appointments','appointment_reviews'].includes(table));
      const state={ fields:'*',filters:[],patch:null,insert:null,order:null };
      const query={ select(fields) { state.fields=fields; return this; },eq(key,value) { state.filters.push([key,value]); return this; },
        order(key,{ascending}) { state.order=[key,ascending]; return this; }, update(patch) { state.patch=patch; return this; },insert(payload) { state.insert=payload; return this; },
        async run(single=false) {
          try {
            const args=[],bind=value=>{args.push(value);return '$'+args.length;};
            const where=()=>state.filters.length?' where '+state.filters.map(([key,value])=>identifier(key)+'='+bind(value)).join(' and '):'';
            let sql;
            if(state.insert) sql=`insert into public.${identifier(table)}(${Object.keys(state.insert).map(identifier).join(',')}) values(${Object.values(state.insert).map(bind).join(',')}) returning *`;
            else if(state.patch) sql=`update public.${identifier(table)} set ${Object.entries(state.patch).map(([key,value])=>identifier(key)+'='+bind(value)).join(',')}${where()} returning *`;
            else sql=`select ${state.fields==='*'?'*':state.fields.split(',').map(key=>identifier(key.trim())).join(',')} from public.${identifier(table)}${where()}${state.order?' order by '+identifier(state.order[0])+(state.order[1]?' asc':' desc'):''}`;
            const result=await execute(sql,args);return { data:single?result.rows[0]??null:result.rows,error:null };
          } catch(error) { return { data:null,error:{message:error.message,code:error.code} }; }
        },maybeSingle() { return this.run(true); },single() { return this.run(true); },then(resolve,reject) { return this.run().then(resolve,reject); },
      };return query;
    },
  };
  const dependencies={
    'next/cache':{revalidatePath(){}}, 'next/navigation':{redirect:path=>{throw new Error('redirect:'+path);}},
    'next/headers':{cookies:async()=>({get(){},set(){}})}, zod:{z},
    '@/lib/supabase/server':{createClient:async()=>client}, '@/lib/billing/plans':plans,
    '@/lib/auth/redirects':redirects, '@/lib/auth/session':{loadAppSession:async()=>null,requireConfirmedSession:async()=>({user:{id:actor},workspaces:[{id:workspaceId,role:actor===owner?'owner':'professional'}]})},
    '@/lib/http/origin':{getRequestOrigin:async()=>'http://127.0.0.1:3000'}, '@/lib/validation/email':email,'@/lib/validation/signup':signup,
    '@/lib/validation/catalog':catalogValidation,'@/lib/validation/money':money,'@/lib/validation/phone':phone,
    '@/lib/validation/agenda':agendaValidation,'@/lib/agenda/status':agendaStatus,'@/lib/agenda/period-rules':periodRules,'@/lib/time/timezone':timezone,
    '@/lib/workspace/queries':{loadWorkspaceSettings:async()=>({timezone:'America/Sao_Paulo'})},
    '@/lib/workspace/public':{publicLogoUrl:()=>null}, '@/lib/workspace/timezone':workspaceTimezone,
    '@/lib/booking/ip':{hashClientIp:async()=>'local-fixture-only'}, '@/lib/booking/validation':bookingValidation,
    '@/lib/reviews/validation':reviewValidation,'./mutations':mutationValidation,
  };
  const load=path=>moduleFrom(path,dependencies);
  dependencies['@/lib/catalog/queries']=load('src/lib/catalog/queries.ts');
  dependencies['@/lib/agenda/queries']=load('src/lib/agenda/queries.ts');
  const auth=load('src/lib/auth/actions.ts');
  const catalog=load('src/lib/catalog/actions.ts');
  const agenda=load('src/lib/agenda/actions.ts');
  const queries=load('src/lib/booking/queries.ts');dependencies['@/lib/booking/queries']=queries;
  const booking=load('src/lib/booking/actions.ts');
  const reviewQueries=load('src/lib/reviews/queries.ts');dependencies['@/lib/reviews/queries']=reviewQueries;
  const review=load('src/lib/reviews/actions.ts');
  const management=load('src/lib/modules/actions.ts');

  await t.test('workspace create action starts one trial and respects Cursor setup redirect',async()=>{
    await assert.rejects(auth.createWorkspaceAction({},form({name:'Action SQL Studio',plan:'equipe'})),/redirect:\/app\?setup=1/);
    workspaceId=(await db.query('select id from public.workspaces where owner_user_id=$1',[owner])).rows[0].id;
    memberId=(await db.query('select id from public.workspace_members where workspace_id=$1 and user_id=$2',[workspaceId,owner])).rows[0].id;
    assert.equal((await db.query('select status from public.subscriptions where workspace_id=$1',[workspaceId])).rows[0].status,'trialing');
  });
  await t.test('profile, service and availability actions persist a bookable catalog',async()=>{
    assert.ok((await catalog.saveProfessionalProfileAction({},form({memberId,displayName:'Profissional Local',bio:'',manageBooking:'on',bookingEnabled:'on'}))).success);
    assert.ok((await catalog.saveServiceAction({},form({name:'Corte',description:'',durationMinutes:'30',priceReais:'50,00',active:'on',professionalMemberIds:memberId}))).success);
    serviceId=(await db.query('select id from public.services where workspace_id=$1',[workspaceId])).rows[0].id;
    localDate=(await db.query("select ((now() at time zone 'America/Sao_Paulo')::date+3)::text d")).rows[0].d;
    const weekday=(await db.query('select extract(dow from $1::date)::int d',[localDate])).rows[0].d;
    assert.ok((await agenda.addWorkingHourAction({},form({memberId,weekday,startTime:'08:00',endTime:'18:00'}))).success);
    actor=null;
    const data=await booking.loadCatalogAction((await db.query('select slug from public.workspaces where id=$1',[workspaceId])).rows[0].slug);
    assert.equal(data.services[0].priceCents,5000);assert.equal(data.professionals[0].id,memberId);
  });
  await t.test('public actions book an actual slot and reject overlapping requests',async()=>{
    const slug=(await db.query('select slug from public.workspaces where id=$1',[workspaceId])).rows[0].slug;
    const slots=await booking.fetchPublicSlotsAction({slug,serviceId,professionalMemberId:memberId,localDate});assert.ok(slots.slots.length);
    const request={slug,serviceId,professionalMemberId:memberId,startsAt:slots.slots[2],fullName:'Client Local',phone:'55999999999',email:'client@action-sql.invalid',customerNote:null};
    const result=await booking.createPublicAppointmentAction(request);assert.ok(result.confirmation,result.error);
    appointmentId=(await db.query('select id,client_id from public.appointments where workspace_id=$1',[workspaceId])).rows[0].id;
    clientId=(await db.query('select client_id from public.appointments where id=$1',[appointmentId])).rows[0].client_id;
    assert.ok((await booking.createPublicAppointmentAction(request)).error);
  });
  await t.test('client rescheduling preserves appointment ID and denies another client',async()=>{
    actor=customer;
    const slots=await booking.fetchMyRescheduleSlots({appointmentId,professionalMemberId:memberId,localDate});assert.ok(slots.slots.length,slots.error);
    const result=await booking.rescheduleMyAppointmentAction({appointmentId,professionalMemberId:memberId,startsAt:slots.slots.at(-2)});
    assert.ok(result.appointments,result.error);assert.ok(result.appointments.some(row=>row.id===appointmentId));
    actor=other;assert.ok((await booking.cancelMyAppointmentAction(appointmentId)).error);
  });
  await t.test('completed appointment receives exactly one immutable client review',async()=>{
    actor=owner;
    for(const status of ['confirmed','in_progress','completed']) assert.ok((await agenda.setAppointmentStatusAction(form({appointmentId,status}))).success);
    actor=customer;
    const result=await review.submitReview({appointmentId,rating:5,comment:'Bom atendimento'});assert.equal(result.reviews?.[0]?.rating,5,result.error);
    assert.ok((await review.submitReview({appointmentId,rating:4,comment:''})).error);
  });
  await t.test('client cancellation action frees a second booked slot',async()=>{
    actor=null;
    const slug=(await db.query('select slug from public.workspaces where id=$1',[workspaceId])).rows[0].slug;
    const slots=await booking.fetchPublicSlotsAction({slug,serviceId,professionalMemberId:memberId,localDate});
    const result=await booking.createPublicAppointmentAction({slug,serviceId,professionalMemberId:memberId,startsAt:slots.slots[2],fullName:'Client Local',phone:'55999999999',email:'client@action-sql.invalid',customerNote:null});
    assert.ok(result.confirmation,result.error);
    const second=(await db.query("select id from public.appointments where workspace_id=$1 and status='scheduled'",[workspaceId])).rows[0].id;
    actor=customer;assert.ok((await booking.cancelMyAppointmentAction(second)).success);
    assert.equal((await db.query('select status from public.appointments where id=$1',[second])).rows[0].status,'cancelled');
  });
  await t.test('finance actions register a local payment and finance RPC reflects it',async()=>{
    actor=owner;
    const key='11111111-1111-4111-8111-111111111111';
    const request=form({action:'finance-create',kind:'income',description:'Action local income',amount:'50,00',due:localDate,category:'',key});
    assert.ok((await management.managementAction({},request)).success);assert.ok((await management.managementAction({},request)).success);
    const entry=(await db.query('select id from public.financial_entries where workspace_id=$1 and idempotency_key=$2',[workspaceId,key])).rows[0].id;
    assert.ok((await management.managementAction({},form({action:'finance-paid',id:entry,method:'pix'}))).success);
    const paidDay=(await db.query("select (now() at time zone 'America/Sao_Paulo')::date::text d")).rows[0].d;
    const result=await client.rpc('get_finance_ui',{p_workspace_id:workspaceId,p_start_date:paidDay,p_end_date:localDate});assert.ok(result.data.entries.some(row=>row.id===entry&&row.status==='paid'));
  });
  await t.test('stock and package actions persist their business operations',async()=>{
    assert.ok((await management.managementAction({},form({action:'product-create',name:'Shampoo',description:'',sku:'',unit:'unidade',minimum:'1',cost:'10,00',quantity:'5'}))).success);
    const product=(await db.query('select id from public.inventory_products where workspace_id=$1',[workspaceId])).rows[0].id;
    assert.ok((await management.managementAction({},form({action:'movement',id:product,type:'exit',quantity:'2',reason:'Consumo local'}))).success);
    assert.equal((await client.rpc('get_inventory_ui',{p_workspace_id:workspaceId})).data.products[0].quantity,3);
    const data=form({action:'package-create',name:'Pacote Local',description:'',amount:'100,00',validity:'30',service:serviceId,['sessions-'+serviceId]:'2'});
    assert.ok((await management.managementAction({},data)).success);
    const pack=(await db.query('select id from public.service_packages where workspace_id=$1',[workspaceId])).rows[0].id;
    assert.ok((await management.managementAction({},form({action:'package-sell',id:pack,client:clientId}))).success);
    assert.equal((await client.rpc('get_packages_ui',{p_workspace_id:workspaceId})).data.sales[0].included_total,2);
  });
});
