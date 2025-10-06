import React, { useState, useEffect } from "react";
import { doc, updateDoc, query, collection, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import useAuth from "../hooks/useAuth";
import { logActivity, ACTION_TYPES, TARGET_TYPES } from "../utils/activityLogger";

const RenameModal = ({ item, type, onClose, onSuccess }) => {
    const { user } = useAuth();
    const [newName, setNewName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (item) {
            setNewName(type === "file" ? item.originalName || item.name : item.name);
        }
    }, [item, type]);

    const handleRename = async () => {
        if (!newName.trim()) {
            setError("Nama tidak boleh kosong");
            return;
        }

        if (newName === (type === "file" ? item.originalName || item.name : item.name)) {
            setError("Nama sama dengan sebelumnya");
            return;
        }

        setLoading(true);
        setError("");

        try {
            if (type === "folder") {
                await renameFolder();
            } else {
                await renameFile();
            }

            if (onSuccess) {
                onSuccess();
            }
            onClose();
        } catch (err) {
            console.error("Error renaming:", err);
            setError(err.message || "Gagal rename");
        } finally {
            setLoading(false);
        }
    };

    const renameFolder = async () => {
        // Check if folder with new name already exists (simplified query)
        const checkQuery = query(
            collection(db, "folders"),
            where("userId", "==", item.userId),
            where("parentFolder", "==", item.parentFolder || "")
        );
        const existingFolders = await getDocs(checkQuery);

        // Filter by name in client-side
        const duplicateFolder = existingFolders.docs.find(
            doc => doc.data().name === newName && doc.id !== item.id
        );

        if (duplicateFolder) {
            throw new Error("Folder dengan nama ini sudah ada");
        }

        // Update folder name
        const folderRef = doc(db, "folders", item.id);
        await updateDoc(folderRef, {
            name: newName,
            updatedAt: new Date(),
        });

        // Update all child folders and files
        const oldFolderPath = item.parentFolder
            ? `${item.parentFolder}/${item.name}`
            : item.name;
        const newFolderPath = item.parentFolder
            ? `${item.parentFolder}/${newName}`
            : newName;

        // Update child folders (get all user folders, filter client-side)
        const allFoldersQuery = query(
            collection(db, "folders"),
            where("userId", "==", item.userId)
        );
        const allFolders = await getDocs(allFoldersQuery);

        for (const folderDoc of allFolders.docs) {
            const folderData = folderDoc.data();
            const parentFolder = folderData.parentFolder || "";

            // Check if this folder is a child of the renamed folder
            if (parentFolder.startsWith(oldFolderPath)) {
                const updatedParentFolder = parentFolder.replace(
                    oldFolderPath,
                    newFolderPath
                );
                await updateDoc(doc(db, "folders", folderDoc.id), {
                    parentFolder: updatedParentFolder,
                    updatedAt: new Date(),
                });
            }
        }

        // Update files in this folder and subfolders (get all user files, filter client-side)
        const allFilesQuery = query(
            collection(db, "files"),
            where("userId", "==", item.userId)
        );
        const allFiles = await getDocs(allFilesQuery);

        for (const fileDoc of allFiles.docs) {
            const fileData = fileDoc.data();
            const fileFolder = fileData.folder || "";

            // Check if this file is in the renamed folder or its subfolders
            if (fileFolder === oldFolderPath || fileFolder.startsWith(oldFolderPath + "/")) {
                const updatedFolder = fileFolder.replace(oldFolderPath, newFolderPath);
                await updateDoc(doc(db, "files", fileDoc.id), {
                    folder: updatedFolder,
                    updatedAt: new Date(),
                });
            }
        }

        // Log activity
        if (user) {
            await logActivity({
                userEmail: user.email,
                userName: user.displayName,
                action: ACTION_TYPES.FOLDER_RENAME,
                targetType: TARGET_TYPES.FOLDER,
                targetName: item.name,
                details: `Renamed to: ${newName}`,
            });
        }
    };

    const renameFile = async () => {
        // Get file extension
        const oldName = item.originalName || item.name;
        const oldExtension = oldName.includes(".") ? oldName.split(".").pop() : "";
        const newExtension = newName.includes(".") ? newName.split(".").pop() : "";

        // Ensure extension is preserved
        let finalNewName = newName;
        if (oldExtension && !newName.includes(".")) {
            finalNewName = `${newName}.${oldExtension}`;
        } else if (oldExtension && newExtension !== oldExtension) {
            if (
                !window.confirm(
                    `Ekstensi file berubah dari .${oldExtension} ke .${newExtension}. Lanjutkan?`
                )
            ) {
                throw new Error("Rename dibatalkan");
            }
        }

        // Check if file with new name already exists in same folder (simplified query)
        const checkQuery = query(
            collection(db, "files"),
            where("userId", "==", item.userId),
            where("folder", "==", item.folder || "")
        );
        const existingFiles = await getDocs(checkQuery);

        // Filter by name in client-side
        const duplicateFile = existingFiles.docs.find(
            doc => doc.data().originalName === finalNewName && doc.id !== item.id
        );

        if (duplicateFile) {
            throw new Error("File dengan nama ini sudah ada di folder yang sama");
        }

        // Update Firestore metadata only (no need to move file in storage)
        // File fisik tetap sama di storage, hanya metadata nama yang berubah
        const fileRef = doc(db, "files", item.id);
        await updateDoc(fileRef, {
            name: finalNewName,
            originalName: finalNewName,
            updatedAt: new Date(),
        });

        // Log activity
        if (user) {
            await logActivity({
                userEmail: user.email,
                userName: user.displayName,
                action: ACTION_TYPES.FILE_RENAME,
                targetType: TARGET_TYPES.FILE,
                targetName: item.originalName || item.name,
                details: `Renamed to: ${finalNewName}`,
            });
        }
    };

    if (!item) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Rename {type === "folder" ? "Folder" : "File"}</h3>
                    <button className="close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>
                <div className="modal-body">
                    <div style={{ marginBottom: "1rem" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", color: "#7f8c8d" }}>
                            Nama {type === "folder" ? "folder" : "file"} saat ini:
                        </label>
                        <div
                            style={{
                                padding: "0.75rem",
                                background: "#f8f9fa",
                                borderRadius: "6px",
                                color: "#2c3e50",
                                fontWeight: "500",
                            }}
                        >
                            {type === "file" ? item.originalName || item.name : item.name}
                        </div>
                    </div>
                    <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", color: "#7f8c8d" }}>
                            Nama baru:
                        </label>
                        <input
                            type="text"
                            placeholder={`Masukkan nama ${type === "folder" ? "folder" : "file"} baru`}
                            value={newName}
                            onChange={(e) => {
                                setNewName(e.target.value);
                                setError("");
                            }}
                            className="folder-input"
                            onKeyPress={(e) => e.key === "Enter" && !loading && handleRename()}
                            autoFocus
                            disabled={loading}
                        />
                    </div>
                    {error && (
                        <div
                            style={{
                                marginTop: "1rem",
                                padding: "0.75rem",
                                background: "#fee",
                                border: "1px solid #e74c3c",
                                borderRadius: "6px",
                                color: "#c0392b",
                                fontSize: "0.9rem",
                            }}
                        >
                            ⚠️ {error}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Batal
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleRename}
                        disabled={loading || !newName.trim()}
                    >
                        {loading ? "⏳ Memproses..." : "✅ Rename"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RenameModal;
