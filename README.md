![pi-ask main image](docs/media/pi-ask-main.png)

# @fasalzein/pi-ask

[![last commit](https://badgen.net/github/last-commit/FasalZein/pi-ask)](https://github.com/FasalZein/pi-ask/commits/main)
[![stars](https://badgen.net/github/stars/FasalZein/pi-ask)](https://github.com/FasalZein/pi-ask/stargazers)

pi-ask is a [pi](https://pi.dev) extension. It gives the agent an `ask_user` tool. When the agent needs a decision, it stops and asks you structured questions in a terminal UI. You answer, and the agent continues with normalized answers instead of a guess.

## Install

pi-ask needs pi 0.84.0 or later. The project checks run against pi 0.87.1 and against the 0.84.1 floor.

```bash
pi install git:github.com/FasalZein/pi-ask
```

To try it for one run without an install:

```bash
pi -e git:github.com/FasalZein/pi-ask
```

pi-ask is not published to npm. Install it from GitHub.

## Features

- Tabbed questions. Each tab shows `○` when the question has no answer and `●` when it has one. The last tab is the Review tab.
- Three question types: single select, multi select, and preview. A preview question shows extra text for each option. Press `t` to change the type of the active question.
- `(recommended)` markers on the options that the agent prefers. pi-ask never selects them for you.
- `Type your own`: a free-text answer for every question.
- `@` file references in answer and note editors, as in pi's main editor.
- `/` skill list in answer and note editors. Tab inserts the highlighted skill as `/skill:<name>`. Enter keeps the literal text that you typed.
- Skills that you name in an answer load after the ask result. See [Skills and pi-better-skills](#skills-and-pi-better-skills).
- `Ctrl+V` (`Alt+V` on Windows) pastes a clipboard image as a temporary file path, as in pi's main editor. This needs pi 0.86.0 or later. On pi 0.84.1 the key inserts nothing.
- Notes: `n` adds a note to an option, and `Shift+N` adds a note to the question.
- Review tab with three actions: Submit returns the answers, Elaborate asks the agent to reply to your notes first, and Cancel closes the ask without answers.
- Long lists and review answers page with `Shift+Up`/`Shift+Down` or `PageUp`/`PageDown`. In pi fullscreen on pi-tui 0.85.0 or later, the mouse wheel scrolls them too.
- Long previews scroll with `[` and `]`.
- A waiting indicator in the pi footer and the terminal title while an ask is open. Optional notifications (terminal bell or a shell command) tell you that a question waits.
- Settings with `?` in the ask flow or `/ask-settings` in pi. You can change the keys of the ask flow. The number keys `1` to `9` and `@` are fixed.
- Recovery: if pi stops while an ask is open, pi-ask opens the unanswered ask again on startup, resume, fork, or `/tree` navigation. After you submit or cancel the recovered ask, it does not open automatically again.
- RPC mode uses pi dialogs. Other extensions in the same pi process can follow and answer an ask through local events. See [`docs/remote-events.md`](docs/remote-events.md).

## Commands

| Command | Effect |
|---|---|
| `/ask-settings` | Open the pi-ask settings. The settings screen also shows the path of the configuration file. |
| `/answer` | Extract the questions from the latest assistant message and open them as an ask. Use it when the agent asked in plain text. |
| `/answer:again` | Open the latest `/answer` form on the current branch again. |
| `/ask:replay` | Open the latest `ask_user` form on the current branch again. The main editor shortcut is `Ctrl+Shift+R`. |

The replay commands read only the current session branch. If you cancel a replayed form, the agent does not start a new turn. If you submit it, pi-ask sends the answers as a user message.

## Configuration

The configuration file is `~/.pi/agent/extensions/pi-ask.json`. It holds the behaviour switches, notifications, key bindings, the replay shortcut, and the `/answer` extraction models. After you edit the file, run `/reload` or restart pi.

You can also ask the agent to change the configuration. Mention `/ask-settings`, `pi-ask settings`, `keymap`, or `keybinding`, and pi-ask tells the agent to read the configuration guide first.

- [`docs/configuration.md`](docs/configuration.md): all settings, the default key bindings, and the key rules.
- [`docs/contract.md`](docs/contract.md): the tool input and output, and the full keyboard behavior.

## Skills and pi-better-skills

pi-ask works alone. Without other extensions, the `/` list uses pi's own skill ranking. When your answer names a known skill, pi-ask adds pi's `<skill>` block for that skill to the ask result.

[pi-better-skills](https://github.com/edxeth/pi-better-skills) is an optional pi extension. When it provides its skill API, pi-ask uses it for these features:

- The `/` list uses the same skill ranking as pi's main editor.
- pi-better-skills loads the skills that you name, with its `<skill_context>` directories and the skills that those skills reference.
- A skill that is already loaded in the session does not load a second time.

The skill API uses the event channel `pi-better-skills:request`, version 1. No released version of pi-better-skills has this API yet. The API is on the `feat/skill-delivery-api` branch of the FasalZein/pi-better-skills fork and waits for an upstream pull request. With a released pi-better-skills version, pi-ask works as it does alone.

## Local development

Run the extension from a checkout:

```bash
pnpm install
pi -e ./src/index.ts
```

`pnpm dev [path]` starts pi with only this extension loaded, in the folder `[path]`.

Run the four gates before you commit:

```bash
pnpm test
pnpm typecheck
pnpm run check:ci
pnpm run check:pi-floor
```

`pnpm run check:pi-floor` runs the typecheck and the tests against pi 0.84.1 in a temporary copy. Commit messages use conventional commits. `pnpm commit` helps you write one.

## Documentation

See [`docs/README.md`](docs/README.md) for the documentation index.

## Credits

This project is a fork of [`@eko24ive/pi-ask`](https://github.com/eko24ive/pi-ask) by eko24ive. The fork keeps the MIT license and the original copyright. See [`LICENSE`](LICENSE).

The `/answer` command came from an idea by [@k0valik](https://github.com/k0valik).
