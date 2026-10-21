# Preparing and publishing FP Play v0.1.0

Milestone 7 prepares deployment configuration and documentation. It does **not** enable Pages, change repository settings, push, merge, tag, publish a GitHub release, or deploy a site. Package version 0.1.0 is already set; `private: true` intentionally prevents accidental npm registry publication.

## Local production verification

```sh
npm ci
npm run check
npm run check:release
npm run preview
```

Open `http://localhost:4173/fp-play/`. Verify the [manual release cases](RELEASE_VERIFICATION.md), including reloads of `#explorer`, `#microscope`, `#arithmetic`, and `#fma`. The FMA hash loads a verified comparison with original FP16 operands. Hash navigation keeps all URLs on the static index; `/fp-play/arithmetic` is not an application route. There is no router, server rewrite, or manufactured 404 fallback.

Vite's base is `/fp-play/` for both development and production. The expected project-site address is `https://nivupai.github.io/fp-play/`; this is a deployment target, not a claim that it is live. A renamed repository, organization site, or custom-domain root requires reviewing the base path and release asset checks together.

## Explicit maintainer steps to deploy

Only do these when publication is authorized:

1. Review the feature branch and its CI results, then merge the approved change into `main`. The workflow file must be on the default branch to appear in Actions.
2. In the GitHub repository, open **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions**. This is a manual repository-settings change; the workflow has `enablement: false` and cannot perform it.
3. Open **Actions → Deploy GitHub Pages (manual) → Run workflow**, select **main**, and explicitly run it. Other refs skip the build/deploy chain. There are no push, pull-request, tag, release, or `workflow_run` deployment triggers.
4. The build job installs the lockfile, runs the complete checks/build and production path verification, reads Pages metadata, and uploads only `dist/`. The dependent deploy job uses the `github-pages` environment and OIDC. Any environment approval rules configured by maintainers remain in effect.
5. After successful deployment, use the URL reported by the deploy job. Repeat the navigation, asset, responsive, theme, and numerical-example checks against that actual URL. Confirm the documented source/technical links work after merge.

The [Vite Pages guide](https://vite.dev/guide/static-deploy.html#github-pages) explains the repository base, and [GitHub's custom workflow guide](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) describes Pages permissions and artifacts.

## Workflow permissions and behavior

The ordinary CI workflow is read-only and runs all tests on Node 22.9.0 and 24. It cannot deploy. The separate Pages workflow is manual and main-only. Its build job has `contents: read` and `pages: read`; only its dependent deploy job has `pages: write` and `id-token: write`. Checkout does not persist credentials. No PAT or application secret is required.

Official actions are pinned to verified release commit IDs, with versions in comments. Pages configuration is read rather than enabled. Artifacts retain one day and deployments are serialized without canceling an in-progress publication. Validation failure prevents artifact upload/deployment. Review permissions and triggers whenever updating the workflow; never add an automatic publishing trigger without explicit authorization.

## Publishing the source release

After explicit authorization and successful review, a maintainer can create the `v0.1.0` tag and GitHub release from the reviewed `main` commit. Use [CHANGELOG.md](../CHANGELOG.md) for release notes and accurately record browser verification and known limitations. Do not describe the finite verification corpus as a proof of full IEEE 754 conformance.

If rollback is necessary, revert the relevant source change through the normal review process on `main`, then explicitly rerun the manual Pages workflow. No rollback or release publication is performed by local scripts.
