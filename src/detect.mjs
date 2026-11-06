// Local detection contract only: engine-verified at, method and identity.sub.
// This returns a proposal; it never revokes a session or changes device rights.
export function detect(events) {
  if (!Array.isArray(events)) throw new TypeError('invalid_detection_events');
  const bySubject=new Map();
  for(const event of events){
    if(event?.method!=='GET'||typeof event.at!=='string'||typeof event.identity?.sub!=='string'||!event.identity.sub)continue;
    const time=Date.parse(event.at);
    if(!Number.isFinite(time))continue;
    const subject=event.identity.sub;
    if(!bySubject.has(subject))bySubject.set(subject,[]);
    bySubject.get(subject).push(time);
  }
  for(const [subject,times]of bySubject){
    times.sort((a,b)=>a-b);
    let start=0;
    for(let end=0;end<times.length;end++){
      while(times[end]-times[start]>600000)start++;
      if(end-start+1>120)return {action:'propose_revocation',reasonCode:'burst_read',subject};
    }
  }
  return { action: 'observe' };
}
