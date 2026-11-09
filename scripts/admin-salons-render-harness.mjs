// Test-only renderer of the actual server component; no fixture is imported by the application.
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
const require=createRequire(import.meta.url);
export async function renderSalonDirectory(data, params={}, fail=false) {
 const cache=new Map();
 function load(path) {
  const filename=['.tsx','.ts',''].map(ext=>path+ext).find(existsSync);
  if(!filename)throw Error('module missing: '+path);
  if(cache.has(filename))return cache.get(filename);
  const compiledModule={exports:{}};cache.set(filename,compiledModule.exports);
  const localRequire=name=>{
   if(name==='@/lib/admin/queries')return {asString:v=>typeof v==='string'&&v?v:null,loadAdminSalonOverview:async()=>{if(fail)throw Error('synthetic outage');return data;}};
   if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
   if(name.startsWith('@/'))return load(resolve('src',name.slice(2)));
   if(name.startsWith('.'))return load(resolve(dirname(filename),name));
   return require(name);
  };
  const compiled=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
  new Function('require','module','exports',compiled)(localRequire,compiledModule,compiledModule.exports);
  cache.set(filename,compiledModule.exports);return compiledModule.exports;
 }
 const {SalonDirectory}=load(resolve('src/components/admin/salon-directory'));
 return renderToStaticMarkup(await SalonDirectory({path:'/admin',params,overview:true}));
}
