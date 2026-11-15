# Bark — Executive Summary

**For:** Supertails Operations, Product, and Engineering leadership  
**Date:** 15 November 2026  
**Decision status:** Proposal for discovery and MVP approval; not a production-readiness certification

## The opportunity

Bark is an internal web platform intended to give Supertails a shared operating workspace for clinic bookings, customer and pet information, escalations, clinic coordination, employee administration, and management reporting. The business case is to reduce the handoffs and re-entry that can arise when these workflows are spread across separate tools, while making ownership and change history easier to inspect.

Those operational pain points are **business hypotheses** from the project brief, not measured findings. Before promising savings, management should approve a baseline for booking effort, scheduling corrections, no-shows, escalation time, clinic utilization, and reconciliation work.

## What exists today

The codebase has a useful full-stack foundation: React/TypeScript UI, Express REST API, PostgreSQL/Drizzle data model, database-backed sign-in and role permissions, booking/customer/pet endpoints, audit and booking history, calendar events, admin APIs, and a role-scoped operational summary. The Pawcare booking flow can search or create a customer, select or register a pet, choose clinic services, view time slots, and create a booking. A quote screen can assemble clinic services, calculate a manual discount, and print a quote.

The implementation remains a **local prototype / backend MVP**. Important screens do not yet use their corresponding operational backend. The escalation UI persists to browser local storage while database-backed escalation APIs exist separately. Clinic Chat is preview-only. Booking has no complete status lifecycle and does not assign a doctor or groomer in its user flow. Current clinic-wide overlap blocking prevents two appointments from running at once, even if separate resources could safely serve them. Several home-screen metrics are static examples. Quotes are not saved and discount codes are references rather than centrally validated rules.

See [the evidence-based current-state assessment](BARK_CURRENT_STATE_ASSESSMENT.md) and [the traceability matrix](BARK_REQUIREMENTS_MATRIX.md) for details.

## Recommended production MVP

Start with one or two pilot clinics and a deliberately bounded workflow:

1. Complete customer/pet search, creation, correction, and privacy boundaries.
2. Make appointment creation, provider assignment, rescheduling, cancellation, check-in, completion, and no-show actions work end to end.
3. Model clinic hours and provider/room capacity so conflicting resource allocations are blocked while valid parallel visits remain possible.
4. Connect the escalation screens to PostgreSQL APIs, enforce role/clinic scope on the server, and record assignment/status/comment events in the append-only audit trail.
5. Deliver essential booking/escalation notifications and expose failures to operations.
6. Replace sample metrics with defined, traceable measures; show source and freshness.
7. Establish backups, restore rehearsal, secrets/TLS, logs, monitoring, access reviews, and tested release/rollback procedures.

Shopify billing, real-time chat, advanced automation, broad analytics, and a centrally managed quote/discount catalogue should follow approved business rules and integration ownership. The current quote generator is suitable for estimate prototyping, not yet for audited financial commitments.

## Indicative plan and investment

The repository-based estimate is **103–159 engineer person-days** for discovery, core hardening, booking, escalations, clinic operations, admin/reporting, integrations, and release verification. This assumes one engineer day equals roughly six focused engineering hours and that business owners respond promptly. A single AI-assisted developer should plan roughly **21–32 working weeks** of calendar time; a small team of 3–5 contributors may reduce the engineering sequence to approximately **13–20 calendar weeks**, with integration, approval, and UAT dependencies still on the critical path. The recommended MVP through pilot, excluding advanced Phase 6 integrations, is approximately **88–134 person-days**. AI assistance does not replace code review, database testing, security validation, or clinic acceptance.

This is an effort estimate, not a vendor quote or fixed delivery commitment. The low-cost deployment shape for 10–30 internal users is one secured web/API deployment, managed PostgreSQL, backups, email delivery, and monitoring. Current vendor pricing, staffing rates, and integration fees were not verified; management should obtain quotes before approving a cash budget. See the [roadmap and resource model](BARK_DEVELOPMENT_ROADMAP.md).

## Expected value and measurement

Potential benefits include faster booking intake, fewer avoidable scheduling corrections, a clearer escalation owner, less manual reconciliation, and more timely clinic/agent visibility. None are measured or proven by the current prototype. A simple labor-savings model is:

`monthly hours returned = agents × bookings per agent per day × working days × minutes saved per booking ÷ 60`

For illustration only, 10 agents completing 20 bookings per day over 22 working days would return about **147 hours/month at 2 minutes saved per booking**, or **293 hours/month at 4 minutes**. These are scenario calculations, not observed results. Finance and Operations should supply the actual inputs and compare pre/post pilot data. Revenue protection should be measured separately using verified booking errors, cancellations, missed service capacity, and contribution margin.

## Decisions requested

- Sponsor a short discovery and operational-baseline exercise, then approve a one- or two-clinic MVP pilot.
- Name business owners for appointment policy, provider/resource availability, escalation routing/SLA, customer data access, quote pricing/discount approval, reporting definitions, and system administration.
- Confirm the source of truth for customer, clinic, service, price, booking ID, and staff identities; identify migration needs.
- Select the approved hosting/security, email/notification, backup, retention, and support approach.
- Approve explicit acceptance gates and a pilot rollback plan before real customer/clinic dependence.

## Recommendation

Approve **Phase 0 discovery and MVP definition**, not a broad production launch. Bark's foundation is promising, but the first production decision should depend on closing the integration, scheduling, operational-lifecycle, and verification gaps identified in this BRD.
