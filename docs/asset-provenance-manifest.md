# Asset Provenance Manifest

> M0-P3 Batch 3A read-only provenance ledger. This file records the completed audit; it does not authorize or perform asset changes.

## Scope and ownership

- Covers every tracked original path under `attached_assets/` and compares exact file hashes against tracked `frontend/assets/`.
- Baseline: local security-hardening commit `264c1709bb5ed0108acb24a0c5f552eb903a50a`.
- Evidence: SHA-256 over file bytes. Names, dimensions, and visual similarity are not duplication proof.
- No direct runtime, workflow, backend, script, or artifact import of `attached_assets/` was found.
- **Owner approval recorded:** explicit approval exists for deletion only **after unique material is preserved and each candidate passes reference/canonicality review**.
- No asset is moved, renamed, deleted, or altered by this commit.

## Totals

| Measure | Value |
|---|---:|
| Attached files | 225 |
| Total bytes | 171,704,166 (163.750 MiB) |
| Internal SHA-256 duplicate groups | 26 |
| Files in those groups / extra copies | 70 / 44 |
| Extra duplicate bytes / all duplicate-group bytes | 42,229,903 / 75,796,847 |
| Exact attached/frontend groups / attached files / frontend files | 11 / 18 / 12 |
| Attached bytes represented / unique matched bytes | 52,351,621 / 29,982,982 |
| Source/provenance entries | 92 (88 textual sources plus 4 agent-metadata ward maps) |
| Design-history screenshots/references | 54 |
| Unknown unmatched images | 61 (52 unique hashes) |

### Content-based MIME counts

| MIME | Count |
|---|---:|
| `application/javascript` | 4 |
| `image/jpeg` | 54 |
| `image/png` | 81 |
| `image/webp` | 2 |
| `text/plain` | 84 |

## Classification and disposition

| Classification | Intended disposition |
|---|---|
| `SOURCE/PROVENANCE` | `KEEP` — preserve prompt/instruction material and agent-metadata sources |
| `DESIGN-HISTORY` | `KEEP` — preserve screenshot/reference history |
| `EXACT-DUPLICATE` | `DELETE-CANDIDATE` — only after preservation/reference review; not acted on here |
| `UNKNOWN/REVIEW` | `BLOCKED` — preservation review required |
| `RUNTIME-CANONICAL` | None under `attached_assets/`; canonical copies, when matched, remain in `frontend/assets/` |

## Protected ward-map sources referenced by agent metadata

| Original path | SHA-256 | Classification | Canonical counterpart | Disposition |
|---|---|---|---|---|
| `attached_assets/generated_images/ward_map_3x3_v1.png` | `1c06e17b574ae39d14fed1479be34ad5fbfad12b210fc93ee3f382ae5857c7b0` | `SOURCE/PROVENANCE` | — | `KEEP` |
| `attached_assets/generated_images/ward_map_3x3_v2.png` | `5d5ed342faf7067a4dbd74efc4ea73111d6583e86675c11042a15b7b7ca31d7b` | `SOURCE/PROVENANCE` | — | `KEEP` |
| `attached_assets/generated_images/ward_map_3x3_v3.png` | `2f868155d0eb2ac6794fcaeaee4bc106144a1fc26a42d6d9eeb9eeb7eeee0da7` | `SOURCE/PROVENANCE` | — | `KEEP` |
| `attached_assets/generated_images/ward_map_3x3_v4.png` | `428315ad3a56c3c805e0c489615bef5349a0ac337e706cba1362ee7470fbe3f3` | `SOURCE/PROVENANCE` | — | `KEEP` |

## Internal exact SHA-256 duplicate groups

| SHA-256 | Files | Bytes per file | Canonical frontend counterpart(s) |
|---|---:|---:|---|
| `097f7a5f63938753764d19e73672e6dac087bb355dcba6cb4bcde5baeae410d6` | 2 | 2,068,636 | — |
| `0c660447166ad69fe0054762136672a2c660e8c2eb113dae1f2f59c5bca22613` | 2 | 2,853 | — |
| `0ef97735db5b52b5400a7b961739d8f73141ef024c688f5a4f770282d7978298` | 2 | 45,652 | — |
| `1a302462229aafa350d289fcc8cbf5fd8f46e11d078a320bb8a527187528a716` | 2 | 3,130,036 | `frontend/assets/images/board_garden_bg.png` |
| `1cba162d305c8cda37b5cb913ef46fca2492892b29970c2de0a1b8f9cde90340` | 3 | 2,312 | — |
| `2c69e58c07bf7f8d35aa172c9201aa3a74a2d773461ac0afa7e2c412c4763a58` | 5 | 837,280 | — |
| `388660d64f2000dc907dd53667b446e8311026d9b5affc5962b293b8f29a5794` | 2 | 518,335 | — |
| `4e73a256f7faf565609a3bbaf2089c1b0682c8631dbb0b415ccecb1d4d2f1b94` | 2 | 13,812 | — |
| `5d6c7919ad1f29d66339d46da8177ea41b90b05d43a85b0b3763f7c33c96ae2d` | 3 | 3,257,088 | `frontend/assets/images/board_main_bg.png`<br>`frontend/assets/images/ward_arena_v4.png` |
| `5e7ce2fb27396f3176bd6dbf9f283c93248c4a26ed16b068715fdd917515033d` | 2 | 3,533,587 | `frontend/assets/ward-defense/lotus-healing-ward-map.png` |
| `6227b63a4b0e9b53eda7cb0811b87354aaf5558af4276445de27fc07da09a34f` | 2 | 3,324,897 | `frontend/assets/images/board_alt_bg.png` |
| `65c7f9c261431b90c34ce902d421e861b13630caf920619394f1b46ce99729e9` | 2 | 3,153,593 | — |
| `665d537f59810db24d86418779d56a254f912c16a01ac2498e2ca8baad1ad829` | 2 | 1,219,775 | — |
| `684ce3bc3acb62e53e45900c15bac11d8181776e7f31ff1f1fb1fcbf2c43df28` | 2 | 2,127 | — |
| `721ed51f6860e69283b7d993cde87ffd4c3be1ae8d73b60ddf138492d10d3fad` | 5 | 720,847 | — |
| `909206eee73877e37c09c35b5c61ae444836acbccbd17f2be464590f5b46a66c` | 3 | 602,296 | — |
| `9435dcfefb812107b23bf6cc6df4563df16ff0a6cbc533f299a0471c2aee6523` | 2 | 2,651,416 | — |
| `af1c523d14b8b6798a829dc53b27e06cd118c20b09585f5fbea2f2900e88d959` | 2 | 3,075,038 | `frontend/assets/images/ward_arena_bg.png` |
| `b23a073f155ee1b17035c16b81fc7ae0bf48b77c36134e1c0ded2ec799a13a8e` | 2 | 4,729 | — |
| `bb35060f6cb41857b1c8bef142114f810e1c64c084a942d9a7994bde0629e17b` | 2 | 1,428,601 | — |
| `c16b0f64bc5a78e273d990b9ba8efc6545e6adfa7e39737b235c0a0779c314fe` | 2 | 367,193 | — |
| `cae87e5ba6509bd033578cd660408b9467021d6a0f875506e0c70c465594121c` | 11 | 14,098 | — |
| `cd4c2004d5f21f265131cc95d054bb4159a85d69c61b18b18dc0f771e232147b` | 2 | 13,440 | — |
| `e5a6aed16f4bec2c000719c4da6af838fb06312efbc154b07db6c5083f0ac9f3` | 2 | 776,759 | — |
| `f2c286d9ddedcbe29a3ea8d0cf48f008ee64621cf42c4d4f26d01bad1e05b33c` | 2 | 2,790,905 | `frontend/assets/dev-reference/fog_system_design_reference.png` |
| `f363215342ebd9af59d12b3e438868fac0cdbf8aa0fe829a1a7a3bb6ceb94765` | 2 | 11,639 | — |

## Exact attached-to-frontend matches

| SHA-256 | Attached original path(s) | Canonical frontend counterpart(s) |
|---|---|---|
| `1a302462229aafa350d289fcc8cbf5fd8f46e11d078a320bb8a527187528a716` | `attached_assets/download_1782822798788.png`<br>`attached_assets/image_1782822148784.png` | `frontend/assets/images/board_garden_bg.png` |
| `34934b4871d7b15f304b8e705f017e21e6f1a8723ae7949469fdd37143846bf2` | `attached_assets/generated_images/hex-terrain-normal.png` | `frontend/assets/ui/journey/tiles/hex-terrain-normal.png` |
| `444126906835b82f89209f0fb2ab6e2013f575038146dc09b00fec2f5a2213f2` | `attached_assets/generated_images/ch1-open-courtyard-master-day.png` | `frontend/assets/ui/journey/map/map-platform-background-ch1-day.png` |
| `56d49319b716d0bed6b049a92a272a5f1b072e9fc46c1d8621c2ca56fbfc15d9` | `attached_assets/generated_images/ch1-open-courtyard-night.png` | `frontend/assets/ui/journey/map/map-platform-background-ch1-night.png` |
| `5d6c7919ad1f29d66339d46da8177ea41b90b05d43a85b0b3763f7c33c96ae2d` | `attached_assets/download_1782822789845.png`<br>`attached_assets/download_1782822789846.png`<br>`attached_assets/image_1782822174838.png` | `frontend/assets/images/board_main_bg.png`<br>`frontend/assets/images/ward_arena_v4.png` |
| `5e7ce2fb27396f3176bd6dbf9f283c93248c4a26ed16b068715fdd917515033d` | `attached_assets/file_000000009864722f99e7ebe650e291b6_1782891542101.png`<br>`attached_assets/lotus-healing-ward-map_1782903283043.png` | `frontend/assets/ward-defense/lotus-healing-ward-map.png` |
| `61a303a4dea6576e42b87a33019ed73b94bf33cc2233b09f91a367fce8514c5e` | `attached_assets/image_1782869498381.png` | `frontend/assets/references/ward_defense_target.png` |
| `6227b63a4b0e9b53eda7cb0811b87354aaf5558af4276445de27fc07da09a34f` | `attached_assets/download_1782822787244.png`<br>`attached_assets/image_1782822159632.png` | `frontend/assets/images/board_alt_bg.png` |
| `af1c523d14b8b6798a829dc53b27e06cd118c20b09585f5fbea2f2900e88d959` | `attached_assets/download_1782822792125.png`<br>`attached_assets/image_1782822209351.png` | `frontend/assets/images/ward_arena_bg.png` |
| `bf6bd6ce2c20bb36dace552fa40045b75e192d91bd08eb0343b085ebdcb535d5` | `attached_assets/generated_images/ch1-open-courtyard-evening.png` | `frontend/assets/ui/journey/map/map-platform-background-ch1-evening.png` |
| `f2c286d9ddedcbe29a3ea8d0cf48f008ee64621cf42c4d4f26d01bad1e05b33c` | `attached_assets/fog_system_design_reference_1786537498533.png`<br>`attached_assets/fog_system_design_reference_1786549701098.png` | `frontend/assets/dev-reference/fog_system_design_reference.png` |

## SOURCE/PROVENANCE — KEEP

Each row records original path and SHA-256. The section heading is the file classification and intended disposition. For exact frontend copies, the counterpart is above; duplicate-group membership is identifiable from the hash table above.

- `attached_assets/Pasted--Clinica-Elemental-Counter-System-Overhaul-Objective-Ov_1785669539160.txt` — `5aa011d5db93c275ad59473f719176a1831cf5e85ea55384be60296fb633458d`
- `attached_assets/Pasted--Clinica-Tutorial-Discovery-Audit-Review-the-entire-Cli_1785675814761.txt` — `36b39eb7f0146a6af4aabfc689e2691f019c491ee1064ab3239a33d46ed2f85e`
- `attached_assets/Pasted--EA-01B-Corruption-Aspect-and-Elemental-Counter-Separat_1785684974851.txt` — `7aeee03647636c2a1d920349682267bf31e3435189bb6c00469850f78f06e280`
- `attached_assets/Pasted--NM-01-Addendum-Complete-Hero-Skill-Audit-and-Migration_1785672617966.txt` — `d118ca7f82356cb51ece99f09a0fa14cf99645f75eb6c0f5a57739edbbebf49c`
- `attached_assets/Pasted--Replit-Development-Packet-Clinica-Core-Gameplay-Loop-I_1782658654767.txt` — `0add869df5a2016e7e568d3831d48a809bda293d7c734f49e34109624175f257`
- `attached_assets/Pasted--Replit-Fix-Packet-Home-Screen-Hero-Portrait-Cropping-G_1782658697369.txt` — `cd4c2004d5f21f265131cc95d054bb4159a85d69c61b18b18dc0f771e232147b`
- `attached_assets/Pasted--Replit-Fix-Packet-Home-Screen-Hero-Portrait-Cropping-G_1782658707319.txt` — `cd4c2004d5f21f265131cc95d054bb4159a85d69c61b18b18dc0f771e232147b`
- `attached_assets/Pasted--Replit-Fix-Packet-Home-Screen-Safe-Area-Bottom-Tab-Cut_1782662867819.txt` — `18451fb1aa37163dedfa7be16ec5d28f05c768a44a25dcf1d9920eef2c671605`
- `attached_assets/Pasted--Replit-Instruction-Fix-Mobile-Battle-Interface-So-Ever_1782567526475.txt` — `70ae774f9e6840f7c8271a1480eebcab25180c955c766158a7f0d2582ae9ea22`
- `attached_assets/Pasted--Replit-Instruction-Fix-Mobile-Notch-Dynamic-Island-Saf_1782569859009.txt` — `b4840e096b98d7da3749a709cdccced555517a176ee3a7dc50980e3b75d1b6cd`
- `attached_assets/Pasted--Replit-Instruction-Package-Import-Run-and-Fix-Clinica-_1782565279832.txt` — `882a63bbb6f956840e159cd7321ca20697a37ae182b676856e84458280e528d6`
- `attached_assets/Pasted--SIMULATION-ERA-The-Fading-Apprentice-21-21-Movement-co_1787206835793.txt` — `0b0e90754cdfd3791954f496496f055610dd806541fe242672a9875cf91e81a0`
- `attached_assets/Pasted-1-Design-Goal-Redesign-the-current-main-hub-so-it-combi_1785982983453.txt` — `d622c592d1166c2674887f050ae43bb34fb617a256e08af01ff67e104c9ca64a`
- `attached_assets/Pasted-ADJUSTMENT-ALIGN-EXISTING-THREE-SHIFT-GENERATOR-WITH-CA_1786310128485.txt` — `28ab7b60fedc18004a17c493aac80c15652191e31ac6f891bcd3f0fc55924231`
- `attached_assets/Pasted-ADJUSTMENT-PUSH-B-INTEGRATE-DETERMINISTIC-CONTINUE-JOUR_1786195748820.txt` — `b22c1d6694ea9dd5b4e33f3148c8abd06fe2c9188a6193d4b3a08fbc3e342bc9`
- `attached_assets/Pasted-Adjustment-Push-F-Early-failure-assistance-with-no-gues_1786195791026.txt` — `bf6225268787bc9a3364ec34ce612515d56e6df4cbb4591275e05f55d2ada34e`
- `attached_assets/Pasted-Before-Night-is-unlocked-don-t-render-its-actual-nodes-_1786195773911.txt` — `67307239eb8267a0b5c66090891f5f14b904e15bebf563c5dad1aff7bcb34bdc`
- `attached_assets/Pasted-CLINICA-JOURNEY-MAP-AUTHORED-MAP-ADJUSTMENT-This-is-an-_1786313683224.txt` — `4f82590024a34b6e543ca92310b61307494859aa1c4bf39672b4bc7a456775c5`
- `attached_assets/Pasted-CLINICA-JOURNEY-MAP-PRESENTATION-ADJUSTMENT-DIRECTIVE-T_1786327852765.txt` — `d369490d244df4da66d3e0ce8311d40b20317b531279a7ccb98249550ed76f48`
- `attached_assets/Pasted-CONSOLIDATED-FOG-CORRECTION-REMOVE-EDGE-LAYER-USE-ORGAN_1786824358460.txt` — `d76b2ee181951c55d4408ae2a712b9c77716c88d5130757c3d957d776ab5c10f`
- `attached_assets/Pasted-CORRECTIVE-PUSH-REPLACE-STAMPED-SQUARE-FOG-WITH-ONE-CON_1786760280121.txt` — `73fa046f9344d8341de428fdab0db0b67268142d5e76c1b6e279e5e910336932`
- `attached_assets/Pasted-Clinica-Bug-Fix-Restore-Original-Tutorial-Flow-With-For_1784509319915.txt` — `30036a20543342e5469667e27689139ddb469186b6b6eb09de56e62ea74219b4`
- `attached_assets/Pasted-Clinica-Push-1-Prologue-State-Framework-Goal-Create-the_1784495369280.txt` — `7fd0b79c0d856b4d8a73f0d67e5b3d61a78c4347a07aa558c4fde72a00ebd925`
- `attached_assets/Pasted-Clinica-Push-10-Memory-Echo-Rewards-and-University-Intr_1784506634649.txt` — `9f56ccc68339e10f67452a833ca5ffe47f637c8a5983f09147c7758a6846d7e8`
- `attached_assets/Pasted-Clinica-Push-2-Former-Self-Memory-Cinematic-Goal-Add-th_1784496315484.txt` — `3b7d5643f2eb1d47c0b04702746958d49faac225a645954ae07c7fbf41cf172f`
- `attached_assets/Pasted-Clinica-Push-3-Tactical-Warning-Scene-Goal-Create-the-2_1784499883718.txt` — `b7929938ea81744a46efeb71199d66dc397bc8134a16c2f7b6d287c021a290ec`
- `attached_assets/Pasted-Clinica-Push-4-Silent-Infarction-Reveal-and-Temporary-P_1784500783156.txt` — `99ea8067ab98e9e5e7fc7691548f52cb03cbc1686eadea30234368caaebf4d59`
- `attached_assets/Pasted-Clinica-Push-5-Nightingale-and-Fleming-Tutorial-Skills-_1784501433073.txt` — `84d040cd557e52f20ad8424d9d6b597be3db397cb9c4dad3d0f6d127517ea0d1`
- `attached_assets/Pasted-Clinica-Push-8-Lotus-Recall-Character-Creation-Goal-Mov_1784503597504.txt` — `a1e09eaffe4e5f1ffe9226d8d1e1ee613ea1bab9c86b32cc6065610047e6eb43`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510428249.txt` — `cae87e5ba6509bd033578cd660408b9467021d6a0f875506e0c70c465594121c`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510434812.txt` — `cae87e5ba6509bd033578cd660408b9467021d6a0f875506e0c70c465594121c`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510444165.txt` — `cae87e5ba6509bd033578cd660408b9467021d6a0f875506e0c70c465594121c`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510448724.txt` — `cae87e5ba6509bd033578cd660408b9467021d6a0f875506e0c70c465594121c`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510452850.txt` — `cae87e5ba6509bd033578cd660408b9467021d6a0f875506e0c70c465594121c`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510461044.txt` — `cae87e5ba6509bd033578cd660408b9467021d6a0f875506e0c70c465594121c`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510461251.txt` — `cae87e5ba6509bd033578cd660408b9467021d6a0f875506e0c70c465594121c`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510461418.txt` — `cae87e5ba6509bd033578cd660408b9467021d6a0f875506e0c70c465594121c`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510461596.txt` — `cae87e5ba6509bd033578cd660408b9467021d6a0f875506e0c70c465594121c`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510477432.txt` — `1cba162d305c8cda37b5cb913ef46fca2492892b29970c2de0a1b8f9cde90340`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510480014.txt` — `1cba162d305c8cda37b5cb913ef46fca2492892b29970c2de0a1b8f9cde90340`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510484167.txt` — `1cba162d305c8cda37b5cb913ef46fca2492892b29970c2de0a1b8f9cde90340`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510539579.txt` — `cae87e5ba6509bd033578cd660408b9467021d6a0f875506e0c70c465594121c`
- `attached_assets/Pasted-Clinica-Visual-Consistency-and-Battle-Sprite-Restoratio_1784510572639.txt` — `cae87e5ba6509bd033578cd660408b9467021d6a0f875506e0c70c465594121c`
- `attached_assets/Pasted-Exactly-That-should-be-the-canonical-order-The-blueprin_1787009496669.txt` — `5cd8398c1db489f90e6497e2151b0ea9988c7a3e7d4b7a9d02af5e4bd185667a`
- `attached_assets/Pasted-Final-small-QA-push-Give-Replit-this-after-the-coding-a_1786195868786.txt` — `e798a337bab5ea3769a897e08a92dfbafa723dcc8e1c5b9c7674fd1f3e2bfdcf`
- `attached_assets/Pasted-Fix-request-for-Nightingale-portrait-extension-Target-a_1784934692160.txt` — `0c660447166ad69fe0054762136672a2c660e8c2eb113dae1f2f59c5bca22613`
- `attached_assets/Pasted-Fix-request-for-Nightingale-portrait-extension-Target-a_1784934776100.txt` — `0c660447166ad69fe0054762136672a2c660e8c2eb113dae1f2f59c5bca22613`
- `attached_assets/Pasted-Goal-Please-do-a-safe-visual-UI-refresh-pass-on-Clinica_1783438741397.txt` — `f3519804fdb18e78af1cfdb20bfe9c4e90e95e08ab105be6002417803e6424ea`
- `attached_assets/Pasted-High-level-critique-What-is-improved-The-map-now-at-lea_1786473956447.txt` — `e5c56f887a93992ee5918cbc98a16ad4d91b5041db98a129647423c431361b8f`
- `attached_assets/Pasted-Implement-Clinica-Tutorial-Reliability-Push-1-Keep-the-_1785684876689.txt` — `8e10792ff58ef324e962ad5782e302d6e3ddd74cbcf7b89bbae941233e3ed226`
- `attached_assets/Pasted-PRODUCTION-BRIDGE-PUSH-5A-GENERATE-AND-LOAD-THE-ACTUAL-_1787002038920.txt` — `683309b27840ceb81ec82366a553c1159a1d5a7026e4a13f7489bfc11cd25ab8`
- `attached_assets/Pasted-PRODUCTION-FIX-SEPARATE-COLLISION-CRITICAL-SCENERY-FROM_1787063141222.txt` — `b13d0898f59e32aaa801ebbc307a4ddbd838c27330c7c0e06edf758eb507385e`
- `attached_assets/Pasted-PUSH-1-FIX-CHAPTER-BOSS-GATE-SCALE-FOOTPRINT-AND-OCCLUS_1786506953666.txt` — `3f342ef9d91b9ea5ed446bb751ddafdfad712034d1b7c75793c7691dbce7bbca`
- `attached_assets/Pasted-PUSH-2-Add-directional-idle-states-for-the-player-sprit_1786506917467.txt` — `684ce3bc3acb62e53e45900c15bac11d8181776e7f31ff1f1fb1fcbf2c43df28`
- `attached_assets/Pasted-PUSH-2-Add-directional-idle-states-for-the-player-sprit_1786506957323.txt` — `684ce3bc3acb62e53e45900c15bac11d8181776e7f31ff1f1fb1fcbf2c43df28`
- `attached_assets/Pasted-PUSH-2-GENERATE-NAVIGATION-BLUEPRINT-BEFORE-BACKGROUND-_1786882093033.txt` — `b8aad30b184a7ef256bffc7b94eb3e14e638c42f889b3f0c365d21d3ad6c2dc6`
- `attached_assets/Pasted-PUSH-2-REBUILD-FOG-AS-A-WORLD-SPACE-ATMOSPHERIC-LAYER-T_1786507415360.txt` — `64f413f260f6b2033f1c76ea42f3cd36d31edfcbf4abf5bac427dd507b8b5421`
- `attached_assets/Pasted-PUSH-2A-REMOVE-RECTANGULAR-WORLD-SPACE-FOG-BLOCKS-The-w_1786533899465.txt` — `e7ccc976761f93d9d3695c9f9268270119b386433777ccd5ba6f479060cce626`
- `attached_assets/Pasted-PUSH-3-CREATE-A-PROCEDURAL-MAP-ARCHETYPE-GRAMMAR-Do-NOT_1786883958412.txt` — `5997fa2adf3bdab819b3acb3271b8ffc3cb944fb69d2c61435ec5ad1c0e48300`
- `attached_assets/Pasted-PUSH-4-GENERATE-PATHWAY-NETWORK-FROM-CHAPTER-MAP-DNA-Ma_1786884429248.txt` — `c860c7cf53b0c7b58a0e9c6e4cbac18af240dd0cd169e94d09915bd550060912`
- `attached_assets/Pasted-PUSH-4A-1-FIX-THE-ACTUAL-MAPWORLD-SIZE-AND-PROVE-CAMERA_1786856922135.txt` — `de3b58a9aa95889902f51ef52b0a8fb05e04271031907af558edc2118c6ba943`
- `attached_assets/Pasted-PUSH-4A-5-FINAL-TACTICAL-ZOOM-OUT-TO-80PX-AND-LOCK-WORL_1786863338256.txt` — `5a9f05d81c5db079c33d7a30293e0321f044e37a47557a72722853149430b7c0`
- `attached_assets/Pasted-PUSH-4A-PROVE-AUTHORED-WORLD-SIZE-AND-RESTORE-PLAYER-FO_1786852485751.txt` — `b23a073f155ee1b17035c16b81fc7ae0bf48b77c36134e1c0ded2ec799a13a8e`
- `attached_assets/Pasted-PUSH-4A-PROVE-AUTHORED-WORLD-SIZE-AND-RESTORE-PLAYER-FO_1786880382656.txt` — `b23a073f155ee1b17035c16b81fc7ae0bf48b77c36134e1c0ded2ec799a13a8e`
- `attached_assets/Pasted-PUSH-4B-GUARANTEE-SINGLE-CANVAS-FOG-COVERAGE-OVER-THE-C_1786881481491.txt` — `b1d108e714c0a9c05a7496bf4b17ce824b68efa6aa18e89bdf07ffa27c7e885a`
- `attached_assets/Pasted-PUSH-5-EXPAND-PATH-GRAPH-INTO-WALKABLE-HEX-LANES-AND-CL_1786884439832.txt` — `2e523faca29bff910b1b5ed2d751ff09940a61514abce96b7dbe74ea9d059c13`
- `attached_assets/Pasted-PUSH-5A-REMOVE-RECTANGULAR-BOUNDS-FROM-BASE-MID-FOG-COM_1786547005550.txt` — `e8dc709ec79449f22da8fdafdd4e001bec0d7e3b0f8eea237769dfe718f1f756`
- `attached_assets/Pasted-PUSH-6-GENERATE-SCENERY-ZONES-FROM-NON-WALKABLE-NEGATIV_1786884447902.txt` — `7a2d6ac59d51c23636f50fd5c5077d37cf0e78f90566359ec2396737ce114b50`
- `attached_assets/Pasted-PUSH-7-GENERATE-RASTER-BACKGROUND-FROM-MAP-BLUEPRINT-On_1786884455146.txt` — `38a3309bdfd74a86e1035e0594b44295d3f769083771f392bbf040402930dc1c`
- `attached_assets/Pasted-PUSH-CLAMP-HEX-TERRAIN-AND-PLAYER-MOVEMENT-TO-THE-BASE-_1786584854158.txt` — `7aac619cfc1fc07e77e57afc36ea369d999631fdf6f77e0c31436582936db2d3`
- `attached_assets/Pasted-Perform-a-focused-read-only-verification-of-the-Clinica_1785680754255.txt` — `cdf8c07ea15ea440af2e06a3d37f6ca51f7fb03c31628facf180e2d305d5f794`
- `attached_assets/Pasted-Portrait-extension-instruction-for-frontend-assets-imag_1784858118030.txt` — `88eaef4291bb4ec2c1caff4ac3dfef803ddf49071a02f9dcb0d30dc7478c3ba5`
- `attached_assets/Pasted-Portrait-extension-instruction-for-frontend-assets-imag_1784858161257.txt` — `e0486e0cafa3913051fe5d3cf6a9f4c7fc232c51faa9823e2a5c0f3c46c48335`
- `attached_assets/Pasted-Replit-Instruction-Package-Improve-Clinica-Engagement-P_1782586594940.txt` — `f363215342ebd9af59d12b3e438868fac0cdbf8aa0fe829a1a7a3bb6ceb94765`
- `attached_assets/Pasted-Replit-Instruction-Package-Improve-Clinica-Engagement-P_1782586662003.txt` — `f363215342ebd9af59d12b3e438868fac0cdbf8aa0fe829a1a7a3bb6ceb94765`
- `attached_assets/Pasted-Replit-Instruction-Package-Opening-Player-Quiz-Class-Pi_1782590617528.txt` — `4e73a256f7faf565609a3bbaf2089c1b0682c8631dbb0b415ccecb1d4d2f1b94`
- `attached_assets/Pasted-Replit-Instruction-Package-Opening-Player-Quiz-Class-Pi_1782591163093.txt` — `4e73a256f7faf565609a3bbaf2089c1b0682c8631dbb0b415ccecb1d4d2f1b94`
- `attached_assets/Pasted-Replit-Instruction-Package-Player-Progression-Hero-Leve_1782588140819.txt` — `5aa4d4c7b22356522394ec44594c57f1a62937db0c2d263c4868d57cea60999b`
- `attached_assets/Pasted-Replit-Instruction-Package-Unified-Clinica-Identity-Ada_1782589176334.txt` — `0ef97735db5b52b5400a7b961739d8f73141ef024c688f5a4f770282d7978298`
- `attached_assets/Pasted-Replit-Instruction-Package-Unified-Clinica-Identity-Ada_1782589187339.txt` — `0ef97735db5b52b5400a7b961739d8f73141ef024c688f5a4f770282d7978298`
- `attached_assets/Pasted-Replit-instruction-draft-Reminiscing-rewrite-Rewrite-th_1783440199847.txt` — `bdcdafc9c37fd1befc883c6857795638bfa432a1a561ae3cec5cb8574371f628`
- `attached_assets/Pasted-Scene-1-Before-Clinica-Visual-direction-Warm-lamplight-_1783440263874.txt` — `3c9f801a5d72f7b8e10821e422fbf215a382f6811bcdc3d93e00cfe05410bdb8`
- `attached_assets/Pasted-The-previous-response-repeated-the-original-broad-tutor_1785682279489.txt` — `69a873ad956175df14c3b86d6cf89fe3a8873f07fc776ee6e4e582a7a1bd55d2`
- `attached_assets/Pasted-What-is-still-wrong-The-camera-is-not-actually-centerin_1786491958941.txt` — `419b86e2c2d59de8877c5c179444db1fba54afa52ffc7a685c104bd792e85d09`
- `attached_assets/Pasted-Yes-In-this-screenshot-the-MSK-toggle-is-ON-and-the-hug_1786826356717.txt` — `49056203e9d226d0895427b323b813a8887836fee015c7618dbaed10e0433ffe`
- `attached_assets/Pasted-Yes-Think-of-the-entire-Chapter-as-a-Photoshop-document_1786762390967.txt` — `36e1e3d47b22125fe817c3958cc6b688833d4ccd02bfcef28e6a502789522b63`
- `attached_assets/Pasted-You-are-the-Clinica-Executive-Team-a-three-role-advisor_1783435510636.txt` — `caaa300762bb6806906e29774cf38eef6005dcbaeedb7f2870bf0abde29ceada`
- `attached_assets/Pasted-journeyRecommendation-ts-import-JourneyNodeUi-JourneyRe_1786195704709.txt` — `9cc2a3c742020ca7b63d675bda611d92d200f1174e8097e536affaf1ce1a9c8d`
- `attached_assets/generated_images/ward_map_3x3_v1.png` — `1c06e17b574ae39d14fed1479be34ad5fbfad12b210fc93ee3f382ae5857c7b0`
- `attached_assets/generated_images/ward_map_3x3_v2.png` — `5d5ed342faf7067a4dbd74efc4ea73111d6583e86675c11042a15b7b7ca31d7b`
- `attached_assets/generated_images/ward_map_3x3_v3.png` — `2f868155d0eb2ac6794fcaeaee4bc106144a1fc26a42d6d9eeb9eeb7eeee0da7`
- `attached_assets/generated_images/ward_map_3x3_v4.png` — `428315ad3a56c3c805e0c489615bef5349a0ac337e706cba1362ee7470fbe3f3`

## DESIGN-HISTORY — KEEP

Each row records original path and SHA-256. The section heading is the file classification and intended disposition. For exact frontend copies, the counterpart is above; duplicate-group membership is identifiable from the hash table above.

- `attached_assets/Screenshot_20260628_173734_Expo_Go_1782686273270.jpg` — `7f5e5b458dace865b2b47220d5e26e45f3f4ecc1d3e490c14b9bf3abe06c19ff`
- `attached_assets/Screenshot_20260629_054909_Pinterest_1782731226182.jpg` — `883f766cf5c3fa3f5ee3475f13b49ecc180070a100a096db48eb0b6a17c6144d`
- `attached_assets/Screenshot_20260701_071657_Expo_Go_1782908249395.jpg` — `5f9b756289ea5f7946b3e7bf59ba23624cb6597e8981b2c546fd949a602a3b8b`
- `attached_assets/Screenshot_20260702_220026_Chrome_1783106291103.jpg` — `96c96e6012cd9278f97b8dab92ec52120fdc29956830e9b1b069c5efbbb7ff9f`
- `attached_assets/Screenshot_20260703_141754_Expo_Go_1783106302106.jpg` — `1cc9fff7eee5b9cd8da1edbe2404a087b8a22ebfb729ebf483df4fa76f2ae3f4`
- `attached_assets/Screenshot_20260703_213809_Rush_Royale_1783132788728.jpg` — `83d16001ce904b9734a5b85119b322f81de5bdc854aa6c2da079bc65abcde050`
- `attached_assets/Screenshot_20260703_213838_Rush_Royale_1783132793112.jpg` — `cd428fb1e5aab940990159ab8dfba7094276246244c0771f3c283380435fdfaa`
- `attached_assets/Screenshot_20260704_163356_Chrome_1783200849233.jpg` — `73ac911e8e344da586115340db464a704033d430a65782a2f0a35140b44bfecf`
- `attached_assets/Screenshot_20260704_163520_Chrome_1783200947217.jpg` — `72092bb1da30c2cc6fea6d8a94de549a571a766dff3c58c2cec1ca39ed6137ca`
- `attached_assets/Screenshot_20260704_190839_Expo_Go_1783210132446.jpg` — `3efca0fe18c5cecd56dbf50faa67ab919850b7945a99dab431d2df044a0c2f78`
- `attached_assets/Screenshot_20260705_214442_Expo_Go_1783305905458.jpg` — `215c9e4a247ebbc23f058d1bec912717deb5ad48e4e1c563ca8ebaa0c8be4499`
- `attached_assets/Screenshot_20260706_202940_Expo_Go_1783392064575.jpg` — `c0664a7850db2091ff2d99d5493d8425a3281ab84cad10ff462b401e29520cd4`
- `attached_assets/Screenshot_20260706_213804_Expo_Go_1783392054050.jpg` — `51d711e47440de1a255608098b946ca72437b8b4246d0148f27f1fdfdff4f4b7`
- `attached_assets/Screenshot_20260706_213840_Expo_Go_1783392064561.jpg` — `fd418948d6537f792f8175224aba04f2648b13a02ef23610e05a7c1078705612`
- `attached_assets/Screenshot_20260707_055158_Expo_Go_1783421541270.jpg` — `c60097f4cbd1f8afbe0742a743efd1362f207cf843b769efeb7863df94007a33`
- `attached_assets/Screenshot_20260708_230311_Chrome_1783569953048.jpg` — `2c69e58c07bf7f8d35aa172c9201aa3a74a2d773461ac0afa7e2c412c4763a58`
- `attached_assets/Screenshot_20260708_230311_Chrome_1783570215411.jpg` — `2c69e58c07bf7f8d35aa172c9201aa3a74a2d773461ac0afa7e2c412c4763a58`
- `attached_assets/Screenshot_20260708_230311_Chrome_1783570238800.jpg` — `2c69e58c07bf7f8d35aa172c9201aa3a74a2d773461ac0afa7e2c412c4763a58`
- `attached_assets/Screenshot_20260708_230311_Chrome_1783570274302.jpg` — `2c69e58c07bf7f8d35aa172c9201aa3a74a2d773461ac0afa7e2c412c4763a58`
- `attached_assets/Screenshot_20260708_230311_Chrome_1783570297144.jpg` — `2c69e58c07bf7f8d35aa172c9201aa3a74a2d773461ac0afa7e2c412c4763a58`
- `attached_assets/Screenshot_20260708_230527_Chrome_1783569953110.jpg` — `721ed51f6860e69283b7d993cde87ffd4c3be1ae8d73b60ddf138492d10d3fad`
- `attached_assets/Screenshot_20260708_230527_Chrome_1783570209150.jpg` — `721ed51f6860e69283b7d993cde87ffd4c3be1ae8d73b60ddf138492d10d3fad`
- `attached_assets/Screenshot_20260708_230527_Chrome_1783570238772.jpg` — `721ed51f6860e69283b7d993cde87ffd4c3be1ae8d73b60ddf138492d10d3fad`
- `attached_assets/Screenshot_20260708_230527_Chrome_1783570274280.jpg` — `721ed51f6860e69283b7d993cde87ffd4c3be1ae8d73b60ddf138492d10d3fad`
- `attached_assets/Screenshot_20260708_230527_Chrome_1783570297172.jpg` — `721ed51f6860e69283b7d993cde87ffd4c3be1ae8d73b60ddf138492d10d3fad`
- `attached_assets/Screenshot_20260709_045234_Expo_Go_1783590768111.jpg` — `67dc00dd7927917f9694383be71cba81ca110672b8ea8e57cbf668752c90c047`
- `attached_assets/Screenshot_20260709_045749_Expo_Go_1783591083026.jpg` — `eaf2c0f375e06e538277992bb4dd5f2df2252d49a06ba4049488ba4b69eb979c`
- `attached_assets/Screenshot_20260710_064134_Expo_Go_1783683712697.jpg` — `9cf8a55d9d61932b014ed61a7d70e440f8385289c232ccd717c9a04744452f91`
- `attached_assets/Screenshot_20260712_101015_Expo_Go_1783869030872.jpg` — `e59f0e588d6679f3aad1e1d16e4194d16c376e58a7dfee845f369e7cd4f590e6`
- `attached_assets/Screenshot_20260712_120513_Expo_Go_1783875928183.jpg` — `e210608f2516b7bdfc01dbcb75d1c86a65a76d368c0a4e0fd37cbc1d68940c35`
- `attached_assets/Screenshot_20260718_063932_Expo_Go_1784394107770.jpg` — `2ab14adca93e591727648fe98984577eaa275da845110f40d7ee3929e4b3185d`
- `attached_assets/Screenshot_20260718_120121_Expo_Go_1784394107699.jpg` — `496a5afc1c5caf091edf0df32b27d8d2ee3e99f672aade0f225e21ea682a09e2`
- `attached_assets/Screenshot_20260718_163806_Expo_Go_1784410716083.jpg` — `696c5121817a3a60f49bdb7236a46737711bc8dea97678e635a039a68cb392b8`
- `attached_assets/Screenshot_20260718_201223_Expo_Go_1784424537269.jpg` — `a8c02a6e2353a7766475056a525f5cb40306fa29d951ae9b1bc5f4e1e02eeb5e`
- `attached_assets/Screenshot_20260718_203543_Expo_Go_1784424954632.jpg` — `d260ed95681244b77e615425cf0b3b7e4f7bf73a88da9efde2648a98696be5d6`
- `attached_assets/Screenshot_20260719_100004_Expo_Go_1784473255974.jpg` — `5b7ca89569386c4d0228c63834ab18c03f9515874753ba3c186ea091a94a493b`
- `attached_assets/Screenshot_20260721_190031_Expo_Go_1784678451438.jpg` — `c5269683691fc5f26cd1710beac9010e4665e51dddaa4fb21d3775ce9c086082`
- `attached_assets/Screenshot_20260807_230923_ChatGPT_1786162176624.jpg` — `7bb2c48314117673045b2cb2038d3f2a0199b94365a85eb0940aff888a923ea8`
- `attached_assets/Screenshot_20260811_055656_Replit_1786445902799.jpg` — `777d1de5b1fd428a4a13dbd86d21a449414e869e713a3d67ab4bc013b62fe709`
- `attached_assets/Screenshot_20260811_184550_Chrome_1786491967640.jpg` — `152fa5c3ab04462171626478a2d8fb6548486e0c07260ccc613289f1dc05cc09`
- `attached_assets/Screenshot_20260816_103824_Chrome_1786894726661.jpg` — `1324562c76b5a9289dafd3d4bc45833ffc008510c2f8aab70eed47754a45dec9`
- `attached_assets/Screenshot_20260816_104624_Chrome_1786895215830.jpg` — `ec1705207d608c939951d4a00635f139d46bac123931ae43d91339be98298ef0`
- `attached_assets/Screenshot_20260817_192154_Chrome_1787012526501.jpg` — `34ca14d858fda097b6ac8134fe37195e6ec7f9652964e01cfba11d281b92bcda`
- `attached_assets/Screenshot_20260817_192720_Chrome_1787012851948.jpg` — `2899bd501fa243c8ec964093580ae0bd2599e7fbeeffdd2fa04c7e5aa0ce616f`
- `attached_assets/Screenshot_20260818_190433_Chrome_1787097976848.jpg` — `ebf16e73d6dddc6572a7bd45f412f267f0edb669e316d33e5a82e5f25cc26bed`
- `attached_assets/Screenshot_20260819_220116_Chrome_1787194889972.jpg` — `0b1846ccb769984b058fd76852f34856e8ad5a067b4f8457c15fe886df4556e8`
- `attached_assets/Screenshot_20260820_043725_Chrome_1787218823128.jpg` — `76acd12f91ced7d4a3b758a6060d5b64b0d2385e4afc5cdc205cff26274a1dd8`
- `attached_assets/Screenshot_20260820_050551_Chrome_1787220360515.jpg` — `8455208185440550248b6f1d99c0112ff93501a600fa8a21df07d582e11bbeb4`
- `attached_assets/Screenshot_20260820_051340_Chrome_1787220846250.jpg` — `e5a6aed16f4bec2c000719c4da6af838fb06312efbc154b07db6c5083f0ac9f3`
- `attached_assets/Screenshot_20260820_051340_Chrome_1787220876552.jpg` — `e5a6aed16f4bec2c000719c4da6af838fb06312efbc154b07db6c5083f0ac9f3`
- `attached_assets/Screenshot_20260823_130231_Replit_1787508169500.jpg` — `9b6e93608e03823267be55b1070495d506e56509bf2c0cdbdb99c29fe6d5c88b`
- `attached_assets/targeted_element_1783385027168.png` — `86b7cf95cfe5c4122982c68089ff6646f264c6547fa35bf7d3a74ad61a1d9ce9`
- `attached_assets/targeted_element_1785069278642.png` — `12e4bb0e0483e65ebf668bcb4ada4c9f0c0441c17305fc921b69d8eadf75c4c7`
- `attached_assets/targeted_element_1785072679615.png` — `36b32f552a28ff44f841ad268cc4bb41aecbf10c17cf8402ee987cf986bfed3f`

## EXACT-DUPLICATE — DELETE-CANDIDATE

Each row records original path and SHA-256. The section heading is the file classification and intended disposition. For exact frontend copies, the counterpart is above; duplicate-group membership is identifiable from the hash table above.

- `attached_assets/download_1782822787244.png` — `6227b63a4b0e9b53eda7cb0811b87354aaf5558af4276445de27fc07da09a34f`
- `attached_assets/download_1782822789845.png` — `5d6c7919ad1f29d66339d46da8177ea41b90b05d43a85b0b3763f7c33c96ae2d`
- `attached_assets/download_1782822789846.png` — `5d6c7919ad1f29d66339d46da8177ea41b90b05d43a85b0b3763f7c33c96ae2d`
- `attached_assets/download_1782822792125.png` — `af1c523d14b8b6798a829dc53b27e06cd118c20b09585f5fbea2f2900e88d959`
- `attached_assets/download_1782822798788.png` — `1a302462229aafa350d289fcc8cbf5fd8f46e11d078a320bb8a527187528a716`
- `attached_assets/file_000000009864722f99e7ebe650e291b6_1782891542101.png` — `5e7ce2fb27396f3176bd6dbf9f283c93248c4a26ed16b068715fdd917515033d`
- `attached_assets/fog_system_design_reference_1786537498533.png` — `f2c286d9ddedcbe29a3ea8d0cf48f008ee64621cf42c4d4f26d01bad1e05b33c`
- `attached_assets/fog_system_design_reference_1786549701098.png` — `f2c286d9ddedcbe29a3ea8d0cf48f008ee64621cf42c4d4f26d01bad1e05b33c`
- `attached_assets/generated_images/ch1-open-courtyard-evening.png` — `bf6bd6ce2c20bb36dace552fa40045b75e192d91bd08eb0343b085ebdcb535d5`
- `attached_assets/generated_images/ch1-open-courtyard-master-day.png` — `444126906835b82f89209f0fb2ab6e2013f575038146dc09b00fec2f5a2213f2`
- `attached_assets/generated_images/ch1-open-courtyard-night.png` — `56d49319b716d0bed6b049a92a272a5f1b072e9fc46c1d8621c2ca56fbfc15d9`
- `attached_assets/generated_images/hex-terrain-normal.png` — `34934b4871d7b15f304b8e705f017e21e6f1a8723ae7949469fdd37143846bf2`
- `attached_assets/image_1782822148784.png` — `1a302462229aafa350d289fcc8cbf5fd8f46e11d078a320bb8a527187528a716`
- `attached_assets/image_1782822159632.png` — `6227b63a4b0e9b53eda7cb0811b87354aaf5558af4276445de27fc07da09a34f`
- `attached_assets/image_1782822174838.png` — `5d6c7919ad1f29d66339d46da8177ea41b90b05d43a85b0b3763f7c33c96ae2d`
- `attached_assets/image_1782822209351.png` — `af1c523d14b8b6798a829dc53b27e06cd118c20b09585f5fbea2f2900e88d959`
- `attached_assets/image_1782869498381.png` — `61a303a4dea6576e42b87a33019ed73b94bf33cc2233b09f91a367fce8514c5e`
- `attached_assets/lotus-healing-ward-map_1782903283043.png` — `5e7ce2fb27396f3176bd6dbf9f283c93248c4a26ed16b068715fdd917515033d`

## UNKNOWN/REVIEW — BLOCKED

Each row records original path and SHA-256. The section heading is the file classification and intended disposition. For exact frontend copies, the counterpart is above; duplicate-group membership is identifiable from the hash table above.

- `attached_assets/17844089532077216382058212712901_1784408968804.png` — `909206eee73877e37c09c35b5c61ae444836acbccbd17f2be464590f5b46a66c`
- `attached_assets/17844089532077216382058212712901_1784410706439.png` — `909206eee73877e37c09c35b5c61ae444836acbccbd17f2be464590f5b46a66c`
- `attached_assets/17844089532077216382058212712901_1784411803285.png` — `909206eee73877e37c09c35b5c61ae444836acbccbd17f2be464590f5b46a66c`
- `attached_assets/17845150282191302274668722068973_1784515039619.png` — `c16b0f64bc5a78e273d990b9ba8efc6545e6adfa7e39737b235c0a0779c314fe`
- `attached_assets/17845150665915866511849247176404_1784515076090.jpg` — `047c00a6df3ce77183c490850548ef00d6d05704ca10b39879b7d1286cc63231`
- `attached_assets/17845150965605859155206108677572_1784515103610.jpg` — `fa9a203944d5ca7a7ec8c05a2aa40f3ed619cdebd2108bbe08de0f3d1a845665`
- `attached_assets/17845844555703255827037674690797_1784584478977.png` — `c16b0f64bc5a78e273d990b9ba8efc6545e6adfa7e39737b235c0a0779c314fe`
- `attached_assets/download_1782822800961.png` — `65c7f9c261431b90c34ce902d421e861b13630caf920619394f1b46ce99729e9`
- `attached_assets/file_000000003ad481fda02b1d7f986e955b_1785987953621.png` — `097f7a5f63938753764d19e73672e6dac087bb355dcba6cb4bcde5baeae410d6`
- `attached_assets/file_000000003ad481fda02b1d7f986e955b_1785988008380.png` — `097f7a5f63938753764d19e73672e6dac087bb355dcba6cb4bcde5baeae410d6`
- `attached_assets/file_00000000d1e4822fb52bfda594f468bb_1784602678279.png` — `4e3f7aea27ea5ce19a916409760e97f35cd79d42221b34c894159bff8f04c4ba`
- `attached_assets/file_00000000ddf481f6bb08bc2c5b2b2103_1787188692170.png` — `9435dcfefb812107b23bf6cc6df4563df16ff0a6cbc533f299a0471c2aee6523`
- `attached_assets/file_00000000ddf481f6bb08bc2c5b2b2103_1787211427937.png` — `9435dcfefb812107b23bf6cc6df4563df16ff0a6cbc533f299a0471c2aee6523`
- `attached_assets/file_00000000de4071f597062e74f6ffdceb_1783392304720.png` — `b768b4db5dcd0cb9a329da88356237e971aee859268c85a328dbeb130c2bb383`
- `attached_assets/file_00000000fffc822fb34b3f5e81fe2e82_1785962456342.png` — `d732bc27418ed997ee9ce2116c84358105529d9dbf3a4719783057dbb66d6f7e`
- `attached_assets/generated_images/hex-terrain-current.png` — `ed2057735029d846f02d4c0d615065b697bd43d683da09352afc928b209ae104`
- `attached_assets/generated_images/hex-terrain-reachable.png` — `1887f90d00a21f1081be50eba9ed2de0a56e4cdf39c34c97986b5f933df05803`
- `attached_assets/generated_images/hex-terrain-selected.png` — `3931fadfd306f00bd2d3cb652b68f63be295476d0caf49f9d86e783931ee80a5`
- `attached_assets/generated_images/journey_map_bg_day.png` — `043240a1a7e799a273f5f9ded0f1ebae5ef0ed230b394017aa1a18625244da2c`
- `attached_assets/generated_images/journey_map_bg_evening.png` — `5aa108d80c84dcbd9cc5a982e7b4ce4cbeac8eaa1700f20e9edca705514a423d`
- `attached_assets/image_1782567027891.png` — `1409bd4b6885a94eb792d5c49501213fd7c1eb6d066bba4bf59ed232fb736f7a`
- `attached_assets/image_1782653061160.png` — `179da1186f3035cdffbc50d0f5fea8b16e4016673d95e2bc94d2080b170a2da8`
- `attached_assets/image_1782653132098.png` — `7316365b0eaaf15095e38d678c7710f2883c5d0a73231d54f3ca606ecb1094d2`
- `attached_assets/image_1782653216443.png` — `63ffef924623033af2d73d1a0e20be39225a4190eefb44f32e07198d1e496c31`
- `attached_assets/image_1782653233754.png` — `a849d3bc0c9d73d9b6b585af50fec6f507ab2e7825a4d279e6d0ea33349f2512`
- `attached_assets/image_1782656905217.png` — `1fb710ee38b37213987c080297abff269a92503aa9b7a18ea6d8233d4f7855c2`
- `attached_assets/image_1782657181809.png` — `a6648a26ae3dcbfbcf3a47dad2d7cd8531f7e1c3a7f3bc8f2d641db049bd11f8`
- `attached_assets/image_1782657668177.png` — `6e755133ce94ce7abfb607509227956da20ceb143aba39ff7da8d2524fa15ea8`
- `attached_assets/image_1782657684550.png` — `8941a4197f7421c519ada99627eaf9f30c38c6870d1a4909407a2342e5fcfe4c`
- `attached_assets/image_1782663398774.png` — `1555b85293eeac6df32171598e991d2ed2918b0f45823da9df78c0c320dd4f90`
- `attached_assets/image_1782821622999.png` — `65c7f9c261431b90c34ce902d421e861b13630caf920619394f1b46ce99729e9`
- `attached_assets/image_1782832024502.png` — `f1b99294d0fd03e774862895c32cb285501369bae1f7d902405bd85486c91d5f`
- `attached_assets/image_1782832071826.png` — `fab22f6b2a9caee259eb863f1ed683f6ca51a6d3aa080a79fc279eac37c47670`
- `attached_assets/image_1782868364189.png` — `c667a9d1a8fbdd34191b70d1b58f3e40c1e552cc48b86fb85efaef0ad7adc29a`
- `attached_assets/image_1782912086059.png` — `5a58543fe6ceeca640f0ea6d30536bb0c402635860a9219fb075e5ae88e2be7d`
- `attached_assets/image_1784510265353.png` — `665d537f59810db24d86418779d56a254f912c16a01ac2498e2ca8baad1ad829`
- `attached_assets/image_1784510289961.png` — `bb35060f6cb41857b1c8bef142114f810e1c64c084a942d9a7994bde0629e17b`
- `attached_assets/image_1784510342454.png` — `3b88bfa55c706ec46fc17b2bc9e08628ec85e2ec8ab48c470a80846fe9570d95`
- `attached_assets/image_1784510353109.png` — `258bc094800505cf542b4e8c1324eb657e55346b48cca95e3ed14e9ae2075b48`
- `attached_assets/image_1784771501097.png` — `665d537f59810db24d86418779d56a254f912c16a01ac2498e2ca8baad1ad829`
- `attached_assets/image_1784771992689.png` — `38275ea42df5f12ecb58ee3a7dc5b551505f1f12991eebd459aef9f4bbd31f09`
- `attached_assets/image_1784772006514.png` — `d4657f842cbef844b3cfd821dae338549bfc9df0355400335d9eeb14dc809a97`
- `attached_assets/image_1784772012657.png` — `bb35060f6cb41857b1c8bef142114f810e1c64c084a942d9a7994bde0629e17b`
- `attached_assets/image_1784772021907.png` — `25e2ce7f309ad09825999f0dd9c471599ec3ea97d5776f0faa6db309e3fa2f9a`
- `attached_assets/image_1785976580042.png` — `2abe49c6b69644bdb256bb249c00dc59972171ac872b53064e6bb35030095543`
- `attached_assets/image_1785982686741.png` — `56bcc087709160c9231c43d63431c37568b80dcaef8dbb6f5fbe00ba7444a66c`
- `attached_assets/image_1786105530782.png` — `388660d64f2000dc907dd53667b446e8311026d9b5affc5962b293b8f29a5794`
- `attached_assets/image_1786105620820.png` — `388660d64f2000dc907dd53667b446e8311026d9b5affc5962b293b8f29a5794`
- `attached_assets/image_1786112682318.png` — `9ce67f5cd6e76a3c74bf33d8753d78af14be87de4f17f6e9709398b2f8ec08c0`
- `attached_assets/image_1786195398348.png` — `56467429abf20c0f633248fc632eaa1317cf50855693e997f82faf5e631b6bab`
- `attached_assets/image_1786506847983.png` — `a78466a12554b6bba0fbe162636a36e71d6ac3d7260c3d1177ec536c54c4758c`
- `attached_assets/image_1786535268140.png` — `808446341d9165118ddb87150dd0602a898bf876aa1f8314cc813163900f0233`
- `attached_assets/image_1786536402876.png` — `7dfcb02392a3fe1f84bcf470f806bfff1d3d4ba9428cf511e74ea4ef4314f707`
- `attached_assets/image_1786546128409.png` — `72724d5f8fe8d25bf82f7a7d8bbabb7386862d9c0daea4b4ee4246e80f99c31b`
- `attached_assets/image_1786546131504.png` — `7df2cae65430d27b9fd46257e015aca4c5a97337b138a8c90e620fde1cd8e216`
- `attached_assets/image_1786546653886.png` — `107ce952d78f1f71486d7f86ec171804e2acfaf9b40c9b63e1e8fb48d62ade11`
- `attached_assets/image_1786549473629.png` — `adeb2f667cba69beef1dd4015d560a8057f0ce8125075175ba5689571cc47a31`
- `attached_assets/image_1786760929660.png` — `a980a1e754fe4e83e2324c0b6417d6f88007ad4931aea51c7d469032711b148b`
- `attached_assets/nightingale_vn_extended_1785071475813.png` — `a263f0c6c7289ecf7264d8d710d6cf9c131dec41d18b0f1183d142b964f26716`
- `attached_assets/rush-royale-victory-400x711-1.jpg_1782787205978.webp` — `3dab3ac13d19e47b4013ef016ac1fc5e8fd7374f76e843da9780226b4b0c1071`
- `attached_assets/unnamed_1782787206011.webp` — `897c0b1b8f5c306b96d52700146393915931ca932dfdc5e1234316344a329ce1`

## Non-destructive cleanup rule

Future deletion must be limited to an explicit candidate that is both hash-proven duplicate and reference-proven noncanonical, after unique material is preserved and owner-approved review is complete.
