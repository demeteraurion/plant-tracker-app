# My Garden App

React and Vite garden tracker backed by Firebase Auth and Firestore.

## Local Development

Copy `.env.example` to `.env.local`, fill in the Firebase web app values, then run:

```sh
npm install
npm run dev
```

## Deployment

The normal GitHub Actions deploy flow in `.github/workflows/deploy.yml` does two things on pushes to `main`:

- builds the Vite app and deploys `dist` to GitHub Pages
- deploys `firestore.rules` to the Firebase project `plant-tracker-app-fdf90`

The Firestore rules job uses the GitHub secret `FIREBASE_SERVICE_ACCOUNT_PLANT_TRACKER_APP_FDF90`. That secret should contain a Firebase or Google Cloud service account JSON key with permission to deploy Firestore rules for `plant-tracker-app-fdf90`.

Manual local deployment is still available with:

```sh
npm run deploy
```
