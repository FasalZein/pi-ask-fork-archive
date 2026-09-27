# The fork ships as @fasalzein/pi-ask, installed from GitHub

Superseded in part by [0009](0009-standalone-repo.md): the repository is standalone and versions restart at 1.0.0.

This fork of `eko24ive/pi-ask` (upstream) becomes its own product named `@fasalzein/pi-ask`. It is not published to npm. Users install it from GitHub with pi's git install, and the README credits `@eko24ive/pi-ask` as the origin.

- The config file is `pi-ask.json`. If it is missing, the old `eko24ive-pi-ask.json` loads as a legacy source. Saves go to the new file, and the old file is never modified.
- Remote bridge channels are `pi-ask:started`, `pi-ask:completed`, `pi-ask:submit`, and `pi-ask:submit-result`. The names are short but still namespaced, because `pi.events` is one bus shared by every extension.
- The tool name `ask_user` and the slash commands keep their names, because model-facing text and user habits depend on them.
- Versions continue the upstream 1.x line: the first fork release is 1.3.0. Upstream tags `v1.0.0` to `v1.2.0` come back with every `git fetch upstream`, so a fresh 1.0.0 would collide with them. Releases are manual GitHub releases, and the semantic-release workflow is off: it would publish to npm and bump the major version on breaking commits.
