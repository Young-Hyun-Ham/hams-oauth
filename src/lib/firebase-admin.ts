import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function readFirebaseAdminConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey,
  };
}

export function hasFirebaseAdminConfig() {
  return Boolean(readFirebaseAdminConfig());
}

export function getFirebaseAdminDb(): Firestore | null {
  const config = readFirebaseAdminConfig();

  if (!config) {
    return null;
  }

  try {
    if (!getApps().length) {
      initializeApp({
        credential: cert(config),
      });
    }

    return getFirestore();
  } catch (error) {
    console.error("Failed to initialize Firebase Admin.", error);
    return null;
  }
}
