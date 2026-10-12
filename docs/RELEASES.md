# Releases, downloads and updates

[← Project overview](../README.md) · [Official releases](https://github.com/Zubair-zahidi/zoderise-3d-map/releases)

## What to download

| File | Purpose |
|---|---|
| `Zoderise-3D-Map-1.0.0-x64.exe` | Portable Windows x64 application |
| `SHA256SUMS.txt` | Expected SHA-256 digest of the executable |
| Source archives | Source code for development; not the desktop application |

The executable runs without an editor, npm or Node.js installation. Online maps and feeds require an internet connection. Optional services use your own keys.

## Verify a download on Windows

Download the executable and `SHA256SUMS.txt` from the same release. In PowerShell, run:

```powershell
Get-FileHash -LiteralPath .\Zoderise-3D-Map-1.0.0-x64.exe -Algorithm SHA256
Get-Content -LiteralPath .\SHA256SUMS.txt
```

The hash must match the checksum entry for that filename; letter casing does not matter. If the values differ, download again from the official release before using the file.

## Updating

Close the running app, download the newer executable and open it. Desktop settings are stored separately in your application-data directory. There is no automatic-update requirement; releases are published through the manually triggered build workflow.

The current build is unsigned. A checksum verifies the file against the release's published digest; it does not provide publisher code signing. Windows may display an unknown-publisher warning.

## Release verification

The Windows workflow uses locked dependencies, builds without personal provider keys, checks portable startup and generates checksums before publication. Source CI separately verifies supported Node versions and Windows onboarding.
