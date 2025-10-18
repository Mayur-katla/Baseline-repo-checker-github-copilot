Repo Analyzer service

Provides helpers to:
- clone a git repo (shallow)
- unzip an uploaded archive buffer
- walk files respecting .gitignore
- cleanup temp directories

Note: uses simple-git and adm-zip. Ensure backend has network access for cloning during development.
