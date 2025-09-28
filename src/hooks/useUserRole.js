import { useState, useEffect, useCallback } from "react";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import useAuth from "./useAuth";

const useUserRole = () => {
  const { user } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Role hierarchy
  const ROLES = {
    SUPER_ADMIN: "super_admin",
    IRBAN: "Irban",
    AUDITOR: "Auditor",
    GUEST: "guest",
  };

  const ROLE_LABELS = {
    super_admin: "Super Admin",
    Irban: "Irban",
    Auditor: "Auditor",
    guest: "Guest",
  };

  const ROLE_PERMISSIONS = {
    super_admin: {
      canCreateUsers: true,
      canEditUsers: true,
      canDeleteUsers: true,
      canManageRoles: true,
      canAccessAllFiles: true,
      canManageSystem: true,
      canUploadFiles: true,
      canDownloadFiles: true,
      canCreateFolders: true,
      canDeleteFiles: true,
      canDeleteFolders: true,
      canViewFiles: true,
    },
    Irban: {
      canCreateUsers: false,
      canEditUsers: false,
      canDeleteUsers: false,
      canManageRoles: false,
      canAccessAllFiles: true,
      canManageSystem: false,
      canUploadFiles: true,
      canDownloadFiles: true,
      canCreateFolders: true,
      canDeleteFiles: true,
      canDeleteFolders: true,
      canViewFiles: true,
    },
    Auditor: {
      canCreateUsers: false,
      canEditUsers: false,
      canDeleteUsers: false,
      canManageRoles: false,
      canAccessAllFiles: true,
      canManageSystem: false,
      canUploadFiles: true,
      canDownloadFiles: false,
      canCreateFolders: false,
      canDeleteFiles: false,
      canDeleteFolders: false,
      canViewFiles: true,
    },
    guest: {
      canCreateUsers: false,
      canEditUsers: false,
      canDeleteUsers: false,
      canManageRoles: false,
      canAccessAllFiles: false,
      canManageSystem: false,
      canUploadFiles: false,
      canDownloadFiles: false,
      canCreateFolders: false,
      canDeleteFiles: false,
      canDeleteFolders: false,
      canViewFiles: false,
    },
  };

  // Get user role from Firestore
  useEffect(() => {
    const fetchUserRole = async () => {
      if (!user) {
        setUserRole(null);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserRole(userData);
        } else {
          // Create new user document with default guest role
          const newUserData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: ROLES.GUEST,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isActive: true,
          };

          await setDoc(userDocRef, newUserData);
          setUserRole(newUserData);
        }
      } catch (err) {
        console.error("Error fetching user role:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  // Update user role
  const updateUserRole = useCallback(
    async (userId, newRole) => {
      try {
        const userDocRef = doc(db, "users", userId);
        await updateDoc(userDocRef, {
          role: newRole,
          updatedAt: new Date().toISOString(),
        });

        // Update local state if it's current user
        if (userId === user?.uid) {
          setUserRole((prev) => ({ ...prev, role: newRole }));
        }

        return true;
      } catch (err) {
        console.error("Error updating user role:", err);
        setError(err.message);
        return false;
      }
    },
    [user?.uid]
  );

  // Check permissions
  const hasPermission = useCallback(
    (permission) => {
      if (!userRole?.role) return false;
      return ROLE_PERMISSIONS[userRole.role]?.[permission] || false;
    },
    [userRole?.role]
  );

  // Get role label
  const getRoleLabel = useCallback((role) => {
    return ROLE_LABELS[role] || role;
  }, []);

  return {
    userRole,
    loading,
    error,
    ROLES,
    ROLE_LABELS,
    updateUserRole,
    hasPermission,
    getRoleLabel,
    isSuperAdmin: userRole?.role === ROLES.SUPER_ADMIN,
    isIrban: userRole?.role === ROLES.IRBAN,
    isAuditor: userRole?.role === ROLES.AUDITOR,
    isGuest: userRole?.role === ROLES.GUEST,
  };
};

export default useUserRole;
