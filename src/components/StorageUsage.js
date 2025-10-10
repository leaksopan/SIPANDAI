import React, { useState, useEffect } from "react";
import { getStorage, ref, listAll, getMetadata, deleteObject } from "firebase/storage";
import { collection, getDocs, query, where, doc, deleteDoc } from "firebase/firestore";
import app, { db } from "../firebase/config";
import useAuth from "../hooks/useAuth";
import useUserRole from "../hooks/useUserRole";

const StorageUsage = () => {
  const { user } = useAuth();
  const { isSuperAdmin } = useUserRole();

  const [storageInfo, setStorageInfo] = useState({
    totalSize: 0,
    fileCount: 0,
    loading: true,
    error: null,
    isSuperAdminView: false,
  });

  const [filesList, setFilesList] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userInfoCache, setUserInfoCache] = useState({});

  const storage = getStorage(app);

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const extractFolderPath = (fullPath) => {
    if (!fullPath || fullPath === "Unknown path") return "Unknown";

    // Remove "users/{userId}/" prefix and filename
    // Example: "users/ABC123/folder1/folder2/file.pdf" -> "folder1/folder2/"
    const parts = fullPath.split("/");

    // If path starts with "users/{userId}/", remove those parts
    let startIndex = 0;
    if (parts[0] === "users" && parts.length > 2) {
      startIndex = 2; // Skip "users" and userId
    }

    // Remove filename (last part)
    const folderParts = parts.slice(startIndex, -1);

    if (folderParts.length === 0) return "Root";
    return folderParts.join("/") + "/";
  };

  const getUserDisplayName = (userId) => {
    if (!userId || userId === "Unknown") return "Unknown User";

    // Check cache first
    if (userInfoCache[userId]) {
      return userInfoCache[userId];
    }

    // Return truncated UID while loading
    return userId.length > 8 ? userId.substring(0, 8) + "..." : userId;
  };

  // Fetch user info from Firestore
  const fetchUserInfo = async (userIds) => {
    const uniqueIds = [...new Set(userIds)].filter(id => id && id !== "Unknown" && !userInfoCache[id]);

    if (uniqueIds.length === 0) return;

    try {
      const updates = {};

      for (const uid of uniqueIds) {
        try {
          const userQuery = query(collection(db, "users"), where("uid", "==", uid));
          const userSnapshot = await getDocs(userQuery);

          if (!userSnapshot.empty) {
            const userData = userSnapshot.docs[0].data();
            updates[uid] = userData.displayName || userData.name || userData.email || uid;
          } else {
            updates[uid] = uid.substring(0, 8) + "...";
          }
        } catch (error) {
          console.warn(`Error fetching user info for ${uid}:`, error);
          updates[uid] = uid.substring(0, 8) + "...";
        }
      }

      if (Object.keys(updates).length > 0) {
        setUserInfoCache(prev => ({ ...prev, ...updates }));
      }
    } catch (error) {
      console.error("Error fetching user info:", error);
    }
  };

  const calculateStorageUsage = async () => {
    try {
      setStorageInfo((prev) => ({ ...prev, loading: true, error: null }));

      if (!user) {
        throw new Error("User tidak terautentikasi");
      }

      let totalSize = 0;
      let fileCount = 0;
      let filesArray = [];

      if (isSuperAdmin) {
        // Super admin: Hitung dari Firestore (semua file)
        try {
          // Query semua file dari Firestore
          const filesQuery = query(collection(db, "files"));
          const filesSnapshot = await getDocs(filesQuery);

          filesSnapshot.forEach((docSnap) => {
            const fileData = docSnap.data();
            if (fileData.size) {
              totalSize += fileData.size;
              fileCount++;
              filesArray.push({
                id: docSnap.id,
                name: fileData.name || "Unknown",
                size: fileData.size,
                path: fileData.storagePath || fileData.fullPath || fileData.path || "Unknown path",
                url: fileData.url || null,
                userId: fileData.userId || "Unknown",
                uploadedAt: fileData.uploadedAt || fileData.createdAt || null,
              });
            }
          });

          // Set flag khusus untuk super admin
          setStorageInfo((prev) => ({
            ...prev,
            isSuperAdminView: true,
          }));
        } catch (error) {
          console.warn(
            "Error accessing Firestore files, falling back to user files:",
            error
          );
          // Fallback: hitung dari folder user sendiri
          const userResult = await calculateUserStorage();
          totalSize = userResult.totalSize;
          fileCount = userResult.fileCount;
          filesArray = userResult.filesArray;
        }
      } else {
        // User biasa: hitung dari folder mereka sendiri
        const userResult = await calculateUserStorage();
        totalSize = userResult.totalSize;
        fileCount = userResult.fileCount;
        filesArray = userResult.filesArray;
      }

      // Sort by size descending
      filesArray.sort((a, b) => b.size - a.size);

      setFilesList(filesArray);
      setStorageInfo({
        totalSize,
        fileCount,
        loading: false,
        error: null,
      });

      // Fetch user info for all unique user IDs
      const userIds = filesArray.map(f => f.userId).filter(Boolean);
      if (userIds.length > 0) {
        await fetchUserInfo(userIds);
      }
    } catch (error) {
      console.error("Error calculating storage usage:", error);
      setStorageInfo({
        totalSize: 0,
        fileCount: 0,
        loading: false,
        error: error.message,
      });
    }
  };

  // Fungsi untuk menghitung storage user sendiri
  const calculateUserStorage = async () => {
    let totalSize = 0;
    let fileCount = 0;
    let filesArray = [];

    try {
      // Hitung dari Firestore (file user sendiri)
      const userFilesQuery = query(
        collection(db, "files"),
        where("userId", "==", user.uid)
      );
      const userFilesSnapshot = await getDocs(userFilesQuery);

      userFilesSnapshot.forEach((docSnap) => {
        const fileData = docSnap.data();
        if (fileData.size) {
          totalSize += fileData.size;
          fileCount++;
          filesArray.push({
            id: docSnap.id,
            name: fileData.name || "Unknown",
            size: fileData.size,
            path: fileData.storagePath || fileData.fullPath || fileData.path || "Unknown path",
            url: fileData.url || null,
            userId: fileData.userId || user.uid,
            uploadedAt: fileData.uploadedAt || fileData.createdAt || null,
          });
        }
      });
    } catch (error) {
      console.warn("Error accessing user files from Firestore:", error);
      // Fallback: hitung dari Firebase Storage langsung
      try {
        const userFolderRef = ref(storage, `users/${user.uid}`);
        const result = await calculateFolderSize(userFolderRef);
        totalSize = result.totalSize;
        fileCount = result.fileCount;
        filesArray = result.filesArray;
      } catch (storageError) {
        console.warn("Error accessing user storage folder:", storageError);
      }
    }

    return { totalSize, fileCount, filesArray };
  };

  // Fungsi rekursif untuk menghitung folder di storage (fallback)
  const calculateFolderSize = async (folderRef) => {
    let totalSize = 0;
    let fileCount = 0;

    try {
      const result = await listAll(folderRef);

      // Hitung file di folder ini
      for (const itemRef of result.items) {
        try {
          const metadata = await getMetadata(itemRef);
          totalSize += metadata.size;
          fileCount++;
        } catch (error) {
          console.warn(
            `Error getting metadata for ${itemRef.fullPath}:`,
            error
          );
        }
      }

      // Rekursif untuk subfolder
      for (const subFolderRef of result.prefixes) {
        const subResult = await calculateFolderSize(subFolderRef);
        totalSize += subResult.totalSize;
        fileCount += subResult.fileCount;
      }
    } catch (error) {
      console.warn(`Error listing folder ${folderRef.fullPath}:`, error);
    }

    return { totalSize, fileCount };
  };

  useEffect(() => {
    if (user) {
      calculateStorageUsage();
    }
  }, [user, isSuperAdmin]);

  const refreshData = () => {
    setSelectedFiles([]);
    calculateStorageUsage();
  };

  const handleSelectFile = (fileId) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleSelectAll = () => {
    if (selectedFiles.length === filesList.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(filesList.map((file) => file.id));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.length === 0) return;

    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus ${selectedFiles.length} file?`
    );

    if (!confirmDelete) return;

    setIsDeleting(true);

    try {
      const deletePromises = selectedFiles.map(async (fileId) => {
        const fileToDelete = filesList.find((f) => f.id === fileId);
        if (!fileToDelete) return;

        // Delete from Storage
        try {
          const fileRef = ref(storage, fileToDelete.path);
          await deleteObject(fileRef);
        } catch (storageError) {
          console.warn(`Error deleting file from storage: ${fileToDelete.path}`, storageError);
        }

        // Delete from Firestore
        try {
          await deleteDoc(doc(db, "files", fileId));
        } catch (firestoreError) {
          console.warn(`Error deleting file from Firestore: ${fileId}`, firestoreError);
        }
      });

      await Promise.all(deletePromises);

      alert(`Berhasil menghapus ${selectedFiles.length} file`);
      setSelectedFiles([]);
      calculateStorageUsage();
    } catch (error) {
      console.error("Error deleting files:", error);
      alert("Terjadi error saat menghapus file");
    } finally {
      setIsDeleting(false);
    }
  };

  if (storageInfo.loading) {
    return (
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          padding: "48px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "40px",
            border: "4px solid #e5e7eb",
            borderTop: "4px solid #3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 16px auto",
          }}
        />
        <p style={{ margin: 0, color: "#6b7280" }}>
          Menghitung penggunaan storage...
        </p>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  if (storageInfo.error) {
    return (
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          padding: "48px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>⚠️</div>
        <h3 style={{ margin: "0 0 8px 0", color: "#dc2626" }}>
          Error Memuat Data Storage
        </h3>
        <p style={{ margin: "0 0 24px 0", color: "#6b7280" }}>
          {storageInfo.error}
        </p>
        <button
          onClick={refreshData}
          style={{
            padding: "8px 16px",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Coba Lagi
        </button>
      </div>
    );
  }

  // Estimasi limit Firebase Storage (default 5GB untuk Spark plan)
  const storageLimit = 5 * 1024 * 1024 * 1024; // 5GB in bytes
  const usagePercentage = (storageInfo.totalSize / storageLimit) * 100;

  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
        padding: "32px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "24px",
              fontWeight: "700",
              color: "#1f2937",
              margin: "0 0 8px 0",
            }}
          >
            📊 Penggunaan Storage Firebase
          </h2>
          <p
            style={{
              margin: 0,
              color: "#6b7280",
              fontSize: "16px",
            }}
          >
            {storageInfo.isSuperAdminView
              ? "Monitor penggunaan storage sistem secara keseluruhan (semua user + shared + public folders)"
              : "Monitor penggunaan Cloud Storage untuk file Anda"}
          </p>
        </div>
        <button
          onClick={refreshData}
          style={{
            padding: "8px 16px",
            backgroundColor: "#f3f4f6",
            color: "#374151",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Storage Overview Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "24px",
          marginBottom: "32px",
        }}
      >
        {/* Total Size Card */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            padding: "24px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: "#dbeafe",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              💾
            </div>
            <div>
              <h3
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Total Ukuran File
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#1f2937",
                }}
              >
                {formatBytes(storageInfo.totalSize)}
              </p>
            </div>
          </div>
        </div>

        {/* File Count Card */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            padding: "24px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: "#dcfce7",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              📁
            </div>
            <div>
              <h3
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Jumlah File
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#1f2937",
                }}
              >
                {storageInfo.fileCount.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Usage Percentage Card */}
        <div
          style={{
            backgroundColor: "#f8fafc",
            padding: "24px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div
              style={{
                width: "40px",
                height: "40px",
                backgroundColor: usagePercentage > 80 ? "#fee2e2" : "#dbeafe",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
              }}
            >
              📊
            </div>
            <div>
              <h3
                style={{
                  margin: "0 0 4px 0",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "#374151",
                }}
              >
                Persentase Penggunaan
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: "24px",
                  fontWeight: "700",
                  color: usagePercentage > 80 ? "#dc2626" : "#1f2937",
                }}
              >
                {usagePercentage.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Usage Bar */}
      <div
        style={{
          backgroundColor: "#f8fafc",
          padding: "24px",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
        }}
      >
        <h3
          style={{
            margin: "0 0 16px 0",
            fontSize: "18px",
            fontWeight: "600",
            color: "#1f2937",
          }}
        >
          Status Penggunaan Storage
        </h3>

        <div style={{ marginBottom: "12px" }}>
          <div
            style={{
              width: "100%",
              height: "12px",
              backgroundColor: "#e5e7eb",
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${Math.min(usagePercentage, 100)}%`,
                height: "100%",
                backgroundColor: usagePercentage > 80 ? "#dc2626" : "#3b82f6",
                borderRadius: "6px",
                transition: "width 0.3s ease",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "14px",
            color: "#6b7280",
          }}
        >
          <span>0 GB</span>
          <span>
            {formatBytes(storageInfo.totalSize)} dari{" "}
            {formatBytes(storageLimit)}
          </span>
          <span>5 GB</span>
        </div>

        {usagePercentage > 80 && (
          <div
            style={{
              marginTop: "16px",
              padding: "12px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px" }}>⚠️</span>
              <span
                style={{
                  fontSize: "14px",
                  color: "#dc2626",
                  fontWeight: "500",
                }}
              >
                Storage hampir penuh! Pertimbangkan untuk membersihkan file yang
                tidak diperlukan.
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Files List */}
      <div
        style={{
          backgroundColor: "#f8fafc",
          padding: "24px",
          borderRadius: "8px",
          border: "1px solid #e2e8f0",
          marginTop: "24px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "18px",
              fontWeight: "600",
              color: "#1f2937",
            }}
          >
            📋 Daftar File (Urut dari Terbesar)
          </h3>
          {selectedFiles.length > 0 && (
            <button
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              style={{
                padding: "8px 16px",
                backgroundColor: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: isDeleting ? "not-allowed" : "pointer",
                fontSize: "14px",
                fontWeight: "500",
                opacity: isDeleting ? 0.6 : 1,
              }}
            >
              {isDeleting
                ? "Menghapus..."
                : `🗑️ Hapus ${selectedFiles.length} File`}
            </button>
          )}
        </div>

        {filesList.length > 0 && (
          <div
            style={{
              marginBottom: "12px",
              padding: "12px",
              backgroundColor: "#f3f4f6",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <input
              type="checkbox"
              checked={selectedFiles.length === filesList.length}
              onChange={handleSelectAll}
              style={{
                width: "18px",
                height: "18px",
                cursor: "pointer",
              }}
            />
            <span style={{ fontSize: "14px", fontWeight: "500", color: "#374151" }}>
              Pilih Semua ({filesList.length} file)
            </span>
          </div>
        )}

        <div
          style={{
            maxHeight: "500px",
            overflowY: "auto",
            border: "1px solid #e5e7eb",
            borderRadius: "6px",
          }}
        >
          {filesList.length === 0 ? (
            <div
              style={{
                padding: "48px",
                textAlign: "center",
                color: "#6b7280",
              }}
            >
              <div style={{ fontSize: "48px", marginBottom: "16px" }}>📂</div>
              <p style={{ margin: 0 }}>Tidak ada file ditemukan</p>
            </div>
          ) : (
            filesList.map((file, index) => (
              <div
                key={file.id}
                onDoubleClick={() => {
                  if (file.url) {
                    window.open(file.url, "_blank", "noopener,noreferrer");
                  } else {
                    alert("URL file tidak tersedia");
                  }
                }}
                title="Double-click untuk membuka file"
                style={{
                  padding: "16px",
                  borderBottom:
                    index < filesList.length - 1 ? "1px solid #e5e7eb" : "none",
                  backgroundColor: selectedFiles.includes(file.id)
                    ? "#eff6ff"
                    : "white",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  transition: "background-color 0.2s, transform 0.1s",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = selectedFiles.includes(file.id) ? "#dbeafe" : "#f9fafb";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = selectedFiles.includes(file.id) ? "#eff6ff" : "white";
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(file.id)}
                  onChange={() => handleSelectFile(file.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "18px",
                    height: "18px",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: "500",
                      color: "#1f2937",
                      marginBottom: "4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {file.name}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6b7280",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginTop: "2px",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flex: 1,
                      }}
                    >
                      📁 {extractFolderPath(file.path)}
                    </span>
                    <span
                      style={{
                        flexShrink: 0,
                        padding: "2px 8px",
                        backgroundColor: "#e0e7ff",
                        borderRadius: "4px",
                        fontSize: "11px",
                        color: "#4338ca",
                        fontWeight: "500",
                      }}
                    >
                      👤 {getUserDisplayName(file.userId)}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#3b82f6",
                    flexShrink: 0,
                  }}
                >
                  {formatBytes(file.size)}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Super Admin Information */}
      {storageInfo.isSuperAdminView && (
        <div
          style={{
            backgroundColor: "#f8fafc",
            padding: "20px",
            borderRadius: "8px",
            border: "1px solid #e2e8f0",
            marginTop: "24px",
          }}
        >
          <h3
            style={{
              margin: "0 0 12px 0",
              fontSize: "16px",
              fontWeight: "600",
              color: "#1f2937",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            ℹ️ Informasi untuk Super Admin
          </h3>
          <div
            style={{ fontSize: "14px", color: "#6b7280", lineHeight: "1.5" }}
          >
            <p style={{ margin: "0 0 8px 0" }}>
              <strong>Super Admin Storage Monitoring:</strong> Data di atas
              menunjukkan penggunaan storage sistem secara keseluruhan,
              termasuk:
            </p>
            <ul style={{ margin: "0 0 8px 0", paddingLeft: "20px" }}>
              <li>
                <strong>users/</strong> - Semua file dari semua user
              </li>
              <li>
                <strong>shared/</strong> - File yang dibagikan antar user
              </li>
              <li>
                <strong>public/</strong> - File publik yang dapat diakses semua
                user
              </li>
            </ul>
            <p style={{ margin: "0 0 8px 0" }}>
              <strong>Catatan:</strong> Jika ada error dalam mengakses storage
              sistem, akan otomatis fallback ke folder user Anda sendiri.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Firebase Console:</strong> Untuk monitoring yang lebih
              detail, gunakan Firebase Console → Storage.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageUsage;
