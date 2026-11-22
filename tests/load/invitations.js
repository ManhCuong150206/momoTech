import http from 'k6/http';
import { check } from 'k6';
import { Rate } from 'k6/metrics';
import { scenario } from 'k6/execution';

const { cases } = JSON.parse(open('../../data/demo/cases.json'));
const endpoint = 'http://127.0.0.1:3900/api/v1/invitations';
const headers = { 'Content-Type': 'application/json' };
const failedFlows = new Rate('invitation_flow_failed');

export const options = {
  scenarios: {
    invitations: {
      executor: 'constant-arrival-rate',
      duration: '30s',
      rate: 20,
      timeUnit: '1s',
      preAllocatedVUs: 10,
      maxVUs: 25,
    },
  },
  thresholds: {
    'http_req_duration{step:extract}': ['p(95)<250'],
    'http_req_duration{step:verify}': ['p(95)<250'],
    http_req_failed: ['rate<0.01'],
    invitation_flow_failed: ['rate<0.01'],
    dropped_iterations: ['count==0'],
  },
};

function post(step, body) {
  return http.post(`${endpoint}/${step}`, JSON.stringify(body), { headers, tags: { step } });
}

export default function () {
  const { input, expected } = cases[scenario.iterationInTest % cases.length];
  const extract = post('extract', { mode: 'simulated', ...input });
  if (!check(extract, { 'extract returns 200': (res) => res.status === 200 })) {
    failedFlows.add(true);
    return;
  }

  const { fields, requirements } = extract.json();
  const verify = post('verify', {
    mode: 'simulated',
    invitationText: input.invitationText,
    jobUrl: input.jobUrl,
    confirmed: {
      company: fields.company.value,
      role: fields.role.value,
      meetingAddress: fields.meetingAddress.value,
      requirements,
    },
  });
  const passed = check(verify, {
    'verify returns 200': (res) => res.status === 200,
    'verify preserves all expected statuses and quotes': (res) => {
      if (res.status !== 200) return false;
      const { job, location, contact, invitation, simulated } = res.json();
      return simulated && job.status === expected.jobStatus && location.status === expected.locationStatus
        && contact.status === expected.contactStatus && invitation.status === expected.invitationStatus
        && expected.evidenceQuotes.every((quote) => invitation.requirements.some((item) => item.quote === quote));
    },
  });
  failedFlows.add(!passed);
}
