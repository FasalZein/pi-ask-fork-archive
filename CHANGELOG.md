## Unreleased

* Remove the question cap; the ask tool has no question limit.
* Narrow hidden configuration advice to `/ask-settings`, `pi-ask setting` or `pi-ask settings`, `keymap`, and `keybinding`.
* Align the settings focus pointer with the question and review screens (` ▶ `).

# [1.4.0](https://github.com/FasalZein/pi-ask/compare/v1.3.0...v1.4.0) (2026-09-26)

### BREAKING CHANGES

* `PI_ASK_PROMPT_MODE` and full mode are removed. The compact tool text and schema are the only fork format. The extension no longer replaces the system prompt, avoiding the thinking-drop cause on `triggerTurn` runs. ([#61](https://github.com/FasalZein/pi-ask/issues/61))

### Bug Fixes

* restore the upstream v1.2.0 review screen, tab bar, and `(recommended)` subtitle; remove the progress header and review row navigation ([#62](https://github.com/FasalZein/pi-ask/issues/62))

# [1.3.0](https://github.com/FasalZein/pi-ask/compare/v1.2.0...v1.3.0) (2026-09-25)

First release of the fork `@fasalzein/pi-ask`. It is installed from GitHub (`pi install git:github.com/FasalZein/pi-ask`), not from npm. It covers every change since upstream `@eko24ive/pi-ask` 1.2.0.

### BREAKING CHANGES

* **Package name:** the package is `@fasalzein/pi-ask`. Replace `npm:@eko24ive/pi-ask` with `git:github.com/FasalZein/pi-ask` in pi settings. Do not load both: the first `ask_user` registration wins. ([#8](https://github.com/FasalZein/pi-ask/issues/8))
* **Config file:** settings save to `~/.pi/agent/extensions/pi-ask.json`. If that file is missing, `eko24ive-pi-ask.json` loads as a read-only fallback; it is never modified. ([#8](https://github.com/FasalZein/pi-ask/issues/8))
* **Bridge channels:** remote event names change from `@eko24ive/pi-ask:*` to `pi-ask:started`, `pi-ask:completed`, `pi-ask:submit`, and `pi-ask:submit-result`. Update any bridge extension. ([#8](https://github.com/FasalZein/pi-ask/issues/8))
* **Bundled skill removed:** the package no longer ships the `ask-user` skill. ([#48](https://github.com/FasalZein/pi-ask/issues/48))

### Features

* compact prompt mode (`PI_ASK_PROMPT_MODE=compact`): shorter tool text, follow-up rules in the tool text, option labels as identifiers with derived values, no question limit, and configuration guidance only when the prompt mentions pi-ask settings ([#13](https://github.com/FasalZein/pi-ask/issues/13), [#17](https://github.com/FasalZein/pi-ask/issues/17), [#30](https://github.com/FasalZein/pi-ask/issues/30), [#33](https://github.com/FasalZein/pi-ask/issues/33), [#38](https://github.com/FasalZein/pi-ask/issues/38), [#47](https://github.com/FasalZein/pi-ask/issues/47)). Full mode stays the default and keeps the upstream 1.2.0 text.
* refreshed TUI: question screen, progress header and text tabs, paged navigation, review summary with question rows, pi border and editor theme tokens, capped preview text with scroll counts, and mouse wheel scrolling ([#15](https://github.com/FasalZein/pi-ask/issues/15), [#21](https://github.com/FasalZein/pi-ask/issues/21), [#22](https://github.com/FasalZein/pi-ask/issues/22), [#23](https://github.com/FasalZein/pi-ask/issues/23), [#25](https://github.com/FasalZein/pi-ask/issues/25), [#26](https://github.com/FasalZein/pi-ask/issues/26), [#27](https://github.com/FasalZein/pi-ask/issues/27))
* RPC mode opens pi dialogs and emits bridge lifecycle events ([#14](https://github.com/FasalZein/pi-ask/issues/14))
* live partial answers through tool updates while the ask flow is open ([#19](https://github.com/FasalZein/pi-ask/issues/19))
* waiting indicator in the footer and the terminal title ([#18](https://github.com/FasalZein/pi-ask/issues/18))
* cancel reasons in ask results ([#9](https://github.com/FasalZein/pi-ask/issues/9))
* transcript markers for ask entries and labels in the session tree ([#6](https://github.com/FasalZein/pi-ask/issues/6), [#35](https://github.com/FasalZein/pi-ask/issues/35))
* `/skill:` completion in ask editors ([#29](https://github.com/FasalZein/pi-ask/issues/29))
* configurable replay shortcut for `/ask:replay`, default `Ctrl+Shift+R` ([#36](https://github.com/FasalZein/pi-ask/issues/36))

### Bug Fixes

* `/answer` retries a deferred extraction response ([#4](https://github.com/FasalZein/pi-ask/issues/4))
* notification commands run through `pi.exec` ([#5](https://github.com/FasalZein/pi-ask/issues/5))
* the settings overlay fits the terminal ([#7](https://github.com/FasalZein/pi-ask/issues/7))
* recovered asks pair with their request context, also after `/tree` navigation ([#10](https://github.com/FasalZein/pi-ask/issues/10), [#12](https://github.com/FasalZein/pi-ask/issues/12))
* aborted ask flows close, and recovery survives quit ([#11](https://github.com/FasalZein/pi-ask/issues/11))
* guard the private pi-tui autocomplete trigger ([#29](https://github.com/FasalZein/pi-ask/issues/29))
* compact mode keeps `ask_user` active in print and JSON sessions, so a headless model gets the "Needs user input" result and stops ([#54](https://github.com/FasalZein/pi-ask/issues/54))

### Compatibility

* Supports pi 0.84.0 and later; built against pi 0.87.1. CI tests the 0.84.1 floor ([#3](https://github.com/FasalZein/pi-ask/issues/3)).

# [1.2.0](https://github.com/eko24ive/pi-ask/compare/v1.1.0...v1.2.0) (2026-08-16)


### Bug Fixes

* align ask_user payload validation ([852e625](https://github.com/eko24ive/pi-ask/commit/852e625d86fdaac27e3774c5a8101abd4345700a))
* restore pending asks after resume ([4de596a](https://github.com/eko24ive/pi-ask/commit/4de596ae540088663e94690c20d85c29c7f02d20))
* surface unanswered ask_user questions ([ce230db](https://github.com/eko24ive/pi-ask/commit/ce230db275cb36685598997287801570ae538781))


### Features

* mark recommended ask options ([bd5f452](https://github.com/eko24ive/pi-ask/commit/bd5f4520a356c643eef5d3da2ac76bf56b9d46b4))
* use tool calls for answer extraction ([0145055](https://github.com/eko24ive/pi-ask/commit/0145055445eaca53531dd8c460379dddebd66534))

# [1.1.0](https://github.com/eko24ive/pi-ask/compare/v1.0.2...v1.1.0) (2026-06-22)


### Bug Fixes

* refresh pi dependency compatibility ([d6db94a](https://github.com/eko24ive/pi-ask/commit/d6db94a39d37fda632d53147592af8f53aa50e4b))


### Features

* add remote ask event contract ([69e8bab](https://github.com/eko24ive/pi-ask/commit/69e8bab6efbc0394aecb9ce416eea27da755a5df)), closes [#6](https://github.com/eko24ive/pi-ask/issues/6)

## [1.0.2](https://github.com/eko24ive/pi-ask/compare/v1.0.1...v1.0.2) (2026-05-31)


### Bug Fixes

* avoid destructive ask config writes ([fa89c15](https://github.com/eko24ive/pi-ask/commit/fa89c1551a509690dee767165124450aac322c58))

## [1.0.1](https://github.com/eko24ive/pi-ask/compare/v1.0.0...v1.0.1) (2026-05-22)


### Bug Fixes

* avoid config docs supply-chain false positive ([5d12c2f](https://github.com/eko24ive/pi-ask/commit/5d12c2fb8da82ca538999be65f58595c8aa54dde))
* clarify ask_user prompt guidelines ([4afbe62](https://github.com/eko24ive/pi-ask/commit/4afbe62a42c80b13b8c77112a25cc68ab18ea3fa))

# [1.0.0](https://github.com/eko24ive/pi-ask/compare/v0.9.0...v1.0.0) (2026-05-22)


* feat!: migrate to latest pi packages ([a987406](https://github.com/eko24ive/pi-ask/commit/a9874062a50d4073a5379667620e1f2e457148a2))


### BREAKING CHANGES

* pi dependencies moved from @mariozechner/* to @earendil-works/*.

Consumers must use the latest pi package scope.

# [0.9.0](https://github.com/eko24ive/pi-ask/compare/v0.8.1...v0.9.0) (2026-05-06)


### Bug Fixes

* remove footer navigation hints ([45d8302](https://github.com/eko24ive/pi-ask/commit/45d8302e0a2e1527f0129bbb53fec38927a722ac))


### Features

* add ask notifications ([43cee4c](https://github.com/eko24ive/pi-ask/commit/43cee4c0f0cbbaf9673b67ca300ff5b05117819c))
* add context-aware ask keymaps ([808b62c](https://github.com/eko24ive/pi-ask/commit/808b62cc77ee23093f2f672679ada1c34ec1a978))
* add guarded config reset ([b218b8b](https://github.com/eko24ive/pi-ask/commit/b218b8b1889b163e5bd21fcb5083250921404a02))
* add question type presentation controls ([f1a0a5d](https://github.com/eko24ive/pi-ask/commit/f1a0a5d5e5eb3591b90200921e88660517830dec))

## [0.8.1](https://github.com/eko24ive/pi-ask/compare/v0.8.0...v0.8.1) (2026-05-03)


### Bug Fixes

* multi-select custom answer toggling ([780aac2](https://github.com/eko24ive/pi-ask/commit/780aac24cf58e144a8ab3ba6a29a75cf6fbf2656))
* refine ask tool context typing ([cbabd44](https://github.com/eko24ive/pi-ask/commit/cbabd44acc0fadd4959602e8aa73c1c106856aad))

# [0.8.0](https://github.com/eko24ive/pi-ask/compare/v0.7.0...v0.8.0) (2026-05-02)


### Bug Fixes

* rename settings modal title ([4feeec9](https://github.com/eko24ive/pi-ask/commit/4feeec9f0f535b4a129c8ce5d0f310f1365c6010))


### Features

* add answer extraction replay commands ([5b70eca](https://github.com/eko24ive/pi-ask/commit/5b70eca306e15335e0a24754280c1ea6d9787bbf))
* **config:** add migration framework ([288caf4](https://github.com/eko24ive/pi-ask/commit/288caf49de4a78e35845187f736b9685f732c5cc))

# [0.7.0](https://github.com/eko24ive/pi-ask/compare/v0.6.1...v0.7.0) (2026-04-29)


### Bug Fixes

* **package:** declare bundled skills in pi manifest ([3c26bfa](https://github.com/eko24ive/pi-ask/commit/3c26bfa7c995fd4fb22d391db784ceaf76594e4c))
* pass custom answers through elaborate output ([85962d9](https://github.com/eko24ive/pi-ask/commit/85962d985d7a8064093f8643f4706d8d98888050))


### Features

* add ask settings modal shell ([5c0d896](https://github.com/eko24ive/pi-ask/commit/5c0d8964fba099e85472c42ab442bd5b86480de1))
* add config-backed ask keymaps ([e8a36b7](https://github.com/eko24ive/pi-ask/commit/e8a36b72eff4f43f8d3944846dbe58bb605210a9))
* add dirty-dismiss and footer hint settings ([18120e8](https://github.com/eko24ive/pi-ask/commit/18120e880119cff23e2fdc2cf49cdf3fbb512829))
* add review shortcut confirmation setting ([67891d1](https://github.com/eko24ive/pi-ask/commit/67891d147f4bde4bb84edc1e8eca4d91786c1056))
* bootstrap ask config on first use ([2bf85b3](https://github.com/eko24ive/pi-ask/commit/2bf85b3f6f19a71972df8b989ccc6670397c4e38))
* **ui:** add ask keymap help modal ([c9930b4](https://github.com/eko24ive/pi-ask/commit/c9930b494f89320498db9b9828415f331605c3ff))

## [0.6.1](https://github.com/eko24ive/pi-ask/compare/v0.6.0...v0.6.1) (2026-04-27)


### Bug Fixes

* remove automatic lefthook install ([4f1c598](https://github.com/eko24ive/pi-ask/commit/4f1c59818137cbcd335d5153c835e3f420aab575))

# [0.6.0](https://github.com/eko24ive/pi-ask/compare/v0.5.1...v0.6.0) (2026-04-25)


### Bug Fixes

* **ui:** tighten ask layout rendering ([3515098](https://github.com/eko24ive/pi-ask/commit/351509838cd14ad251ca4b152c0bb4577c9d7b79))


### Features

* **ui:** improve narrow-screen tab and footer rendering ([1ce7210](https://github.com/eko24ive/pi-ask/commit/1ce721094c21faf6180098a7244b6f2abd13623e))
* **ui:** split submit tab into actions and review ([b59c967](https://github.com/eko24ive/pi-ask/commit/b59c967d985a6f62dc32da3b4f2c5767d01608a9))
* **ui:** support custom answers in preview questions ([7cca5eb](https://github.com/eko24ive/pi-ask/commit/7cca5eb54d1964d19ce17ebb45507f1939960b8b))

## [0.5.1](https://github.com/eko24ive/pi-ask/compare/v0.5.0...v0.5.1) (2026-04-25)


### Bug Fixes

* **skills:** align bundled skill name with folder ([005151f](https://github.com/eko24ive/pi-ask/commit/005151f79ba562c08e0fe9b5bccf59e964c02a32))

# [0.5.0](https://github.com/eko24ive/pi-ask/compare/v0.4.0...v0.5.0) (2026-04-24)


### Features

* add submit screen number hotkeys ([c10c61f](https://github.com/eko24ive/pi-ask/commit/c10c61f1ebb061dab1daf7404089ce6b57c8917c))
* **skill:** add ask-user decision gate profile ([6d9cb5b](https://github.com/eko24ive/pi-ask/commit/6d9cb5b7bfde54c7522f8e8321046161af296dad))

# [0.4.0](https://github.com/eko24ive/pi-ask/compare/v0.3.0...v0.4.0) (2026-04-24)


### Features

* improve ask flow elaboration and validation ([b7c7301](https://github.com/eko24ive/pi-ask/commit/b7c7301f974c81eb82070810304a9267f62d7699))

# [0.3.0](https://github.com/eko24ive/pi-ask/compare/v0.2.0...v0.3.0) (2026-04-23)


### Bug Fixes

* allow empty editor navigation shortcuts ([5d7ccc8](https://github.com/eko24ive/pi-ask/commit/5d7ccc8ce2e45c70a36932f048a90419dcb59304))


### Features

* harden ask tool validation and fallback ([050e880](https://github.com/eko24ive/pi-ask/commit/050e8800cdcd97be635bb95d9500a309d207f7f8))

# [0.2.0](https://github.com/eko24ive/pi-ask/compare/v0.1.1...v0.2.0) (2026-04-19)


### Bug Fixes

* improve custom input editor rendering ([bc92712](https://github.com/eko24ive/pi-ask/commit/bc9271205335bb9e610f8cd0c6e86bea5ce22f4b))
* keep arrow keys and tab inside editor mode ([cdea90b](https://github.com/eko24ive/pi-ask/commit/cdea90bbfe726f4edca131513cf96e81a5307782))
* polish ask note spacing and styling ([e0e2b04](https://github.com/eko24ive/pi-ask/commit/e0e2b046883b9d07745a6178c49cfef25e771424))
* preserve multi-select choices with custom answers ([8d8e7b6](https://github.com/eko24ive/pi-ask/commit/8d8e7b67c97e796de0e44b8935960a8d39b55360))


### Features

* refine ask submit screen layout ([d5ca38e](https://github.com/eko24ive/pi-ask/commit/d5ca38e621f701af466a9b67005708ebd176bbf0))
* sharpen ask_user tool guidance ([4a131f7](https://github.com/eko24ive/pi-ask/commit/4a131f7752f17f2f91fd6669e45a74888240d86e))
* simplify ask UI copy and note shortcuts ([9ab368a](https://github.com/eko24ive/pi-ask/commit/9ab368ad6bebdf26d8a4be7de71ac415eea06285))
* support @ file autocomplete in ask editor ([0386239](https://github.com/eko24ive/pi-ask/commit/0386239f5e4165281b40db540d129d86c8af63d4))
* support ctrl+c dismissal in ask flow ([fcd1f1b](https://github.com/eko24ive/pi-ask/commit/fcd1f1bce5120af07c7d6499591295e4bccf6a55))

## [0.1.1](https://github.com/eko24ive/pi-ask/compare/v0.1.0...v0.1.1) (2026-04-19)


### Bug Fixes

* relax toolchain pinning for release workflow ([549c2c2](https://github.com/eko24ive/pi-ask/commit/549c2c26f04f5c2d6b7b3f6487a7a72303f998bb))
* remove toolchain pinning from repo ([5b10568](https://github.com/eko24ive/pi-ask/commit/5b105683c35dc02df1e1e0fc6132a46283c25d1b))
* specify pnpm version in workflows ([08e053f](https://github.com/eko24ive/pi-ask/commit/08e053f095ed5ccc68a367f03c07a30b31683b3c))

# [0.1.0](https://github.com/eko24ive/pi-ask/compare/v0.0.0...v0.1.0) (2026-04-19)


### Bug Fixes

* skip git hooks during release commits ([32c2ae7](https://github.com/eko24ive/pi-ask/commit/32c2ae785c16ab2482f9f2a09d19c8eeed8cae8e))
* update release tooling for trusted publishing ([85f4ec5](https://github.com/eko24ive/pi-ask/commit/85f4ec5128ba4554412e3409d9f353fb66981f35))


### Features

* bootstrap first public release ([552959f](https://github.com/eko24ive/pi-ask/commit/552959f7ad3b40a9f3f8443d301a2c6f2340477d))

# Changelog

All notable changes to this project will be documented in this file.

The format is driven by semantic-release.
