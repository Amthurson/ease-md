# First Release Guide (GitHub Releases)

This project is configured so pushing a tag like `v0.1.0` will:

1. Build Windows artifacts in GitHub Actions
2. Create a GitHub Release automatically
3. Upload `.msi` / `.exe` artifacts to that release

## 1) Local pre-check

Run in project root:

```powershell
npm install
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

## 2) Commit current changes

```powershell
git add .
git commit -m "chore: prepare v0.1.0 release pipeline"
```

## 3) Create and push release tag

```powershell
git tag v0.1.0
git push origin master
git push origin v0.1.0
```

## 4) Monitor release job

Open:

`https://github.com/Amthurson/ease-md/actions`

After it finishes, check:

`https://github.com/Amthurson/ease-md/releases`

## 5) If you need to re-release same version

```powershell
git tag -d v0.1.0
git push --delete origin v0.1.0
git tag v0.1.0
git push origin v0.1.0
```

## Notes

- Workflow file: `.github/workflows/release.yml`
- Frontend build is executed by Tauri config `beforeBuildCommand: npm run build`.
- Current workflow builds Windows release only. You can extend matrix later for macOS/Linux.
