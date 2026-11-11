# Bordena delivery contract

Product: `team.chopik.bordena`. Stable Windows x64 uses machine SemVer; user label is separate (`1.0.0` / `W 1.0`). Dev bindings remain independent.

Official endpoint: `https://github.com/chopik-team/Bordena/releases/latest/download/bordena-release.json`. It is not considered live until a verified public release exists. No fake release is required for setup.

The JSON envelope contains an exact UTF-8 JSON string and its encoded Minisign signature. The signed payload names the installer, SHA-256, byte size, platform, channel, version and installer signature. Both signatures authenticate the machine version. The long-lived public key is in `trust/bordena.pub`; Launcher embeds its own copy. Never place a private key in this directory or a release artifact.

Launcher source integration: `src-tauri/src/product_delivery.rs`, existing `InstallationControls`, bridge and application registry. Catalog entries remain descriptive data and cannot supply commands, local paths or installer arguments. The native policy fixes repository, HTTPS hosts, product, architecture, NSIS switches and local destination. It accepts only newer Stable versions. Direct NSIS installation registers the product in HKCU `Software\CHOPIK\Applications\team.chopik.bordena` (InstallPath, Version, ProductId, Channel); the executable's x64 PE and FileVersion must agree. Unknown portable bindings remain launchable but require official NSIS registration before managed updates.

Installation downloads to an isolated temporary cache, bounds the byte count, verifies both signatures and hash, refuses known running Bordena processes, and reserves an installer mutex. A verified readback snapshot of the previous program directory is retained in the Launcher cache. NSIS never silently kills the app. Post-install checks registration, version and destination before updating the existing installation registry. User data stays in the unchanged Bordena profile, outside the program directory. Bordena has no competing built-in updater.

Automatic checks follow Launcher's existing auto-check preference; installing a discovered update starts from its card. Failures leave the installed app launchable offline. A partial NSIS failure retains prior program files; the owner can use a verified previous installer or retained program snapshot for recovery. This is not a claim of automatic transactional Windows registry rollback.

Local release: build NSIS, then `node scripts/release/package.mjs`; it verifies Windows metadata and signs installer plus metadata. Verify with `cargo run --locked --manifest-path tools/release-verify/Cargo.toml -- <metadata> <installer> <machine-version>`. CI signing reads protected environment secrets; local signing uses an account-protected key outside the repository. Configure secure owner backup/CI secrets before relying on another build machine; never rotate the key casually.

Native staging uses only feature `qa`, Launcher identifier `team.chopik.launcher.aw05-qa`, Bordena identifier `team.chopik.bordena.release-qa`, isolated profiles and a loopback HTTPS fixture. Production compilation excludes the fixture transport and local-package QA command. Staging 1.0.1 is never published as Stable. Evidence and remaining clean-OS/public-source checks are recorded in the release checklist.

Errors covered: unavailable service/offline, oversized or interrupted download, wrong hash/signature/version/architecture/channel/source, running app, repeated update, failed installer and recovery snapshot. A missing/removed official installation offers reinstall; no current version is hardcoded in the frontend.
