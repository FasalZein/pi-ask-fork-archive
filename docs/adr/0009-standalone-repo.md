# pi-ask moves to a standalone repository and restarts at 1.0.0

pi-ask moves from the GitHub fork of `eko24ive/pi-ask` to the standalone (non-fork) repository `FasalZein/pi-ask`. The old fork becomes `FasalZein/pi-ask-fork-archive` and is archived. Open issues move to the new repository. The first release of the new repository is 1.0.0. This decision supersedes the versioning part and the "fork" wording of ADR 0004.

ADR 0004 continued the upstream 1.x line only because upstream tags `v1.0.0` to `v1.2.0` came back with every `git fetch upstream`. The new repository has no upstream remote, so 1.0.0 is free. Local clones must remove the `upstream` remote and its tags, or the old upstream `v1.0.0` tag collides with the new one.

ADR 0004 still decides these points: the package name `@fasalzein/pi-ask`, the config file `pi-ask.json` with the legacy fallback, the bridge channels, the tool name `ask_user` and the slash command names, install from GitHub, and no npm publication. Releases stay manual GitHub releases.
