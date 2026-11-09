# Sol Heredit Trainer integration

The goal is to run **our own build** of the Sol Heredit Trainer under the
x0XP website, so gameplay and interface changes can be made independently.

## Source

The importer in .github/workflows/import-sol-trainer.yml copies the complete
public source tree (including its licence and media assets) into
sol-trainer-source/, pinned to upstream commit
b53022c72b91827becb3ba75d2961adce3e0bd3c on the colosseum branch.

The import runs once and refuses to overwrite existing local source changes.
Both website branches are updated to the same imported revision.

## Build prerequisites

This is a Node 20 / TypeScript / React project using the OSRS SDK. It cannot
run from GitHub Pages directly as uncompiled source. It needs a Webpack build
and an OSRS asset manifest. The source's assets.md, netlify.toml, and
scripts/build-beta.sh document the pinned cache and SDK build requirements.

**Do not add a homepage launch button** until the built simulator has passed
a functioning browser test on our own hosting. A dead simulator link would
regress the existing site.

## Legal

The source is GPL-3.0-licensed. Keep the included LICENSE, applicable
copyright notices, and corresponding source available when publishing
modified builds. A homepage attribution card or original-site link is not
part of the planned x0XP UI.

## Next integration steps

1. Verify the complete import and install/build dependencies with Node 20.
2. Configure game asset hosting and base paths for /sol-trainer/.
3. Produce and test the static build.
4. Add an x0XP homepage tool that opens our hosted version in the existing
   sliding-screen system, without embedding the original developer's site.
