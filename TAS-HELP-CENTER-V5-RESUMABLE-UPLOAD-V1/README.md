# TAS Help Center V5 Resumable Upload V1

This supplemental patch resumes the existing Help Center V5 media upload without reapplying V4/V5 source transforms.

Key properties:
- reuses the already committed 64-image V5 payload;
- uses Drizzle schema fields (camelCase) instead of raw SQL;
- skips already uploaded + Drive-verified objects;
- retries existing local fallback objects through TAS storage;
- uploads only unresolved objects;
- supports small batches via start index + limit;
- keeps TAS PM2 online during every batch;
- never stops production;
- verifies all 64 objects and permanent local-copy count at the end.

Run batches:
`bash run-batch.sh 0 8`
then 8/16/24/32/40/48/56.

Final:
`bash verify-all.sh`

Do not commit or push from OpenHands.
