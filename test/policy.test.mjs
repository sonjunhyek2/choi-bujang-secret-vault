import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decide,RULE_IDS} from '../src/decider.mjs';
import {fixtureRequests} from '../scripts/fixture-7.mjs';

test('policy separates composite risk, unknown provenance and verified reauthentication',async()=>{
 const {normal,suspicious}=fixtureRequests();
 const check=async(request,expected)=>{
   const answer=await decide(request);
   assert.deepEqual(Object.keys(answer).sort(),['decision','reasonCode','requestId','ruleIds','schema']);
   assert.equal(answer.requestId,request.requestId);assert.equal(answer.decision,expected);
   assert.ok(answer.ruleIds.every(id=>RULE_IDS.includes(id)));
 };
 await check(normal,'allow');await check(suspicious,'step_up');
 await check({...normal,deviceRegistered:undefined},'deny');
 await check({...suspicious,deviceRegistered:false,stepUp:{verified:true,authAgeSeconds:0}},'deny');
 await check({...normal,signals:{...normal.signals,region:'foreign'}},'allow');
 await check({...suspicious,signals:{...suspicious.signals,network:'usual'}},'allow');
 await check({...suspicious,recentEvents:[{kind:'risk_signal',ageSeconds:601,count:20}]},'allow');
 await check({...suspicious,recentEvents:[{kind:'risk_signal',ageSeconds:1,count:19}]},'allow');
 for(const signals of [undefined,{...normal.signals,source:'client_header'},{source:'none',region:'unknown',network:'unknown',hour:3}])await check({...normal,signals},'step_up');
 for(const age of [0,900])await check({...suspicious,stepUp:{verified:true,authAgeSeconds:age}},'allow');
 for(const stepUp of [{verified:true,authAgeSeconds:901},{verified:false,authAgeSeconds:0},{verified:true,authAgeSeconds:-1}])await check({...suspicious,stepUp},'step_up');
});
