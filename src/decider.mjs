// Only engine-verified fields from docs/DECIDER_REQUEST.md are accepted.
export const RULE_IDS = Object.freeze(['device_registered']);

export async function decide(request) {
  const registered=request?.deviceRegistered===true;
  return {
    schema: 'aleph.decision.v1',
    requestId: request?.requestId,
    decision: registered?'allow':'deny',
    reasonCode: registered?'approved':'device_not_registered',
    ruleIds: [RULE_IDS[0]],
  };
}
