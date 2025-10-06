import React, { useState } from "react";
import {
    ref,
    uploadBytes,
    getDownloadURL,
} from "firebase/storage";
import {
    collection,
    addDoc,
    query,
    where,
    getDocs,
} from "firebase/firestore";
import { storage, db } from "../firebase/config";

const FolderUpload = ({ user, currentFolder, onUploadComplete }) => {
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState([]);
    const [totalProgress, setTotalProgress] = useState(0);

    const handleFolderSelect = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploading(true);
        setUploadProgress([]);
        setTotalProgress(0);

        try {
            // Extract folder structure
            const folderStructure = new Map();
            const filesByFolder = new Map();

            files.forEach((file) => {
                const pathParts = file.webkitRelativePath.split("/");
                const folderPath = pathParts.slice(0, -1).join("/");
                const fileName = pathParts[pathParts.length - 1];

                // Build folder hierarchy
                let currentPath = "";
                pathParts.slice(0, -1).forEach((folderName, index) => {
                    const parentPath = currentPath;
                    currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;

                    if (!folderStructure.has(currentPath)) {
                        folderStructure.set(currentPath, {
                            name: folderName,
                            parentPath: parentPath,
                            fullPath: currentPath,
                        });
                    }
                });

                // Group files by folder
                if (!filesByFolder.has(folderPath)) {
                    filesByFolder.set(folderPath, []);
                }
                filesByFolder.get(folderPath).push({ file, fileName, folderPath });
            });

            // Create folders in Firestore
            const createdFolders = new Map();
            for (const [fullPath, folderInfo] of folderStructure) {
                const parentFolder = folderInfo.parentPath
                    ? currentFolder
                        ? `${currentFolder}/${folderInfo.parentPath}`
                        : folderInfo.parentPath
                    : currentFolder;

                // Check if folder already exists
                const existingFolderQuery = query(
                    collection(db, "folders"),
                    where("name", "==", folderInfo.name),
                    where("parentFolder", "==", parentFolder),
                    where("userId", "==", user.uid)
                );
                const existingFolders = await getDocs(existingFolderQuery);

                if (existingFolders.empty) {
                    await addDoc(collection(db, "folders"), {
                        name: folderInfo.name,
                        parentFolder: parentFolder,
                        userId: user.uid,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                    });
                }

                const finalPath = currentFolder
                    ? `${currentFolder}/${fullPath}`
                    : fullPath;
                createdFolders.set(fullPath, finalPath);
            }

            // Upload files
            let completed = 0;
            const results = { success: [], failed: [] };

            for (const [folderPath, filesInFolder] of filesByFolder) {
                for (const { file, fileName, folderPath: relativePath } of filesInFolder) {
                    const itemId = `${Date.now()}_${Math.random()}`;

                    try {
                        setUploadProgress((prev) => [
                            ...prev,
                            {
                                id: itemId,
                                fileName: file.webkitRelativePath,
                                status: "uploading",
                                progress: 0,
                            },
                        ]);

                        const finalFolderPath = relativePath
                            ? currentFolder
                                ? `${currentFolder}/${relativePath}`
                                : relativePath
                            : currentFolder;

                        const timestamp = Date.now();
                        const storagePath = `${finalFolderPath}/${timestamp}_${fileName}`;
                        const storageRef = ref(storage, `users/${user.uid}/${storagePath}`);

                        const snapshot = await uploadBytes(storageRef, file);
                        const downloadURL = await getDownloadURL(snapshot.ref);

                        setUploadProgress((prev) =>
                            prev.map((item) =>
                                item.id === itemId
                                    ? { ...item, status: "saving", progress: 50 }
                                    : item
                            )
                        );

                        await addDoc(collection(db, "files"), {
                            name: fileName,
                            originalName: fileName,
                            size: file.size,
                            type: file.type,
                            url: downloadURL,
                            storagePath: snapshot.ref.fullPath,
                            folder: finalFolderPath,
                            userId: user.uid,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                        });

                        setUploadProgress((prev) =>
                            prev.map((item) =>
                                item.id === itemId
                                    ? { ...item, status: "success", progress: 100 }
                                    : item
                            )
                        );

                        results.success.push({ file, path: file.webkitRelativePath });
                    } catch (error) {
                        console.error(`Error uploading ${file.webkitRelativePath}:`, error);

                        setUploadProgress((prev) =>
                            prev.map((item) =>
                                item.id === itemId
                                    ? { ...item, status: "error", progress: 0, error: error.message }
                                    : item
                            )
                        );

                        results.failed.push({ file, path: file.webkitRelativePath, error: error.message });
                    }

                    completed++;
                    setTotalProgress((completed / files.length) * 100);
                }
            }

            // Show results
            const successCount = results.success.length;
            const failedCount = results.failed.length;

            if (failedCount === 0) {
                alert(`✅ Berhasil upload folder dengan ${successCount} file!`);
            } else if (successCount === 0) {
                alert(`❌ Gagal upload semua ${failedCount} file!`);
            } else {
                alert(`⚠️ Upload selesai: ${successCount} berhasil, ${failedCount} gagal.`);
            }

            if (onUploadComplete) {
                onUploadComplete();
            }

            // Clear progress after 3 seconds
            setTimeout(() => {
                setUploadProgress([]);
                setTotalProgress(0);
            }, 3000);
        } catch (error) {
            console.error("Error uploading folder:", error);
            alert("Gagal upload folder: " + error.message);
        } finally {
            setUploading(false);
            e.target.value = ""; // Reset input
        }
    };

    return (
        <>
            <label className="btn btn-secondary" style={{ cursor: uploading ? "not-allowed" : "pointer" }}>
                📁 Upload Folder
                <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFolderSelect}
                    style={{ display: "none" }}
                    disabled={uploading}
                />
            </label>

            {uploading && uploadProgress.length > 0 && (
                <div className="upload-progress-overlay">
                    <div className="upload-progress-modal">
                        <h3>Upload Folder Progress</h3>

                        <div className="total-progress" style={{ marginBottom: "1rem" }}>
                            <div className="progress-label">
                                Total: {Math.round(totalProgress)}% ({uploadProgress.filter(p => p.status === "success").length}/{uploadProgress.length})
                            </div>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${totalProgress}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="individual-progress" style={{ maxHeight: "300px", overflow: "auto" }}>
                            {uploadProgress.map((item) => (
                                <div key={item.id} className="file-progress-item">
                                    <div className="progress-info">
                                        <span className="file-name" style={{ fontSize: "0.85rem" }}>
                                            {item.fileName}
                                        </span>
                                        <span className={`status-badge ${item.status}`}>
                                            {item.status === "uploading" && "⏳"}
                                            {item.status === "saving" && "💾"}
                                            {item.status === "success" && "✅"}
                                            {item.status === "error" && "❌"}
                                        </span>
                                    </div>
                                    {item.status === "error" && item.error && (
                                        <div className="error-message" style={{ fontSize: "0.8rem", color: "#e74c3c" }}>
                                            {item.error}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FolderUpload;
