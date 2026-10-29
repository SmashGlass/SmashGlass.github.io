export type StepKind = 'plan' | 'tool' | 'step' | 'hold' | 'done';

export interface Step {
  k: StepKind;
  label: string;
  /** May contain <b> for emphasis on tool/function names. */
  text: string;
}

export interface Scenario {
  id: string;
  tab: string;
  name: string;
  task: string;
  steps: Step[];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'ops',
    tab: 'OPS',
    name: 'agent · parts-reconciliation',
    task: "Reconcile yesterday's parts orders against supplier invoices and flag any mismatch over $50.",
    steps: [
      { k: 'plan', label: 'PLAN', text: 'Four steps: pull orders, pull invoices, match on PO, diff line totals.' },
      { k: 'tool', label: 'TOOL', text: '<b>dealer_api.orders</b>(date="2026-10-27") &rarr; 142 records' },
      { k: 'tool', label: 'TOOL', text: '<b>supplier.invoices</b>(date="2026-10-27") &rarr; 138 records' },
      { k: 'step', label: 'STEP', text: 'Matched 136 on PO number. 6 orders and 2 invoices unmatched.' },
      { k: 'step', label: 'STEP', text: '4 line-total mismatches over $50. Largest $412.80 on PO-88412.' },
      { k: 'hold', label: 'HOLD', text: 'Awaiting your approval before posting adjustments to the ERP.' },
      { k: 'done', label: 'DONE', text: 'Approved. 4 adjustments posted. Summary emailed to parts@.' },
    ],
  },
  {
    id: 'eng',
    tab: 'ENG',
    name: 'agent · engineering-workflow',
    task: 'The checkout service throws a timeout about once a day. Find it and open a fix.',
    steps: [
      { k: 'plan', label: 'PLAN', text: 'Pull traces for the failing window, isolate the slow span, reproduce in test.' },
      { k: 'tool', label: 'TOOL', text: '<b>traces.query</b>(service="checkout", status="timeout") &rarr; 31 spans' },
      { k: 'step', label: 'STEP', text: 'All 31 share one span: <b>tax.quote</b> &mdash; p99 at 9.4s, no client timeout set.' },
      { k: 'tool', label: 'TOOL', text: '<b>repo.search</b>("tax.quote") &rarr; 1 call site, no timeout, no retry' },
      { k: 'step', label: 'STEP', text: 'Wrote a failing test reproducing the hang. Patch adds 2s timeout + 1 retry.' },
      { k: 'hold', label: 'HOLD', text: 'Tests green. Awaiting review before opening the PR.' },
      { k: 'done', label: 'DONE', text: 'Approved. PR #418 opened with test, patch, and trace evidence.' },
    ],
  },
  {
    id: 'api',
    tab: 'API',
    name: 'agent · integration-pipeline',
    task: 'Every new order in the shop needs to reach our accounting system without anyone retyping it.',
    steps: [
      { k: 'plan', label: 'PLAN', text: 'Map both schemas, build the transform, make it idempotent, handle failures.' },
      { k: 'tool', label: 'TOOL', text: '<b>shop.schema</b>() &rarr; 24 fields &middot; <b>books.schema</b>() &rarr; 19 fields' },
      { k: 'step', label: 'STEP', text: '18 fields map directly. 3 need transform. 3 have no source &mdash; flagged.' },
      { k: 'step', label: 'STEP', text: 'Keyed on order ID so replays are safe. Failures queue, they don\'t drop.' },
      { k: 'tool', label: 'TOOL', text: '<b>pipeline.test</b>(sample=200) &rarr; 200 posted, 0 duplicates, 0 lost' },
      { k: 'hold', label: 'HOLD', text: '3 unmapped fields need a business decision before go-live.' },
      { k: 'done', label: 'DONE', text: 'Resolved. Pipeline live, 1,400 orders synced, alerting on the queue.' },
    ],
  },
];

export const SERVICES = [
  {
    n: '01', color: 'agents', title: 'AI Agent Development',
    problem: "Work that eats hours of someone's week and follows rules you could write down — but never quite the same way twice.",
    deliverables: ['Agent + tool integrations', 'Human approval gates', 'Eval suite & run logs', 'Deployment + handover'],
    next: 'Scope an agent',
  },
  {
    n: '02', color: 'automate', title: 'Business Process Automation',
    problem: 'A process held together by spreadsheets, email threads, and one person who knows how it actually works.',
    deliverables: ['Process map & failure modes', 'Automated pipeline', 'Exception handling', 'Monitoring & alerting'],
    next: 'Map a process',
  },
  {
    n: '03', color: 'integrate', title: 'Custom Software & Integrations',
    problem: "Two systems that should talk to each other, and a vendor who says it isn't supported.",
    deliverables: ['Integration architecture', 'API clients & webhooks', 'Data mapping & reconciliation', 'Tests against live sandboxes'],
    next: 'Describe the gap',
  },
  {
    n: '04', color: 'modernize', title: 'AI-Assisted Engineering',
    problem: "An application that still works but nobody wants to touch, and a team that can't afford to stop shipping to fix it.",
    deliverables: ['Architecture assessment', 'Incremental migration plan', 'Test coverage first', 'Modernized, documented code'],
    next: 'Assess a system',
  },
] as const;

export const PROCESS = [
  { n: '01', title: 'Discover', text: 'Understand the actual problem, the constraints, and what "done" means to you.', who: 'HUMAN-LED' },
  { n: '02', title: 'Architect', text: 'Decide the shape: data flow, failure modes, security boundaries, what stays manual.', who: 'HUMAN-LED' },
  { n: '03', title: 'Build', text: 'AI-assisted implementation against the agreed architecture, reviewed every step.', who: 'AI-ACCELERATED' },
  { n: '04', title: 'Validate', text: 'Tests, evals, edge cases, and a security pass before anything touches production.', who: 'AI-ACCELERATED' },
  { n: '05', title: 'Deliver', text: 'Deployed, documented, and handed over so your team can maintain it without us.', who: 'HUMAN-LED' },
] as const;

/**
 * Experience domains. Every claim here is drawn from work SmashGlass has
 * actually done — no invented clients, metrics, or case studies. Add named
 * projects here only when they are cleared for publication.
 */
export const DOMAINS = [
  {
    n: '01', color: 'integrate', title: 'Automotive aftermarket',
    summary:
      'The deepest domain. Dealer service workflows, estimation, parts ordering and eCommerce — ' +
      'systems where an integration breaking quietly costs real money every day it goes unnoticed.',
    work: ['Dealer service', 'Estimation', 'Parts ordering', 'eCommerce', 'Vendor integrations'],
  },
  {
    n: '02', color: 'agents', title: 'AI agents and automation',
    summary:
      'The core of the practice. Agents built and deployed, not prototyped — with tool access, ' +
      'retrieval over your own data, approval gates, and run logs you can audit afterwards.',
    work: ['RAG and retrieval', 'n8n workflows', 'Tool design', 'Approval gates', 'Evals', 'Run observability'],
  },
  {
    n: '03', color: 'automate', title: 'Systems integration',
    summary:
      'Connecting platforms that were never designed to talk to each other, and making the seam ' +
      'survive bad data, rate limits, and the vendor changing their API without telling anyone.',
    work: ['API clients', 'Webhooks', 'Data mapping', 'Reconciliation', 'Idempotent pipelines'],
  },
  {
    n: '04', color: 'modernize', title: 'Architecture and modernization',
    summary:
      'Engineering leadership experience applied to systems that still work but have become ' +
      'expensive to change — assessed, planned, and migrated without stopping delivery.',
    work: ['Architecture review', 'Incremental migration', 'Test coverage', 'Security review'],
  },
] as const;


/**
 * The shapes agent work actually takes. Kept separate from DOMAINS because
 * agents are the core offering and the breadth is the point — a visitor should
 * recognise their own situation in at least one of these.
 */
export const AGENT_TYPES = [
  {
    title: 'Knowledge and RAG agents',
    text: 'Answer questions against your own documents, tickets, and systems — with citations back to the source, so an answer can be checked rather than trusted.',
  },
  {
    title: 'Workflow automation',
    text: 'n8n and custom pipelines that move work between systems on their own, instead of someone re-keying the same record into a second tool.',
  },
  {
    title: 'Engineering team agents',
    text: 'Agents that work alongside your developers: code review, test generation, issue triage, release checks, and the follow-up nobody gets to.',
  },
  {
    title: 'Marketing and analytics agents',
    text: 'Pull campaign, product, and revenue data into one place and report what actually changed this week — on a schedule, without a manual pull.',
  },
  {
    title: 'In-product agents',
    text: 'Agent features inside your own application, built for your customers to use — with the guardrails and observability a customer-facing surface needs.',
  },
  {
    title: 'Internal enablement agents',
    text: 'Agents that take routine work off your team so they can do the job you actually hired them for. Usually the fastest payback of the six.',
  },
] as const;
