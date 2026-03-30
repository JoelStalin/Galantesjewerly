# Android Deployment Strategy

## Constraint

The repository must remain fully dockerized, but the deployment target includes Android contexts where Docker support cannot be assumed.

## Viability Matrix

| Option | Verified viability | Main constraint | Final verdict |
| --- | --- | --- | --- |
| Android + Docker native | No official support found in Docker docs | Docker Desktop targets Mac, Linux, and Windows; Docker Desktop for Linux itself requires a VM and KVM support | Rejected |
| Android + Linux VM on device | Conditionally viable | depends on device support, virtualization stack, RAM, storage, and a guest OS where Docker is actually supported | Allowed only when explicitly verified |
| Android + Termux or proot standalone Node runtime | Viable for this repo | not a true Docker host; must run the standalone bundle directly and keep persistent data outside transient build directories | Supported fallback |
| Android as operator controlling a remote Linux Docker host | Fully viable and most robust | requires network reachability to the remote host | Recommended |

## Final Recommendation

Use Android as the operator device and run the Docker stack on a real Linux Docker host. This preserves the required Docker packaging without pretending that Android itself is a first-class Docker host.

## Fallback Recommendation

If the service must run on the Android device itself:

- do not treat the Android device as a Docker-native platform
- build the standalone bundle elsewhere or on-device if resources allow
- run the standalone Node server through Termux
- export `APP_DATA_DIR` to stable device storage
- keep Cloudflare Tunnel or equivalent user-managed network tooling outside the app bundle

## Observed Device Results

Validated on `u0_a325@192.168.12.193:8022` on 2026-03-25:

- the app can run directly in Termux on the Android device
- Next.js 16.2.1 required `next build --webpack` on `android/arm64`; Turbopack failed on that host because only WASM bindings were available
- `sharp` did not load on `android-arm64`, so the repo now falls back to validated passthrough storage on that host
- `termux-services` plus `runit` successfully supervised the app and respawned it after a forced kill
- `~/.termux/boot/00-start-services` was installed and is ready for reboot startup

## Reboot Autostart Requirement

Reboot startup on this host is prepared but not yet activatable by shell alone because:

- `com.termux.boot` is not installed on the device
- the shell user does not hold `android.permission.DEVICE_POWER`, so it cannot whitelist Termux from battery restrictions programmatically

That means the repo now contains the correct boot script and supervised service, but the device owner still has to:

- install the matching `Termux:Boot` add-on from the same source as the installed Termux app
- open the `Termux:Boot` app once after installation
- disable Android battery optimization for Termux

## AVF / VM Note

Android Virtualization Framework exists on supported ARM64 devices. That means an Android device can host isolated virtualized workloads only when the hardware and firmware support it. This does not remove the need to verify a real Linux guest with Docker support before calling the Android device a valid Docker host.

## Android-Specific Risks

- storage permissions and storage path stability
- background process limits and process killing
- lower RAM and I/O ceilings than a server host
- unpredictable long-running service behavior on consumer devices
- lack of official Docker Desktop targeting for Android

## Storage and Session Notes

- images must not live only inside a transient container filesystem
- the selected contract is externalized persistent storage through `APP_DATA_DIR`
- session persistence on Android browsers depends on browser cookie retention, exactly as on desktop

## Sources

- 2026-03-25: Docker recommends running Docker Desktop natively on Mac, Linux, or Windows
- 2026-03-25: Docker Desktop for Linux runs a VM and requires virtualization support such as KVM
- 2026-03-25: Android 8.0 background execution limits make long-lived background work more constrained
- 2026-03-25: Android app-specific storage rules constrain how and where app files are persisted
- 2026-03-25: Android Virtualization Framework is supported only on ARM64 devices
- local operational memory: `context/operations/termux_cloudflare_architecture.md`
- runtime evidence: `project-memory/evidence/android-deployment-2026-03-25.md`
