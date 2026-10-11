// Public configuration policy only. It never loads/prints keys or contacts services.
export function checkEnvironmentIsolation(matrix) {
  const errors=[],origins=new Map();
  for(const name of ['development','preview','production']){
    const item=matrix[name];
    if(!item){errors.push(`${name}: configuration missing`);continue;}
    let database,site;
    try{
      database=new URL(item.supabaseUrl);site=new URL(item.siteOrigin);
      for(const value of [database,site]){
        const local=['127.0.0.1','localhost','[::1]'].includes(value.hostname);
        if(value.username||value.password||value.search||value.hash||value.pathname!=='/'||
          (value.protocol!=='https:'&&!(name!=='production'&&local&&value.protocol==='http:')))throw new Error('invalid');
      }
    }catch{errors.push(`${name}: invalid public database/site origin`);continue;}
    origins.set(name,database.origin);
    if(item.stripeMode!==(name==='production'?'live':'test'))errors.push(`${name}: Stripe mode must match environment`);
    for(const path of ['/auth/callback','/auth/confirm','/auth/recovery']){
      if(!item.authRedirects?.includes(site.origin+path))errors.push(`${name}: required Auth redirect absent: ${path}`);
    }
  }
  for(const [a,b] of [['development','production'],['preview','production'],['development','preview']]){
    if(origins.has(a)&&origins.get(a)===origins.get(b))errors.push(`${a}/${b}: shared database is not isolated`);
  }
  return {configurationPolicyPassed:errors.length===0,errors,externalFlowsVerified:false};
}
