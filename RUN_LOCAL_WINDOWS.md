# Run locally (Windows)

## Production-like (recommended for reliability)

From **any** PowerShell prompt:

```powershell
npm --prefix "C:\Users\timmc\Documents\dev\pipeline-tool" run build
npm --prefix "C:\Users\timmc\Documents\dev\pipeline-tool" run start -- -p 3000
```

Open:
- http://localhost:3000/login

Stop it:
- press `Ctrl+C` in the terminal running `start`

If you want it to run detached (no terminal), you can use:

```powershell
$project = "C:\Users\timmc\Documents\dev\pipeline-tool"
$node = (Get-Command node).Source
$nextCli = Join-Path $project "node_modules\next\dist\bin\next"
Start-Process -FilePath $node -ArgumentList @($nextCli, "start", "-p", "3000") -WorkingDirectory $project
```

## Dev mode (hot reload)

You must run `npm` **in the project folder** (or use `--prefix`).

```powershell
cd "C:\Users\timmc\Documents\dev\pipeline-tool"
npm run dev
```

Or from anywhere:

```powershell
npm --prefix "C:\Users\timmc\Documents\dev\pipeline-tool" run dev
```

Open:
- http://localhost:3000

## Smoke test URL (temporary)

`npm run smoke` starts a production server on `http://127.0.0.1:3100` briefly to run checks, then shuts it down.
If you want a persistent production server on that port:

```powershell
npm --prefix "C:\Users\timmc\Documents\dev\pipeline-tool" run build
npm --prefix "C:\Users\timmc\Documents\dev\pipeline-tool" run start -- -p 3100
```

## Common gotchas

- If you run `npm run dev` from `C:\Users\timmc`, npm can’t find `package.json` and nothing will start.
- If port 3000 is already in use, run with `-- --port 3010` (dev) or `-- -p 3010` (start).
