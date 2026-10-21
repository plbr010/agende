// pg_dump recreates live columns without pg_attribute holes from dropped fields.
// Compare logical order, while retaining names/types/defaults and all constraints.
export function normalizeDataRecoveryPart(part,rows){
 if(!rows)return rows;
 if(part==='policies')return rows.map(row=>({...row,roles:[...row.roles].sort()}));
 if(part==='columns'){
  const positions=new Map();
  return rows.map(row=>{
   const table=JSON.stringify([row.table_schema,row.table_name]);
   const ordinal=(positions.get(table)??0)+1;positions.set(table,ordinal);
   return {...row,ordinal_position:ordinal};
  });
 }
 return rows;
}
