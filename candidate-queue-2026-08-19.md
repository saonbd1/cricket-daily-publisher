# Candidate Fixture Queue — 2026-08-19

Production query returned 23 candidate fixtures. The queue spans 19–27 August 2026 in Bangladesh time. Eight candidates originate from TheSportsDB only and require a second source; fifteen originate from CricketData only and require independent confirmation. No candidate currently has a conflict state.

| ID | Teams | Bangladesh time | Initial source | Review note |
|---:|---|---|---|---|
| 25 | Jamaica Kingsmen vs St Kitts and Nevis Patriots | 19 Aug 05:00 | TheSportsDB | CPL match; corroborate with CPL/official schedule |
| 24 | Dindigul Dragons vs Trichy Grand Cholas | 19 Aug 20:00 | CricketData | TNPL match; corroborate with TNPL/official schedule |
| 28 | Leicestershire vs Glamorgan | 20 Aug 06:00 | TheSportsDB | County Championship; corroborate with ECB/official county schedule |
| 27 | Warwickshire vs Sussex | 20 Aug 06:00 | TheSportsDB | County Championship; corroborate with ECB/official county schedule |
| 26 | Surrey vs Nottinghamshire | 20 Aug 06:00 | TheSportsDB | County Championship; corroborate with ECB/official county schedule |
| 1 | China Women vs Oman Women | 20 Aug 13:30 | CricketData | Already visible on prior board; corroborate with competition source |
| 23 | Siechem Madurai Panthers vs IDream Tiruppur Tamizhans | 20 Aug 16:00 | CricketData | TNPL; corroborate with official schedule |
| 22 | Nellai Royal Kings vs Salem Spartans | 20 Aug 20:00 | CricketData | TNPL; corroborate with official schedule |
| 13 | Antigua and Barbuda Falcons vs St Kitts and Nevis Patriots | 21 Aug 05:00 | CricketData | CPL; corroborate with CPL/official schedule |
| 21 | Lyca Kovai Kings vs Dindigul Dragons | 21 Aug 16:00 | CricketData | TNPL; corroborate with official schedule |
| 20 | Trichy Grand Cholas vs Chepauk Super Gillies | 21 Aug 20:00 | CricketData | TNPL; corroborate with official schedule |
| 19 | IDream Tiruppur Tamizhans vs Salem Spartans | 22 Aug 16:00 | CricketData | TNPL; corroborate with official schedule |
| 18 | Nellai Royal Kings vs Siechem Madurai Panthers | 22 Aug 20:00 | CricketData | TNPL; corroborate with official schedule |
| 6 | North Zone vs West Zone | 23 Aug 10:00 | CricketData | India domestic inter-zone; venue TBC; needs official confirmation |
| 7 | East Zone vs North East Zone | 23 Aug 10:00 | CricketData | India domestic inter-zone; venue TBC; needs official confirmation |
| 17 | TBC vs TBC | 23 Aug 20:00 | CricketData | Must not publish until teams are known |
| 16 | TBC vs TBC | 24 Aug 20:00 | CricketData | Must not publish until teams are known |
| 29 | Antigua and Barbuda Falcons vs Barbados Tridents | 26 Aug 05:00 | TheSportsDB | CPL match; possible naming mismatch with Barbados Royals; requires official confirmation |
| 9 | Antigua and Barbuda Falcons vs Barbados Royals | 26 Aug 05:00 | CricketData | Potential conflict with TheSportsDB ID 29; requires official confirmation |
| 15 | TBC vs TBC | 26 Aug 20:00 | CricketData | Must not publish until teams are known |
| 30 | Sussex vs Somerset | 27 Aug 06:00 | TheSportsDB | County Championship; corroborate with ECB/official county schedule |
| 31 | Glamorgan vs Hampshire | 27 Aug 06:00 | TheSportsDB | County Championship; corroborate with ECB/official county schedule |
| 32 | Yorkshire vs Leicestershire | 27 Aug 06:00 | TheSportsDB | County Championship; venue TBC; corroborate with ECB/official county schedule |

Important review rules: TBC-vs-TBC records are not publishable; the 26-August CPL pair is a suspected source conflict and must be resolved, not auto-promoted; a source match must agree on teams and Bangladesh-local start time within the reconciliation tolerance.

## Corroboration sources discovered

The source search identified these candidate corroboration pages: [CPL official matches](https://cplt20.com/matches), [CPL event schedule](https://cpl-cpl.shop.secutix.com/list/events), [TNPL official matches](https://tnpl.cricket/matches), [ECB County Championship fixtures](https://www.ecb.co.uk/county-championship/fixtures), [Cricbuzz CPL schedule](https://www.cricbuzz.com/cricket-series/12123/caribbean-premier-league-2026/matches), [Cricbuzz TNPL schedule](https://www.cricbuzz.com/cricket-series/12620/tamil-nadu-premier-league-2026/matches), and [ESPNcricinfo County Championship schedule](https://www.cricinfo.com/series/county-championship-division-one-2026-1513323/match-schedule-fixtures-and-results). The official pages will be preferred over secondary schedule pages for promotion decisions.

## Additional corroboration leads

Search identified [BCCI’s Duleep Trophy 2026-27 page](https://www.bcci.tv/news/article/duleep-trophy-2026-27-all-six-squads-revealed), [ESPNcricinfo’s Duleep Trophy schedule](https://www.cricinfo.com/series/duleep-trophy-2026-27-1546436/match-schedule-fixtures-and-results), [ESPN’s China Women vs Oman Women details](https://www.espn.com/cricket/series/1549165/game/1549187/crossDomain), [ESPNcricinfo’s Oman Women tour of China page](https://www.cricinfo.com/series/oman-women-in-china-2026-1549174), and [Cricbuzz’s TNPL 2026 schedule](https://www.cricbuzz.com/cricket-series/12620/tamil-nadu-premier-league-2026/matches). The search evidence suggests the Duleep fixtures and China–Oman match are real, but detailed official time confirmation is still required. The official TNPL page currently exposes 2025 content in extraction, so TNPL candidates should not be promoted from that page alone.

## Corroboration results

The detailed TNPL schedule corroborates IDs 24, 23, 22, 21, 20, 19, and 18 on teams, dates, and GMT+6 times. The schedule lists the source times in GMT/IST and they convert exactly to the production local times: 14:00 GMT = 20:00 GMT+6; 10:00 GMT = 16:00 GMT+6.

BCCI confirms the 2026-27 Duleep Trophy is played at Bengaluru from 23 August, and ESPNcricinfo lists East Zone vs North East Zone and North Zone vs West Zone on 23 August at 04:00 GMT / 09:30 local. Those convert to 10:00 GMT+6, corroborating IDs 6 and 7.

The CPL official matches page corroborates several team/date pairings but displays 07:00 without an explicit timezone; the production 05:00 GMT+6 times cannot be safely promoted until the source timezone is established. The county candidates have team/date evidence, but the current production times do not yet have a matching official time confirmation. China Women vs Oman Women is confirmed as a 20 August fixture by ESPN, but the extracted source timing does not agree with the production 13:30 GMT+6 time, so it remains held as a conflict candidate. IDs 15, 16, and 17 remain TBC-vs-TBC and are not publishable. The 26-August CPL pair (Antigua and Barbuda Falcons vs Barbados Tridents/Royals) has a naming conflict and remains held.

Proposed verified promotions: IDs 18, 19, 20, 21, 22, 23, 24, 6, and 7, with source evidence recorded as cricketdata plus the corroborating schedule sources. No candidate will be promoted solely from a public page when the time or identity is unresolved.
