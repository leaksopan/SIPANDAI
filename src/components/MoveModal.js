import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where, updateDoc, doc } from "firebase/firestore";
import { db } from "../firebase/config";
import { logActivity, ACTION_TYPES, TARGET_TYPES } from "../utils/activityLogger";
import "./MoveModal.css";

/**
 * MoveModal Component
 * Modal untuk move/paste files dan folders ke folder lain
 */
const MoveModal = ({ items, currentFolder, user, onClose, onSuccess }) => {
    const [folders, setFolders] = useState([]);
    const [allFolders, setAllFolders] = useState([]); // All folders for search
    const [selectedFolder, setSelectedFolder] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadingFolders, setLoadingFolders] = useState(true);
    const [breadcrumb, setBreadcrumb] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        loadFolders("");
        loadAllFolders();
    }, []);

    // Load all folders for search
    const loadAllFolders = async () => {
        try {
            const allFoldersQuery = query(collection(db, "folders"));
            const snapshot = await getDocs(allFoldersQuery);
            const foldersData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setAllFolders(foldersData);
        } catch (error) {
            console.error("Error loading all folders:", error);
        }
    };

    const loadFolders = async (folderPath) => {
        setLoadingFolders(true);
        try {
            // Load ALL folders (tidak filter by userId) - semua user bisa akses semua folder
            const foldersQuery = query(
                collection(db, "folders"),
                where("parentFolder", "==", folderPath || "")
            );

            const snapshot = await getDocs(foldersQuery);
            const foldersData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            setFolders(foldersData);
            setSelectedFolder(folderPath);

            // Update breadcrumb
            if (!folderPath) {
                setBreadcrumb(["Root"]);
            } else {
                setBreadcrumb(["Root", ...folderPath.split("/")]);
            }
        } catch (error) {
            console.error("Error loading folders:", error);
        } finally {
            setLoadingFolders(false);
        }
    };

    const navigateToFolder = (path) => {
        loadFolders(path);
    };

    const handleMove = async () => {
        if (selectedFolder === currentFolder) {
            alert("Folder tujuan sama dengan folder saat ini");
            return;
        }

        // Check if trying to move folder into itself or its subfolder
        const folderItems = items.filter((i) => i.type === "folder");
        for (const folder of folderItems) {
            const folderPath = currentFolder ? `${currentFolder}/${folder.data.name}` : folder.data.name;
            if (selectedFolder.startsWith(folderPath)) {
                alert(`Tidak bisa memindahkan folder "${folder.data.name}" ke dalam dirinya sendiri`);
                return;
            }
        }

        if (!window.confirm(`Pindahkan ${items.length} item ke "${selectedFolder || "Root"}"?`)) {
            return;
        }

        setLoading(true);
        const results = { success: 0, failed: 0 };

        try {
            for (const item of items) {
                try {
                    if (item.type === "file") {
                        // Move file: update folder path in Firestore
                        await updateDoc(doc(db, "files", item.id), {
                            folder: selectedFolder,
                            updatedAt: new Date(),
                        });

                        // Log activity
                        if (user) {
                            await logActivity({
                                userEmail: user.email,
                                userName: user.displayName,
                                action: ACTION_TYPES.FILE_MOVE,
                                targetType: TARGET_TYPES.FILE,
                                targetName: item.data.name,
                                details: `Moved from ${currentFolder || "root"} to ${selectedFolder || "root"}`,
                            });
                        }

                        results.success++;
                    } else if (item.type === "folder") {
                        // Move folder: update parentFolder in Firestore
                        await updateDoc(doc(db, "folders", item.id), {
                            parentFolder: selectedFolder,
                            updatedAt: new Date(),
                        });

                        // Update all files in this folder
                        const oldFolderPath = currentFolder
                            ? `${currentFolder}/${item.data.name}`
                            : item.data.name;
                        const newFolderPath = selectedFolder
                            ? `${selectedFolder}/${item.data.name}`
                            : item.data.name;

                        const filesQuery = query(
                            collection(db, "files"),
                            where("folder", "==", oldFolderPath)
                        );
                        const filesSnapshot = await getDocs(filesQuery);

                        for (const fileDoc of filesSnapshot.docs) {
                            await updateDoc(doc(db, "files", fileDoc.id), {
                                folder: newFolderPath,
                                updatedAt: new Date(),
                            });
                        }

                        // Log activity
                        if (user) {
                            await logActivity({
                                userEmail: user.email,
                                userName: user.displayName,
                                action: ACTION_TYPES.FOLDER_MOVE,
                                targetType: TARGET_TYPES.FOLDER,
                                targetName: item.data.name,
                                details: `Moved from ${currentFolder || "root"} to ${selectedFolder || "root"}`,
                            });
                        }

                        results.success++;
                    }
                } catch (error) {
                    console.error("Error moving item:", error);
                    results.failed++;
                }
            }

            if (results.failed === 0) {
                alert(`✅ Berhasil memindahkan ${results.success} item!`);
            } else {
                alert(`⚠️ Selesai: ${results.success} berhasil, ${results.failed} gagal`);
            }

            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error in move operation:", error);
            alert("Gagal memindahkan item");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="move-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>📦 Pindahkan {items.length} Item</h3>
                    <button className="close-btn" onClick={onClose}>
                        ✕
                    </button>
                </div>

                <div className="modal-body">
                    {/* Current selection info */}
                    <div className="move-info">
                        <p>
                            <strong>Item yang akan dipindahkan ({items.length}):</strong>
                        </p>
                        <div style={{ maxHeight: "60px", overflowY: "auto", marginTop: "8px" }}>
                            <ul className="items-list" style={{ margin: 0 }}>
                                {items.map((item) => (
                                    <li key={`${item.type}-${item.id}`}>
                                        {item.type === "folder" ? "📁" : "📄"} {item.data.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Breadcrumb */}
                    <div className="move-breadcrumb">
                        <strong>Lokasi saat ini:</strong>
                        <div className="breadcrumb-path">
                            {breadcrumb.map((crumb, index) => (
                                <span key={index}>
                                    {index > 0 && <span className="separator">›</span>}
                                    <button
                                        className="breadcrumb-btn"
                                        onClick={() => {
                                            if (index === 0) {
                                                navigateToFolder("");
                                                setSearchTerm("");
                                            } else {
                                                const path = breadcrumb.slice(1, index).join("/");
                                                navigateToFolder(path);
                                                setSearchTerm("");
                                            }
                                        }}
                                    >
                                        {crumb}
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div style={{ marginBottom: "12px" }}>
                        <input
                            type="text"
                            placeholder="🔍 Cari folder..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: "100%",
                                padding: "8px 12px",
                                border: "1px solid #d1d5db",
                                borderRadius: "6px",
                                fontSize: "14px",
                            }}
                        />
                    </div>

                    {/* Folder list */}
                    <div className="folders-container">
                        <p>
                            <strong>
                                {searchTerm ? `Hasil pencarian "${searchTerm}"` : "Pilih folder tujuan:"}
                            </strong>
                        </p>
                        {loadingFolders ? (
                            <div className="loading-folders">
                                <div className="spinner-small"></div>
                                <p>Memuat folder...</p>
                            </div>
                        ) : searchTerm ? (
                            // Search results - search ALL folders globally
                            (() => {
                                const filtered = allFolders.filter((f) =>
                                    f.name.toLowerCase().includes(searchTerm.toLowerCase())
                                );
                                return filtered.length === 0 ? (
                                    <div className="empty-folders">
                                        <p>Tidak ada folder yang cocok</p>
                                        <p className="hint">Coba kata kunci lain</p>
                                    </div>
                                ) : (
                                    <div className="folders-list">
                                        {filtered.map((folder) => {
                                            const fullPath = folder.parentFolder
                                                ? `${folder.parentFolder}/${folder.name}`
                                                : folder.name;
                                            return (
                                                <div
                                                    key={folder.id}
                                                    className="folder-item"
                                                    onClick={() => {
                                                        // Set selected folder to this path and navigate to it
                                                        setSelectedFolder(fullPath);
                                                        loadFolders(fullPath);
                                                        setSearchTerm("");
                                                    }}
                                                >
                                                    <span className="folder-icon">📁</span>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <div className="folder-name">{folder.name}</div>
                                                        <div className="folder-path">
                                                            📂 {folder.parentFolder || "Root"}
                                                        </div>
                                                    </div>
                                                    <button className="btn-navigate">→</button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()
                        ) : folders.length === 0 ? (
                            <div className="empty-folders">
                                <p>Tidak ada subfolder di sini</p>
                                <p className="hint">Klik "Pindahkan ke Sini" untuk memindahkan ke folder ini</p>
                            </div>
                        ) : (
                            <div className="folders-list">
                                {folders.map((folder) => (
                                    <div
                                        key={folder.id}
                                        className="folder-item"
                                        onDoubleClick={() => {
                                            const newPath = selectedFolder
                                                ? `${selectedFolder}/${folder.name}`
                                                : folder.name;
                                            navigateToFolder(newPath);
                                        }}
                                    >
                                        <span className="folder-icon">📁</span>
                                        <span className="folder-name">{folder.name}</span>
                                        <button
                                            className="btn-navigate"
                                            onClick={() => {
                                                const newPath = selectedFolder
                                                    ? `${selectedFolder}/${folder.name}`
                                                    : folder.name;
                                                navigateToFolder(newPath);
                                            }}
                                        >
                                            →
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        Batal
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={handleMove}
                        disabled={loading || selectedFolder === currentFolder}
                    >
                        {loading ? "⏳ Memindahkan..." : "📦 Pindahkan ke Sini"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MoveModal;
