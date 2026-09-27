# Changelog

# 1.0.0 (2026-09-27)

This is the first release of the standalone repository `FasalZein/pi-ask`. pi-ask started as a fork of `@eko24ive/pi-ask` 1.2.0. The fork releases 1.3.0 and 1.4.0 and their history are in `FasalZein/pi-ask-fork-archive`.

**Note for users of the fork:** a pinned ref such as `@v1.4.0` does not exist in this repository. Use `pi install git:github.com/FasalZein/pi-ask` or `pi install git:github.com/FasalZein/pi-ask@v1.0.0`.

Changes since fork 1.4.0:

### Features

* Skills that you name with `/skill:name` in an answer or note load after the ask result.
* Typing `/` in answer and note editors opens the list of pi skills. Tab inserts the selected skill. Enter keeps the literal text.
* Question tabs show `○` for unanswered and `●` for answered questions.
* `Ctrl+V` (pi's paste image key) pastes a clipboard image into answer and note editors as a file path.
* The preview box uses only the rows it needs and fits the free terminal height.

### Bug Fixes

* The settings overlay keeps a fixed height, pads the cursor row, and shows how many settings are hidden above and below.
* Options and review actions use the same ` ▶ ` focus pointer. Footers stay on one line. Option notes align with the option description.
* Revert ask behavior changes that the user did not request: the ask tool has no question limit, hidden configuration advice appears only for `/ask-settings`, `pi-ask setting`, `pi-ask settings`, `keymap`, or `keybinding`, and the settings focus pointer matches the question and review screens.
* The pi-better-skills integration uses the stable request channel `pi-better-skills:request`, version 1.

### Documentation

* The README is rewritten.

### Maintenance

* The behavior harness installs the upstream baseline into a temporary prefix.
