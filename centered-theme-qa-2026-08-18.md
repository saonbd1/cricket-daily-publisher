# Centered Blogger Theme QA — 2026-08-18

The QA harness mirrors the final clean theme alignment rules and representative homepage fixture content. It was measured with Chromium headless after the centered CSS revision. The live Blogger site was not treated as evidence for this revision because the updated XML still requires manual upload.

| Check | Desktop result | Mobile result |
|---|---:|---:|
| CSS viewport width | 1280px | Chromium headless reported 500px despite a 390px window request; mobile media rules were active because the breakpoint is 700px |
| Document scroll width | 1280px | 500px |
| Shell bounds | left 50, right 1230, width 1180 | left 10, right 490, width 480 |
| Header text alignment | center | center |
| Navigation justification | center | center |
| Live-date justification | center | center |
| Fixture CTA bounds | left 538.6, right 741.4, width 202.8 | left 148.6, right 351.4, width 202.8 |
| Fixture table bounds | left 79, right 1201, width 1122 | left 29, right 471, width 442; mobile rows stack vertically |
| Fixture cell text alignment | center | center |
| Footer justification | center | center |
| Total links / visible links | 10 / 10 | 10 / 10 |
| Body / table-cell computed colors | rgb(244, 247, 255) / rgb(244, 247, 255) | rgb(244, 247, 255) / rgb(244, 247, 255) |

The measured document scroll width equals the viewport width in both runs, so the centered layout does not introduce horizontal overflow. The mobile run retains all ten representative links and keeps the fixture table within the content card. The Chromium CLI used in this sandbox applies a 500px CSS-width floor for headless window sizing; this is documented rather than reported as an exact 390px measurement.

The project regression suite passed with **22 test files and 39 tests**, followed by a successful TypeScript check and production build.
