// Only engine-verified fields from docs/DECIDER_REQUEST.md are accepted.
export const RULE_IDS = Object.freeze(['device_registered','step_up_required']);

export async function decide(request) {
  const reply=(decision,reasonCode,ruleIds)=>({
    schema: 'aleph.decision.v1',
    requestId: request?.requestId,
    decision,reasonCode,ruleIds,
  });
  if(request?.deviceRegistered!==true)return reply('deny','device_not_registered',['device_registered']);
  const signals=request.signals;
  const fixture=signals?.source==='judge_fixture';
  const validSignals=fixture&&Number.isInteger(signals.hour)&&signals.hour>=0&&signals.hour<=23
    &&['local','foreign'].includes(signals.region)&&['usual','unusual'].includes(signals.network);
  const events=request.recentEvents;
  const validEvents=Array.isArray(events)&&events.length<=12&&events.every(e=>e&&typeof e.kind==='string'
    &&Number.isSafeInteger(e.ageSeconds)&&e.ageSeconds>=0&&Number.isSafeInteger(e.count)&&e.count>=0);
  // Missing/unknown provenance stays unknown; never manufacture normal location data.
  const unknown=!validSignals||!validEvents;
  const burst=validEvents&&events.some(e=>e.kind==='risk_signal'&&e.ageSeconds<=600&&e.count>=20);
  const unusual=validSignals&&(signals.hour<6||signals.hour>=22)&&signals.network==='unusual'&&burst;
  const fresh=request.stepUp?.verified===true&&Number.isSafeInteger(request.stepUp.authAgeSeconds)
    &&request.stepUp.authAgeSeconds>=0&&request.stepUp.authAgeSeconds<=900;
  if((unknown||unusual)&&!fresh)return reply('step_up','step_up_required',[...RULE_IDS]);
  return reply('allow','approved',[...RULE_IDS]);
}
