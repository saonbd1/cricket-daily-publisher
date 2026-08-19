# Candidate Fixture Corroboration Audit — 19 August 2026

## Result

The production review queue contained 23 candidate fixtures. Nine fixtures were corroborated by permitted structured or official schedule evidence and promoted to `verified`. Fourteen candidates remain in review because their teams, source timezone, match time, or participant identity is unresolved.

## Promoted fixtures

| Fixture ID | Bangladesh date | GMT+6 time | Match | Corroborating evidence |
|---:|---|---:|---|---|
| 24 | 2026-08-19 | 20:00 | Dindigul Dragons vs Trichy Grand Cholas | CricketData + Cricbuzz TNPL 2026 schedule |
| 23 | 2026-08-20 | 16:00 | Siechem Madurai Panthers vs IDream Tiruppur Tamizhans | CricketData + Cricbuzz TNPL 2026 schedule |
| 22 | 2026-08-20 | 20:00 | Nellai Royal Kings vs Salem Spartans | CricketData + Cricbuzz TNPL 2026 schedule |
| 21 | 2026-08-21 | 16:00 | Lyca Kovai Kings vs Dindigul Dragons | CricketData + Cricbuzz TNPL 2026 schedule |
| 20 | 2026-08-21 | 20:00 | Trichy Grand Cholas vs Chepauk Super Gillies | CricketData + Cricbuzz TNPL 2026 schedule |
| 19 | 2026-08-22 | 16:00 | IDream Tiruppur Tamizhans vs Salem Spartans | CricketData + Cricbuzz TNPL 2026 schedule |
| 18 | 2026-08-22 | 20:00 | Nellai Royal Kings vs Siechem Madurai Panthers | CricketData + Cricbuzz TNPL 2026 schedule |
| 6 | 2026-08-23 | 10:00 | North Zone vs West Zone | CricketData + BCCI + ESPNcricinfo Duleep Trophy schedule |
| 7 | 2026-08-23 | 10:00 | East Zone vs North East Zone | CricketData + BCCI + ESPNcricinfo Duleep Trophy schedule |

## Held candidates

CPL candidates remain held because the official page displays `07:00` without an explicit timezone, which cannot be reconciled safely with the stored Bangladesh times. County candidates have team/date evidence but no matching official time confirmation yet. China Women vs Oman Women is confirmed as a 20 August fixture by ESPN, but the extracted timing does not agree with the stored 13:30 GMT+6 value. TBC-vs-TBC playoff rows and the CPL naming-conflict row remain unpublishable.

## Publication behavior

Promotion changes the persisted verification state only. The existing publisher will include these nine fixtures on its next scheduled or manually authorized run; candidate and conflict rows remain blocked by the verified-only board and Blogger publish gates.

## References

1. [BCCI: Duleep Trophy 2026-27 squads and dates](https://www.bcci.tv/news/article/duleep-trophy-2026-27-all-six-squads-revealed)
2. [ESPNcricinfo: Duleep Trophy 2026-27 fixtures](https://www.cricinfo.com/series/duleep-trophy-2026-27-1546436/match-schedule-fixtures-and-results)
3. [Cricbuzz: TNPL 2026 matches](https://www.cricbuzz.com/cricket-series/12620/tamil-nadu-premier-league-2026/matches)
4. [ESPN: China Women vs Oman Women](https://www.espn.com/cricket/series/1549165/game/1549187/crossDomain)
5. [Official CPL matches](https://cplt20.com/matches)
