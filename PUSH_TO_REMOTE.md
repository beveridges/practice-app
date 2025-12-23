# How to Push to a Remote Git Repository

## Step 1: Create a Remote Repository

**Option A: GitHub**
1. Go to https://github.com
2. Click the "+" icon → "New repository"
3. Name it (e.g., `hygiene-app`)
4. **DO NOT** initialize with README, .gitignore, or license (you already have these)
5. Click "Create repository"

**Option B: GitLab**
1. Go to https://gitlab.com
2. Click "New project" → "Create blank project"
3. Name it and create

**Option C: Bitbucket**
1. Go to https://bitbucket.org
2. Click "Create" → "Repository"
3. Name it and create

## Step 2: Add the Remote

After creating the repository, GitHub/GitLab will show you commands. Use this format:

```bash
# Replace <YOUR-USERNAME> and <REPO-NAME> with your actual values
# GitHub example:
git remote add origin https://github.com/YOUR-USERNAME/hygiene-app.git

# Or using SSH (if you have SSH keys set up):
git remote add origin git@github.com:YOUR-USERNAME/hygiene-app.git
```

**To check your remotes:**
```bash
git remote -v
```

## Step 3: Push to Remote

### First Time Push

```bash
# Make sure you're on main branch (or master)
git branch -M main

# Push and set upstream
git push -u origin main
```

If your default branch is `master` instead of `main`:
```bash
git branch -M master
git push -u origin master
```

### Future Pushes

After the first push, you can simply use:
```bash
git push
```

## Complete Example Workflow

```bash
# 1. Make sure all files are committed
git status

# 2. If you have uncommitted changes, commit them
git add .
git commit -m "Your commit message"

# 3. Add remote (only needed once)
git remote add origin https://github.com/YOUR-USERNAME/hygiene-app.git

# 4. Push for the first time
git branch -M main
git push -u origin main

# 5. For future pushes, just use:
git push
```

## Common Issues & Solutions

### "Repository not found"
- Check the repository URL is correct
- Make sure you have access to the repository
- Verify your Git credentials are set up

### "Authentication failed"
```bash
# Set up Git credentials (one time)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# For HTTPS, you'll need a Personal Access Token:
# GitHub: Settings → Developer settings → Personal access tokens
# GitLab: Settings → Access Tokens
```

### "Remote origin already exists"
If you need to change the remote URL:
```bash
# Check current remote
git remote -v

# Remove old remote
git remote remove origin

# Add new remote
git remote add origin <NEW-URL>
```

### "Updates were rejected"
If someone else pushed changes:
```bash
# Pull changes first
git pull origin main

# Resolve any conflicts, then push
git push
```

## Using SSH Instead of HTTPS

SSH is more convenient (no password needed after setup):

1. **Generate SSH key** (if you don't have one):
```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

2. **Add to SSH agent**:
```bash
eval "$(ssh-agent -s)"
ssh-add ~/.ssh/id_ed25519
```

3. **Copy public key**:
```bash
# Windows
cat ~/.ssh/id_ed25519.pub
# Or: type %USERPROFILE%\.ssh\id_ed25519.pub

# Copy the output
```

4. **Add to GitHub/GitLab**:
   - GitHub: Settings → SSH and GPG keys → New SSH key
   - GitLab: Settings → SSH Keys

5. **Use SSH URL when adding remote**:
```bash
git remote add origin git@github.com:YOUR-USERNAME/hygiene-app.git
```

## Quick Reference

```bash
# Check status
git status

# See remotes
git remote -v

# Add remote
git remote add origin <URL>

# Push (first time)
git push -u origin main

# Push (after first time)
git push

# Pull changes
git pull

# Fetch changes (without merging)
git fetch
```

