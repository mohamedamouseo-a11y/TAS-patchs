# TAS Final Testing & Hardening

This is the final verification phase after Phase 1–5.

## Goal

Verify the existing system end-to-end, fix only real defects found during testing, and produce a release-readiness report.

Do not redesign completed features and do not introduce new product scope.

## Areas to verify

1. Excel Imports lifecycle and linked leads
2. Advanced RBAC and feature/action permissions
3. Data Scope for Leads, sales child entities, dashboards, and Clients
4. Admin operational settings, audit logs, and notifications
5. Competitive Queues
6. WhatsApp flows (regression only)
7. Client ownership/data-scope rules
8. Notification privacy after access changes
9. Arabic/English and RTL critical screens
10. Production build and available automated checks

## Required behavior

- Admin remains the customer operational administrator.
- SuperAdmin remains technical/developer-only.
- Branch scope stays fail-closed unless an authoritative user-to-branch model exists.
- Excel Import Delete/Restore stays Admin-only.
- Never weaken server-side authorization to make a test pass.
- Do not claim a test passed unless it was actually executed.
- No push and no PR.

Read `IMPLEMENTATION_CONTRACT.md` for the exact test matrix and repair rules.