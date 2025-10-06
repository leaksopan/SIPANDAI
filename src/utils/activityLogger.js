import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";

/**
 * Log activity to Firestore
 * @param {Object} params
 * @param {string} params.userEmail - Email user yang melakukan aksi
 * @param {string} params.userName - Nama user yang melakukan aksi
 * @param {string} params.action - Aksi yang dilakukan (DELETE, RENAME, MOVE, UPLOAD, etc)
 * @param {string} params.targetType - Tipe target (FILE, FOLDER, USER, etc)
 * @param {string} params.targetName - Nama file/folder/user yang dikenai aksi
 * @param {string} params.details - Detail tambahan (optional)
 */
export const logActivity = async ({
    userEmail,
    userName,
    action,
    targetType,
    targetName,
    details = "",
}) => {
    try {
        await addDoc(collection(db, "activityLogs"), {
            userEmail,
            userName,
            action,
            targetType,
            targetName,
            details,
            timestamp: serverTimestamp(),
            createdAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Error logging activity:", error);
        // Don't throw error, just log it - we don't want to break the main operation
    }
};

/**
 * Action types constants
 */
export const ACTION_TYPES = {
    // File operations
    FILE_UPLOAD: "UPLOAD FILE",
    FILE_DELETE: "DELETE FILE",
    FILE_RENAME: "RENAME FILE",
    FILE_MOVE: "MOVE FILE",
    FILE_DOWNLOAD: "DOWNLOAD FILE",

    // Folder operations
    FOLDER_CREATE: "CREATE FOLDER",
    FOLDER_DELETE: "DELETE FOLDER",
    FOLDER_RENAME: "RENAME FOLDER",
    FOLDER_MOVE: "MOVE FOLDER",

    // User operations
    USER_CREATE: "CREATE USER",
    USER_UPDATE: "UPDATE USER",
    USER_DELETE: "DELETE USER",
    USER_ROLE_CHANGE: "CHANGE USER ROLE",

    // System operations
    PERMISSION_UPDATE: "UPDATE PERMISSIONS",
    LOGIN: "LOGIN",
    LOGOUT: "LOGOUT",
};

/**
 * Target types constants
 */
export const TARGET_TYPES = {
    FILE: "FILE",
    FOLDER: "FOLDER",
    USER: "USER",
    SYSTEM: "SYSTEM",
};
