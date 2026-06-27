#!/bin/sh
# Push all commits to GitHub
TOKEN=$(printenv GITHUB_TOKEN)
if [ -z "$TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN secret not set in Replit Secrets."
  exit 1
fi
git push "https://x-token-auth:${TOKEN}@github.com/khuongbilling/Clinica.git" main
echo "Done — github.com/khuongbilling/Clinica is up to date."
