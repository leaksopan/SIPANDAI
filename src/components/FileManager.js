import React, { useState, useEffect } from "react";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  listAll,
  deleteObject,
} from "firebase/storage";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  doc,
  limit,
} from "firebase/firestore";
import { storage, db } from "../firebase/config";
import useAuth from "../hooks/useAuth";
import useUserRole from "../hooks/useUserRole";

const FileManager = () => {
  const { user } = useAuth();
  const { hasPermission } = useUserRole();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Load files dan folders saat komponen dimount atau folder berubah
  useEffect(() => {
    if (user) {
      console.log("FileManager: User authenticated, UID:", user.uid);
      loadFilesAndFolders();
    } else {
      console.log("FileManager: No user authenticated");
    }
  }, [user, currentFolder]);

  const loadFilesAndFolders = async () => {
    setLoading(true);
    try {
      await Promise.all([loadFiles(), loadFolders()]);
    } catch (error) {
      console.error("Error loading files and folders:", error);
      alert("Gagal memuat file dan folder");
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      console.log(
        "Loading files for user:",
        user.uid,
        "folder:",
        currentFolder || ""
      );

      // Coba query dengan orderBy terlebih dahulu
      try {
        const filesQuery = query(
          collection(db, "files"),
          where("userId", "==", user.uid),
          where("folder", "==", currentFolder || ""),
          orderBy("createdAt", "desc")
        );

        const filesSnapshot = await getDocs(filesQuery);
        const filesData = filesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setFiles(filesData);
      } catch (indexError) {
        console.warn(
          "Index belum tersedia, menggunakan query sederhana:",
          indexError
        );

        // Fallback tanpa orderBy jika index belum tersedia
        const simpleQuery = query(
          collection(db, "files"),
          where("userId", "==", user.uid),
          where("folder", "==", currentFolder || "")
        );

        const filesSnapshot = await getDocs(simpleQuery);
        const filesData = filesSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => {
            // Sort secara manual jika tidak bisa orderBy
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
          });

        setFiles(filesData);
      }
    } catch (error) {
      console.error("Error loading files:", error);
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        userId: user?.uid,
        folder: currentFolder,
      });
      setFiles([]);
    }
  };

  const loadFolders = async () => {
    try {
      // Coba query dengan orderBy terlebih dahulu
      try {
        const foldersQuery = query(
          collection(db, "folders"),
          where("userId", "==", user.uid),
          where("parentFolder", "==", currentFolder || ""),
          orderBy("createdAt", "desc")
        );

        const foldersSnapshot = await getDocs(foldersQuery);
        const foldersData = foldersSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setFolders(foldersData);
      } catch (indexError) {
        console.warn(
          "Index belum tersedia, menggunakan query sederhana:",
          indexError
        );

        // Fallback tanpa orderBy jika index belum tersedia
        const simpleQuery = query(
          collection(db, "folders"),
          where("userId", "==", user.uid),
          where("parentFolder", "==", currentFolder || "")
        );

        const foldersSnapshot = await getDocs(simpleQuery);
        const foldersData = foldersSnapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          .sort((a, b) => {
            // Sort secara manual jika tidak bisa orderBy
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
          });

        setFolders(foldersData);
      }
    } catch (error) {
      console.error("Error loading folders:", error);
      console.error("Error details:", {
        code: error.code,
        message: error.message,
        userId: user?.uid,
        folder: currentFolder,
      });
      setFolders([]);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Pilih file terlebih dahulu");
      return;
    }

    if (isProcessing || uploading) {
      return; // Prevent multiple calls
    }

    setUploading(true);
    setIsProcessing(true);
    try {
      console.log("Upload debug - User:", user.uid, "Folder:", currentFolder);
      // Upload file ke Storage
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const filePath = currentFolder
        ? `${currentFolder}/${fileName}`
        : fileName;
      const storageRef = ref(storage, `users/${user.uid}/${filePath}`);
      console.log("Storage path:", `users/${user.uid}/${filePath}`);

      const snapshot = await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // Simpan metadata file ke Firestore
      console.log(
        "Firestore debug - userId:",
        user.uid,
        "folder:",
        currentFolder || ""
      );
      await addDoc(collection(db, "files"), {
        name: selectedFile.name,
        originalName: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        url: downloadURL,
        storagePath: snapshot.ref.fullPath,
        folder: currentFolder || "",
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log("Firestore save success");

      // Reset form dan reload files
      setSelectedFile(null);
      document.getElementById("fileInput").value = "";
      await loadFiles();
      alert("File berhasil diupload!");
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Gagal mengupload file");
    } finally {
      setUploading(false);
      setIsProcessing(false);
    }
  };

  const handleDownload = async (file) => {
    try {
      const link = document.createElement("a");
      link.href = file.url;
      link.download = file.originalName;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Error downloading file:", error);
      alert("Gagal mendownload file");
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) {
      alert("Nama folder tidak boleh kosong");
      return;
    }

    try {
      await addDoc(collection(db, "folders"), {
        name: newFolderName.trim(),
        parentFolder: currentFolder || "",
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      setNewFolderName("");
      setShowCreateFolder(false);
      await loadFolders();
      alert("Folder berhasil dibuat!");
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Gagal membuat folder");
    }
  };

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Hapus file "${file.originalName}"?`)) {
      return;
    }

    try {
      // Hapus file dari Storage
      const storageRef = ref(storage, file.storagePath);
      await deleteObject(storageRef);

      // Hapus metadata dari Firestore
      await deleteDoc(doc(db, "files", file.id));

      await loadFiles();
      alert("File berhasil dihapus!");
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Gagal menghapus file");
    }
  };

  const handleDeleteFolder = async (folder) => {
    try {
      const folderPath = currentFolder
        ? `${currentFolder}/${folder.name}`
        : folder.name;

      // Cek apakah ada file di dalam folder ini
      const filesInFolderQuery = query(
        collection(db, "files"),
        where("folder", "==", folderPath),
        limit(1)
      );
      const filesSnapshot = await getDocs(filesInFolderQuery);
      if (!filesSnapshot.empty) {
        alert("Masih ada file di dalam, hapus dulu semua");
        return;
      }

      if (!window.confirm(`Hapus folder "${folder.name}"?`)) {
        return;
      }

      // Hapus folder dari Firestore
      await deleteDoc(doc(db, "folders", folder.id));

      await loadFolders();
      alert("Folder berhasil dihapus!");
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Gagal menghapus folder");
    }
  };

  const enterFolder = (folderName) => {
    const newPath = currentFolder
      ? `${currentFolder}/${folderName}`
      : folderName;
    setCurrentFolder(newPath);
  };

  const goBack = () => {
    const pathParts = currentFolder.split("/");
    pathParts.pop();
    setCurrentFolder(pathParts.join("/"));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (date) => {
    return new Date(date.seconds * 1000).toLocaleDateString("id-ID", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const toJsDate = (d) => {
    if (!d) return null;
    if (typeof d?.toDate === "function") return d.toDate();
    if (typeof d?.seconds === "number") return new Date(d.seconds * 1000);
    return new Date(d);
  };

  const isWithinDateRange = (d) => {
    const fileDate = toJsDate(d);
    if (!fileDate || Number.isNaN(fileDate.getTime())) return false;

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (fileDate < start) return false;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      if (fileDate > end) return false;
    }

    return true;
  };

  // Filter files berdasarkan search term
  const filteredFiles = files.filter((file) => {
    const matchesText = file.originalName
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesDate =
      !startDate && !endDate ? true : isWithinDateRange(file.createdAt);
    return matchesText && matchesDate;
  });

  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Check if user has permission to view files
  if (!hasPermission("canViewFiles")) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="text-center py-12">
            <span className="text-6xl">🔒</span>
            <h3 className="text-xl font-medium text-red-600 mt-4">
              Access Denied
            </h3>
            <p className="text-gray-500 mt-2">
              Anda tidak memiliki permission untuk mengakses File Manager.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">File Manager</h2>
            <p className="text-gray-600 mt-1">
              {currentFolder ? `📁 ${currentFolder}` : "📁 Root"}
            </p>
          </div>

          {/* Navigation */}
          {currentFolder && (
            <button
              onClick={goBack}
              className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
            >
              ← Kembali
            </button>
          )}
        </div>

        {/* Search Bar */}
        <div className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="text"
              placeholder="Cari file atau folder..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 min-w-[48px]">Dari</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 min-w-[64px]">
                Sampai
              </label>
              <div className="flex gap-2 w-full">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
                    title="Reset filter tanggal"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        {hasPermission("canUploadFiles") && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-700 mb-3">Upload File</h3>
            <div className="flex items-center gap-4">
              <input
                id="fileInput"
                type="file"
                onChange={handleFileSelect}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploading || isProcessing}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                {uploading || isProcessing ? "⏳" : "📤"}
                {uploading || isProcessing ? "Uploading..." : "Upload"}
              </button>
            </div>
          </div>
        )}

        {/* Create Folder Section */}
        {hasPermission("canCreateFolders") && (
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-700">Buat Folder</h3>
              <button
                onClick={() => setShowCreateFolder(!showCreateFolder)}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {showCreateFolder ? "Batal" : "📁 Buat Folder"}
              </button>
            </div>

            {showCreateFolder && (
              <div className="flex items-center gap-4">
                <input
                  type="text"
                  placeholder="Nama folder..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
                />
                <button
                  onClick={handleCreateFolder}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Buat
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-2 text-gray-600">Memuat...</p>
          </div>
        )}

        {/* Files and Folders Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Folders */}
            {filteredFolders.map((folder) => (
              <div
                key={folder.id}
                className="bg-blue-50 border border-blue-200 rounded-lg p-4 hover:bg-blue-100 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div
                    onClick={() => enterFolder(folder.name)}
                    className="flex items-center gap-3 flex-1"
                  >
                    <span className="text-2xl">📁</span>
                    <div>
                      <h4 className="font-medium text-gray-800">
                        {folder.name}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {formatDate(folder.createdAt)}
                      </p>
                    </div>
                  </div>
                  {hasPermission("canDeleteFolders") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder);
                      }}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Hapus folder"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Files */}
            {filteredFiles.map((file) => (
              <div
                key={file.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <span className="text-2xl">
                      {file.type.startsWith("image/")
                        ? "🖼️"
                        : file.type.startsWith("video/")
                        ? "🎥"
                        : file.type.startsWith("audio/")
                        ? "🎵"
                        : file.type.includes("pdf")
                        ? "📄"
                        : file.type.includes("document")
                        ? "📝"
                        : "📎"}
                    </span>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-800 truncate">
                        {file.originalName}
                      </h4>
                      <p className="text-sm text-gray-600">
                        {formatFileSize(file.size)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(file.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    {hasPermission("canDownloadFiles") && (
                      <button
                        onClick={() => handleDownload(file)}
                        className="text-blue-500 hover:text-blue-700 p-1"
                        title="Download file"
                      >
                        ⬇️
                      </button>
                    )}
                    {hasPermission("canDeleteFiles") && (
                      <button
                        onClick={() => handleDeleteFile(file)}
                        className="text-red-500 hover:text-red-700 p-1"
                        title="Hapus file"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading &&
          filteredFiles.length === 0 &&
          filteredFolders.length === 0 && (
            <div className="text-center py-12">
              <span className="text-6xl">📁</span>
              <h3 className="text-xl font-medium text-gray-600 mt-4">
                {searchTerm ? "Tidak ada hasil pencarian" : "Folder kosong"}
              </h3>
              <p className="text-gray-500 mt-2">
                {searchTerm
                  ? "Coba kata kunci lain"
                  : "Upload file atau buat folder untuk memulai"}
              </p>
            </div>
          )}
      </div>
    </div>
  );
};

export default FileManager;
