import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, googleProvider, db } from "../firebase/config";

const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Monitor authentication state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Cek apakah user sudah ada di Firestore
        try {
          const userDoc = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDoc);

          if (!userDocSnap.exists()) {
            // User baru, set default role guest
            await setDoc(userDoc, {
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || null,
              photoURL: user.photoURL || null,
              role: "guest", // Default role untuk user baru
              isActive: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          } else {
            // User sudah ada, hanya update data yang berubah
            const existingData = userDocSnap.data();
            await setDoc(
              userDoc,
              {
                uid: user.uid,
                email: user.email,
                displayName:
                  user.displayName || existingData.displayName || null,
                photoURL: user.photoURL || existingData.photoURL || null,
                role: existingData.role, // Pertahankan role yang sudah ada
                isActive:
                  existingData.isActive !== undefined
                    ? existingData.isActive
                    : true,
                createdAt: existingData.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          }
        } catch (error) {
          console.error("Error syncing user to Firestore:", error);
        }
      }
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Login dengan Google
  const handleGoogleLogin = async () => {
    try {
      setError(null);
      setLoading(true);
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
    } catch (error) {
      console.error("Error saat login dengan Google:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Login dengan email dan password
  const handleEmailPasswordLogin = async (email, password) => {
    try {
      setError(null);
      setLoading(true);
      const result = await signInWithEmailAndPassword(auth, email, password);
      setUser(result.user);
      return result;
    } catch (error) {
      console.error("Error saat login dengan email/password:", error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Register dengan email dan password
  const handleEmailPasswordRegister = async (
    email,
    password,
    displayName = null
  ) => {
    try {
      setError(null);
      setLoading(true);
      const result = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Set displayName jika ada
      if (displayName) {
        await updateProfile(result.user, {
          displayName: displayName,
        });
      }

      // Simpan user ke Firestore
      await setDoc(doc(db, "users", result.user.uid), {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName || displayName || null,
        photoURL: result.user.photoURL || null,
        role: "guest", // Default role
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setUser(result.user);
      return result;
    } catch (error) {
      console.error("Error saat register dengan email/password:", error);
      setError(error.message);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Logout
  const handleLogout = async () => {
    try {
      setError(null);
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error("Error saat logout:", error);
      setError(error.message);
    }
  };

  return {
    user,
    loading,
    error,
    handleGoogleLogin,
    handleEmailPasswordLogin,
    handleEmailPasswordRegister,
    handleLogout,
  };
};

export default useAuth;
