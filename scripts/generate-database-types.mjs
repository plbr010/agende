import { writeFileSync } from 'node:fs';
import { createLocalDatabase } from './local-database.mjs';
const db=await createLocalDatabase();
try {
 const enums=(await db.query(`select t.typname, array_agg(e.enumlabel order by e.enumsortorder) as labels from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_enum e on e.enumtypid=t.oid where n.nspname='public' group by t.typname`)).rows;
 const enumNames=new Set(enums.map(e=>e.typname));
 function type(name) {
   if (enumNames.has(name)) return `Database["public"]["Enums"]["${name}"]`;
   if(name.startsWith('_')) return `(${type(name.slice(1))})[]`;
   if(['int2','int4','int8','float4','float8','numeric','oid'].includes(name)) return 'number';
   if(name==='bool') return 'boolean';
   if(['json','jsonb'].includes(name)) return 'Json';
   if(name==='void') return 'undefined';
   return 'string';
 }
 const relationships=(await db.query(`select c.relname as table_name, k.conname as foreign_key_name, r.relname as referenced_relation,
 array(select a.attname from unnest(k.conkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.conrelid and a.attnum=x.num order by x.ord) as columns,
 array(select a.attname from unnest(k.confkey) with ordinality x(num,ord) join pg_attribute a on a.attrelid=k.confrelid and a.attnum=x.num order by x.ord) as referenced_columns,
 exists(select 1 from pg_constraint u where u.conrelid=k.conrelid and u.contype in ('p','u') and u.conkey @> k.conkey and k.conkey @> u.conkey) as one_to_one
 from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace join pg_class r on r.oid=k.confrelid join pg_namespace rn on rn.oid=r.relnamespace
 where k.contype='f' and n.nspname='public' and rn.nspname='public' order by c.relname,k.conname`)).rows;
 const columns=(await db.query(`select c.table_name,c.column_name,c.is_nullable,c.column_default,c.is_identity,c.udt_name from information_schema.columns c join information_schema.tables t on t.table_schema=c.table_schema and t.table_name=c.table_name where c.table_schema='public' and t.table_type='BASE TABLE' order by c.table_name,c.ordinal_position`)).rows;
 let out='// Generated from repository migrations in local PostgreSQL. Run: node scripts/generate-database-types.mjs\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\n\nexport type Database = {\n  public: {\n    Tables: {\n';
 for(const table of [...new Set(columns.map(c=>c.table_name))]) {
   const cols=columns.filter(c=>c.table_name===table);
   out+=`      ${table}: {\n`;
   for(const mode of ['Row','Insert','Update']) {
     out+=`        ${mode}: {\n`;
     for(const c of cols) {
       const optional=mode==='Update'||(mode==='Insert'&&(c.is_nullable==='YES'||c.column_default!==null||c.is_identity==='YES'));
       out+=`          ${c.column_name}${optional?'?':''}: ${type(c.udt_name)}${c.is_nullable==='YES'?' | null':''};\n`;
     }
     out+='        };\n';
   }
   out+='        Relationships: [\n';
   for (const r of relationships.filter(r=>r.table_name===table)) out+=`          { foreignKeyName: ${JSON.stringify(r.foreign_key_name)}; columns: ${JSON.stringify(r.columns)}; isOneToOne: ${r.one_to_one}; referencedRelation: ${JSON.stringify(r.referenced_relation)}; referencedColumns: ${JSON.stringify(r.referenced_columns)} },\n`;
   out+='        ];\n      };\n';
 }
 out+='    };\n    Views: { [_ in never]: never };\n    Functions: {\n';
 const funcs=(await db.query(`select p.oid,p.proname,p.proargnames,p.proargmodes,p.pronargdefaults,p.proretset,t.typname as return_type, array(select pt.typname from unnest(coalesce(p.proallargtypes,p.proargtypes::oid[])) with ordinality a(oid,ord) join pg_type pt on pt.oid=a.oid order by a.ord) as arg_types from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_type t on t.oid=p.prorettype where n.nspname='public' and p.prokind='f' order by p.proname,p.oid`)).rows;
 const names=new Set();
 for(const f of funcs) {
   if(names.has(f.proname)) throw Error('Ambiguous overload: '+f.proname);
   names.add(f.proname);
   const input=f.arg_types.map((t,i)=>({t,i})).filter(({i})=>!f.proargmodes||['i','b','v'].includes(f.proargmodes[i]));
   const output=f.arg_types.map((t,i)=>({t,i})).filter(({i})=>f.proargmodes&&['o','b','t'].includes(f.proargmodes[i]));
   const args=input.map(({t,i},index)=>`${f.proargnames[i]}${index>=input.length-f.pronargdefaults?'?':''}: ${type(t)} | null`).join('; ');
   let returns=output.length ? '{ '+output.map(({t,i})=>`${f.proargnames[i]}: ${type(t)}`).join('; ')+' }' : type(f.return_type);
   if(f.proretset) returns+='[]';
   out+=`      ${f.proname}: { Args: ${input.length?'{ '+args+' }':'Record<PropertyKey, never>'}; Returns: ${returns} };\n`;
 }
 out+='    };\n    Enums: {\n';
 for(const e of enums) out+=`      ${e.typname}: ${e.labels.map(v=>JSON.stringify(v)).join(' | ')};\n`;
 out+='    };\n    CompositeTypes: { [_ in never]: never };\n  };\n};\n';
 writeFileSync('src/lib/supabase/database.types.ts',out);
 console.log('Generated public schema from local migrations: '+new Set(columns.map(c=>c.table_name)).size+' tables, '+funcs.length+' functions, '+enums.length+' enums.');
} finally { await db.close(); }
