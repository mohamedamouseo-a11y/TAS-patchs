# TAS Help Center V4 Source Recovery V1

This patch repairs the incomplete V4 HelpCenter.tsx that was pushed at TAS commit f4444fadcb0c29bf9371ccbec59215430ef061d4.

Recovery method:
- Keeps the complete V4 guide data, Egyptian Arabic copy, term-help definitions, links, and Home content from V4 up to the truncation point.
- Restores the missing structural tail (Home completion, GuidePage, route handling, export) from the last known complete V3 source at 6128f6324908528d379679068e81d30a49b40536.
- Re-enables V4 term-help rendering in GuidePage.
- Restores the original steps.map renderer expected by the annotated V5 media patch.

Do not commit or push from OpenHands.
After this recovery passes build/HTTP checks, continue with TAS-HELP-CENTER-ANNOTATED-DRIVE-V5.
