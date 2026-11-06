import {test} from 'node:test';
import assert from 'node:assert/strict';
import {decide,RULE_IDS} from '../src/decider.mjs';
import {fixtureRequests} from '../scripts/fixture-7.mjs';
import {createNoticesHandler} from '../src/notices-handler.mjs';

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

test('resource boundary denies broad, mismatched, encoded and write-to-notice routes',async()=>{
 const {normal}=fixtureRequests();
 const check=async(request,decision)=>assert.equal((await decide(request)).decision,decision);
 for(const path of ['/notes','/notes/export','/notes/demo/extra','/notes/demo%2Fextra','/notes/..'])await check({...normal,path},'deny');
 await check({...normal,path:'/notes/demo',route:'GET /notes'},'deny');
 await check({...normal,queryLength:10},'deny');
 await check({...normal,service:'teacher',path:'/teacher/demo',route:'GET /teacher/:id'},'deny');
 const notice={...normal,service:'notices',path:'/notices/welcome',route:'GET /notices/:id'};
 await check(notice,'allow');
 for(const method of ['POST','PUT','PATCH','DELETE'])await check({...notice,method,route:`${method} /notices/:id`},'deny');
 for(const method of ['GET','PUT','DELETE'])await check({...normal,method,path:'/api/notes/demo',route:`${method} /api/notes/:id`},'allow');
 const handler=createNoticesHandler({verify:async auth=>auth==='fixture'?{userId:'fixture'}:null});
 const call=async(method,authorization)=>{const r={setHeader(){},status(code){this.code=code;return this;},json(body){this.body=body;}};await handler({method,headers:{authorization},query:{id:'welcome'},body:{role:'instructor'}},r);return r;};
 assert.equal((await call('GET')).code,401);
 assert.equal((await call('GET','fixture')).code,200);
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await call(method,'fixture')).code,405);
});
