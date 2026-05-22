# Release process

1. Bump the version in `src/desktop/package.json`.
2. Commit with `chore: release vX.Y.Z`.
3. Tag: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. The `release.yml` workflow builds and publishes a draft GitHub Release.
5. Review the draft, add release notes, then publish.

## Code signing

Code signing is intentionally disabled in v1. To enable:

- **macOS**: Populate `CSC_LINK`, `CSC_KEY_PASSWORD`, `APPLE_ID`, `APPLE_TEAM_ID` secrets and remove `CSC_IDENTITY_AUTO_DISCOVERY: 'false'` from the workflow.
- **Windows**: Populate `WIN_CSC_LINK`, `WIN_CSC_KEY_PASSWORD`.
