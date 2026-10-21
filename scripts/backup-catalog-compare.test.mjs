import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeDataRecoveryPart as normalize} from './backup-catalog-compare.mjs';
test('data recovery recognizes pg_dump column-number gaps without ignoring logical order or type',()=>{
 const columns=[{table_schema:'public',table_name:'fixture',column_name:'id',ordinal_position:1,data_type:'uuid'},{table_schema:'public',table_name:'fixture',column_name:'name',ordinal_position:4,data_type:'text'}];
 const restored=columns.map((x,i)=>({...x,ordinal_position:i+1}));
 assert.deepEqual(normalize('columns',columns),normalize('columns',restored));
 assert.notDeepEqual(normalize('columns',columns),normalize('columns',[...restored].reverse()));
 assert.notDeepEqual(normalize('columns',columns),normalize('columns',restored.map(x=>({...x,data_type:'integer'}))));
 assert.equal(columns[1].ordinal_position,4);
});
test('policy role order is semantic but policy expressions and scope remain exact',()=>{
 const policy=[{roles:['owner','authenticated'],qual:'user_id = auth.uid()'}];
 assert.deepEqual(normalize('policies',policy),normalize('policies',[{...policy[0],roles:['authenticated','owner']}]));
 assert.notDeepEqual(normalize('policies',policy),normalize('policies',[{...policy[0],qual:'true'}]));
 assert.notDeepEqual(normalize('policies',policy),normalize('policies',[{...policy[0],roles:['anon']}]));
});
