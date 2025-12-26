# Git Setup Guide

## What Gets Tracked

✅ **Include (Track):**
- All source code files (`*.py`, `*.js`, `*.html`, `*.css`)
- Configuration files (`requirements.txt`, `environment.yml`, `manifest.json`)
- Documentation (`*.md` files)
- Database schema files (but NOT the database itself)

❌ **Exclude (Ignore):**
- Database files (`.db`, `.sqlite`) - these are development data
- Python cache (`__pycache__/`, `*.pyc`)
- Virtual environments (`venv/`, `env/`, conda environments)
- IDE files (`.vscode/`, `.idea/`)
- OS files (`.DS_Store`, `Thumbs.db`)
- Large files (PDFs, ZIPs, images in `/books/`)
- Temporary/development scripts (icon generators, etc.)

## Quick Setup

1. **Initialize Git** (if not already done):
   ```bash
   git init
   ```

2. **Check what will be tracked**:
   ```bash
   git status
   ```

3. **Add files**:
   ```bash
   git add .
   ```

4. **Check what's staged**:
   ```bash
   git status
   ```

5. **Make initial commit**:
   ```bash
   git commit -m "Initial commit: Hygiene Tracker PWA"
   ```

## Important Notes

### Database Files
- The `practice_tracker.db` file is **NOT** tracked (in `.gitignore`)
- Each developer should create their own database
- Database schema is defined in `database.py` which IS tracked

### Environment Files
- `environment.yml` and `requirements.txt` ARE tracked (these define dependencies)
- Actual conda/virtual environments are NOT tracked
- Each developer runs: `conda env create -f environment.yml`

### Icons
- Icon placeholder scripts are tracked (in case someone wants to regenerate icons)
- Generated PNG files in `frontend/icons/` should be committed if you want them
- Currently `.gitignore` excludes `*.png` - modify if you want to track icons

## Files You Might Want to Modify in `.gitignore`

1. **To track generated icons**, remove or comment out:
   ```
   frontend/icons/*.png
   ```

2. **To track development scripts**, remove or comment out:
   ```
   frontend/CREATE_ICONS.bat
   frontend/create_icons.py
   ```

3. **To track documentation PDFs** (not recommended - they're large):
   ```
   *.pdf
   ```

## Recommended Git Workflow

```bash
# 1. Check what's changed
git status

# 2. Stage changes
git add <files>
# or
git add .

# 3. Commit
git commit -m "Description of changes"

# 4. Push (if using remote)
git push
```

## Remote Repository Setup

If using GitHub/GitLab:

```bash
# Add remote
git remote add origin <repository-url>

# Push to remote
git branch -M main
git push -u origin main
```

