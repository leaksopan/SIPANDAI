import React, { useState, useEffect } from "react";
import {
  ref,
  uploadBytes,
  getDownloadURL,
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
import * as XLSX from "xlsx";
import FolderUpload from "./FolderUpload";
import RenameModal from "./RenameModal";
import DocxViewer from "./DocxViewer";
import ExcelViewer from "./ExcelViewer";
import MoveModal from "./MoveModal";
import AdvancedSearch from "./AdvancedSearch";
import "./FileManagerTab.css";

const FileManagerTab = () => {
  const { user } = useAuth();
  const { hasPermission, loading: roleLoading } = useUserRole();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allFiles, setAllFiles] = useState([]);
  const [newFolderName, setNewFolderName] = useState("");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const [selectedItems, setSelectedItems] = useState([]); // {type: 'file'|'folder', id: string, data: object}
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [totalProgress, setTotalProgress] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [previewFile, setPreviewFile] = useState(null); // file untuk preview PDF
  const [csvRows, setCsvRows] = useState([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);
  const [uploaderInfoByUserId, setUploaderInfoByUserId] = useState({});
  const [renameItem, setRenameItem] = useState(null);
  const [renameType, setRenameType] = useState(null);
  const [clipboard, setClipboard] = useState([]); // Cut items
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({});

  useEffect(() => {
    if (user && !roleLoading) {
      loadFilesAndFolders();
    }
  }, [user, currentFolder, roleLoading, hasPermission]);

  // Load all files hanya saat pertama kali atau user berubah
  useEffect(() => {
    if (user && !roleLoading) {
      loadAllFiles();
    }
  }, [user, roleLoading, hasPermission]);

  const loadAllFiles = async () => {
    try {
      // Jika role masih loading, skip untuk sementara
      if (roleLoading) {
        return;
      }

      let filesQuery;

      if (hasPermission("canAccessAllFiles")) {
        // Staff, Kepala Bidang, dan Super Admin bisa lihat semua file
        filesQuery = query(collection(db, "files"));
      } else {
        // Guest hanya bisa lihat file mereka sendiri
        filesQuery = query(
          collection(db, "files"),
          where("userId", "==", user.uid)
        );
      }

      const filesSnapshot = await getDocs(filesQuery);
      const filesData = filesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setAllFiles(filesData);
      await fetchUploaderInfos(filesData);
    } catch (error) {
      console.error("Error loading all files:", error);
    }
  };

  const loadFilesAndFolders = async () => {
    setLoading(true);
    try {
      await Promise.all([loadFiles(), loadFolders()]);
    } catch (error) {
      console.error("Error loading files and folders:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async () => {
    try {
      // Jika role masih loading, skip untuk sementara
      if (roleLoading) {
        return;
      }

      let filesQuery;

      if (hasPermission("canAccessAllFiles")) {
        // Staff, Kepala Bidang, dan Super Admin bisa lihat semua file
        filesQuery = query(
          collection(db, "files"),
          where("folder", "==", currentFolder || "")
        );
      } else {
        // Guest hanya bisa lihat file mereka sendiri
        filesQuery = query(
          collection(db, "files"),
          where("userId", "==", user.uid),
          where("folder", "==", currentFolder || "")
        );
      }

      const filesSnapshot = await getDocs(filesQuery);
      const filesData = filesSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setFiles(filesData);
      await fetchUploaderInfos(filesData);
    } catch (error) {
      console.error("Error loading files:", error);
    }
  };

  const fetchUploaderInfos = async (filesList) => {
    try {
      const knownIds = new Set(Object.keys(uploaderInfoByUserId));
      const uniqueIds = Array.from(
        new Set((filesList || []).map((f) => f.userId).filter(Boolean))
      ).filter((id) => !knownIds.has(id));

      if (uniqueIds.length === 0) return;

      const updates = {};
      for (const uid of uniqueIds) {
        try {
          const snap = await getDocs(
            query(collection(db, "users"), where("uid", "==", uid))
          );
          const docData = snap.docs[0]?.data();
          if (docData) {
            updates[uid] = {
              displayName: docData.displayName || docData.name || "Pengguna",
              email: docData.email || "",
            };
          } else {
            updates[uid] = { displayName: uid, email: "" };
          }
        } catch (e) {
          updates[uid] = { displayName: uid, email: "" };
        }
      }

      if (Object.keys(updates).length > 0) {
        setUploaderInfoByUserId((prev) => ({ ...prev, ...updates }));
      }
    } catch (e) {
      // abaikan: info uploader opsional
    }
  };

  const loadFolders = async () => {
    try {
      // Jika role masih loading, skip untuk sementara
      if (roleLoading) {
        return;
      }

      let foldersQuery;

      if (hasPermission("canAccessAllFiles")) {
        // Staff, Kepala Bidang, dan Super Admin bisa lihat semua folder
        foldersQuery = query(
          collection(db, "folders"),
          where("parentFolder", "==", currentFolder || "")
        );
      } else {
        // Guest hanya bisa lihat folder mereka sendiri
        foldersQuery = query(
          collection(db, "folders"),
          where("userId", "==", user.uid),
          where("parentFolder", "==", currentFolder || "")
        );
      }

      const foldersSnapshot = await getDocs(foldersQuery);
      const foldersData = foldersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      setFolders(foldersData);
    } catch (error) {
      console.error("Error loading folders:", error);
    }
  };

  const handleDeleteFolder = async (folder) => {
    if (!hasPermission("canDeleteFolders")) {
      alert("Anda tidak memiliki permission untuk menghapus folder");
      return;
    }

    const folderPath = currentFolder
      ? `${currentFolder}/${folder.name}`
      : folder.name;

    try {
      // Cek apakah ada file di dalam folder ini (hanya level saat ini)
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

      if (!window.confirm(`Hapus folder \"${folder.name}\"?`)) return;

      await deleteDoc(doc(db, "folders", folder.id));
      await loadFolders();
      alert("Folder berhasil dihapus!");
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Gagal menghapus folder");
    }
  };

  const handleFileUpload = async () => {
    if (!hasPermission("canUploadFiles")) {
      alert("Anda tidak memiliki permission untuk upload file");
      return;
    }

    if (!selectedFiles || selectedFiles.length === 0) {
      alert("Pilih file terlebih dahulu");
      return;
    }

    if (isProcessing || uploading) {
      return; // Prevent multiple calls
    }

    setUploading(true);
    setIsProcessing(true);
    setUploadProgress({});
    setTotalProgress(0);

    const results = {
      success: [],
      failed: [],
    };

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        const fileId = `file_${i}_${Date.now()}`;

        try {
          // Update progress untuk file ini
          setUploadProgress((prev) => ({
            ...prev,
            [fileId]: { status: "uploading", progress: 0, fileName: file.name },
          }));

          const fileName = `${Date.now()}_${file.name}`;
          const filePath = currentFolder
            ? `${currentFolder}/${fileName}`
            : fileName;
          const storageRef = ref(storage, `users/${user.uid}/${filePath}`);

          // Upload file
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);

          // Update progress
          setUploadProgress((prev) => ({
            ...prev,
            [fileId]: { status: "saving", progress: 50, fileName: file.name },
          }));

          // Save to Firestore
          const docRef = await addDoc(collection(db, "files"), {
            name: file.name,
            originalName: file.name,
            size: file.size,
            type: file.type,
            url: downloadURL,
            storagePath: snapshot.ref.fullPath,
            folder: currentFolder || "",
            userId: user.uid,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Update progress - success
          setUploadProgress((prev) => ({
            ...prev,
            [fileId]: { status: "success", progress: 100, fileName: file.name },
          }));

          // Add to results
          results.success.push({
            file,
            id: docRef.id,
            url: downloadURL,
            storagePath: snapshot.ref.fullPath,
          });

          // Update allFiles dengan file baru
          const newFileData = {
            id: docRef.id,
            name: file.name,
            originalName: file.name,
            size: file.size,
            type: file.type,
            url: downloadURL,
            storagePath: snapshot.ref.fullPath,
            folder: currentFolder || "",
            userId: user.uid,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          setAllFiles((prev) => [newFileData, ...prev]);
        } catch (fileError) {
          console.error(`Error uploading file ${file.name}:`, fileError);

          // Update progress - failed
          setUploadProgress((prev) => ({
            ...prev,
            [fileId]: {
              status: "error",
              progress: 0,
              fileName: file.name,
              error: fileError.message,
            },
          }));

          results.failed.push({ file, error: fileError.message });
        }

        // Update total progress
        setTotalProgress(((i + 1) / selectedFiles.length) * 100);
      }

      // Clear selected files and reset input
      setSelectedFiles([]);
      document.getElementById("fileInput").value = "";

      // Reload files untuk sync
      await loadFiles();

      // Show results
      const successCount = results.success.length;
      const failedCount = results.failed.length;

      if (failedCount === 0) {
        alert(`✅ Berhasil upload ${successCount} file!`);
      } else if (successCount === 0) {
        alert(`❌ Gagal upload semua ${failedCount} file!`);
      } else {
        alert(
          `⚠️ Upload selesai: ${successCount} berhasil, ${failedCount} gagal.`
        );
      }
    } catch (error) {
      console.error("Error in batch upload:", error);
      alert("Gagal melakukan batch upload");
    } finally {
      setUploading(false);
      setIsProcessing(false);

      // Clear progress setelah 3 detik
      setTimeout(() => {
        setUploadProgress({});
        setTotalProgress(0);
      }, 3000);
    }
  };

  const handleCreateFolder = async () => {
    if (!hasPermission("canCreateFolders")) {
      alert("Anda tidak memiliki permission untuk membuat folder");
      return;
    }

    if (!newFolderName.trim()) {
      alert("Nama folder tidak boleh kosong");
      return;
    }

    try {
      await addDoc(collection(db, "folders"), {
        name: newFolderName,
        parentFolder: currentFolder || "",
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      setNewFolderName("");
      setShowCreateFolder(false);
      await loadFolders();
    } catch (error) {
      console.error("Error creating folder:", error);
      alert("Gagal membuat folder");
    }
  };

  const removeSelectedFile = (indexToRemove) => {
    setSelectedFiles((prev) =>
      prev.filter((_, index) => index !== indexToRemove)
    );
  };

  const clearAllSelectedFiles = () => {
    setSelectedFiles([]);
    document.getElementById("fileInput").value = "";
  };

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Hapus file ${file.name}?`)) return;

    try {
      const storageRef = ref(storage, file.storagePath);
      await deleteObject(storageRef);
      await deleteDoc(doc(db, "files", file.id));

      // Update local state tanpa reload semua
      await loadFiles();
      setAllFiles((prev) => prev.filter((f) => f.id !== file.id));

      alert("File berhasil dihapus!");
    } catch (error) {
      console.error("Error deleting file:", error);
      alert("Gagal menghapus file");
    }
  };

  // Toggle selection
  const toggleSelection = (type, id, data) => {
    setSelectedItems((prev) => {
      const exists = prev.find((item) => item.type === type && item.id === id);
      if (exists) {
        return prev.filter((item) => !(item.type === type && item.id === id));
      } else {
        return [...prev, { type, id, data }];
      }
    });
  };

  // Check if item is selected
  const isSelected = (type, id) => {
    return selectedItems.some((item) => item.type === type && item.id === id);
  };

  // Select all visible items
  const selectAll = () => {
    const allItems = [
      ...filteredFolders.map((f) => ({ type: "folder", id: f.id, data: f })),
      ...filteredFiles.map((f) => ({ type: "file", id: f.id, data: f })),
    ];
    setSelectedItems(allItems);
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedItems([]);
  };

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedItems.length === 0) return;

    const fileCount = selectedItems.filter((i) => i.type === "file").length;
    const folderCount = selectedItems.filter((i) => i.type === "folder").length;

    if (!window.confirm(
      `Hapus ${fileCount} file dan ${folderCount} folder?`
    )) return;

    setIsProcessing(true);
    const results = { success: 0, failed: 0 };

    try {
      for (const item of selectedItems) {
        try {
          if (item.type === "file") {
            const storageRef = ref(storage, item.data.storagePath);
            await deleteObject(storageRef);
            await deleteDoc(doc(db, "files", item.id));
            results.success++;
          } else if (item.type === "folder") {
            // Check if folder is empty
            const filesInFolder = query(
              collection(db, "files"),
              where("folder", "==", currentFolder ? `${currentFolder}/${item.data.name}` : item.data.name),
              limit(1)
            );
            const snapshot = await getDocs(filesInFolder);
            if (!snapshot.empty) {
              results.failed++;
              continue;
            }
            await deleteDoc(doc(db, "folders", item.id));
            results.success++;
          }
        } catch (error) {
          console.error("Error deleting item:", error);
          results.failed++;
        }
      }

      await loadFilesAndFolders();
      clearSelection();
      alert(`✅ Berhasil: ${results.success}, ❌ Gagal: ${results.failed}`);
    } catch (error) {
      console.error("Error in bulk delete:", error);
      alert("Gagal melakukan bulk delete");
    } finally {
      setIsProcessing(false);
    }
  };

  // Bulk download
  const handleBulkDownload = async () => {
    const files = selectedItems.filter((i) => i.type === "file");
    if (files.length === 0) {
      alert("Pilih file untuk download");
      return;
    }

    for (const item of files) {
      const link = document.createElement("a");
      link.href = item.data.url;
      link.download = item.data.name;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      await new Promise((resolve) => setTimeout(resolve, 500)); // Delay between downloads
    }

    alert(`✅ Download ${files.length} file dimulai!`);
  };

  // Copy (Ctrl+C)
  const handleCopy = () => {
    if (selectedItems.length === 0) {
      alert("Pilih item untuk di-copy");
      return;
    }
    setClipboard(selectedItems);
    alert(`📋 ${selectedItems.length} item di-copy. Tekan Ctrl+V untuk paste.`);
  };

  // Paste (Ctrl+V) - Langsung paste di current folder
  const handlePaste = async () => {
    if (clipboard.length === 0) {
      alert("Tidak ada item di clipboard");
      return;
    }

    if (!window.confirm(`Paste ${clipboard.length} item ke folder ini?`)) {
      return;
    }

    setIsProcessing(true);
    const results = { success: 0, failed: 0 };

    try {
      for (const item of clipboard) {
        try {
          if (item.type === "file") {
            // Copy file: duplicate di Firebase Storage + Firestore
            const originalRef = ref(storage, item.data.storagePath);
            const fileBlob = await fetch(item.data.url).then((r) => r.blob());

            const newFileName = `${Date.now()}_${item.data.name}`;
            const newPath = currentFolder ? `${currentFolder}/${newFileName}` : newFileName;
            const newStorageRef = ref(storage, `users/${user.uid}/${newPath}`);

            const snapshot = await uploadBytes(newStorageRef, fileBlob);
            const downloadURL = await getDownloadURL(snapshot.ref);

            await addDoc(collection(db, "files"), {
              name: item.data.name,
              originalName: item.data.name,
              size: item.data.size,
              type: item.data.type,
              url: downloadURL,
              storagePath: snapshot.ref.fullPath,
              folder: currentFolder || "",
              userId: user.uid,
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            results.success++;
          } else if (item.type === "folder") {
            // Copy folder: create new folder with same name
            const newFolderName = `${item.data.name}_copy`;
            await addDoc(collection(db, "folders"), {
              name: newFolderName,
              parentFolder: currentFolder || "",
              userId: user.uid,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            results.success++;
          }
        } catch (error) {
          console.error("Error pasting item:", error);
          results.failed++;
        }
      }

      await loadFilesAndFolders();
      setClipboard([]);
      clearSelection();

      if (results.failed === 0) {
        alert(`✅ Berhasil paste ${results.success} item!`);
      } else {
        alert(`⚠️ Selesai: ${results.success} berhasil, ${results.failed} gagal`);
      }
    } catch (error) {
      console.error("Error in paste operation:", error);
      alert("Gagal melakukan paste");
    } finally {
      setIsProcessing(false);
    }
  };

  // Move selected items
  const handleMove = () => {
    if (selectedItems.length === 0) {
      alert("Pilih item untuk dipindahkan");
      return;
    }
    setShowMoveModal(true);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+C - Copy
      if (e.ctrlKey && e.key === "c") {
        e.preventDefault();
        handleCopy();
      }
      // Ctrl+V - Paste
      if (e.ctrlKey && e.key === "v") {
        e.preventDefault();
        handlePaste();
      }
      // Ctrl+A - Select All
      if (e.ctrlKey && e.key === "a") {
        e.preventDefault();
        selectAll();
      }
      // Escape - Clear selection
      if (e.key === "Escape") {
        clearSelection();
        setClipboard([]);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItems, clipboard, currentFolder]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (date) => {
    if (!date) return "";

    // Handle Firestore Timestamp
    if (date.toDate && typeof date.toDate === "function") {
      return date.toDate().toLocaleDateString("id-ID");
    }

    // Handle Firestore Timestamp with seconds property
    if (date.seconds) {
      return new Date(date.seconds * 1000).toLocaleDateString("id-ID");
    }

    // Handle regular Date object or string
    return new Date(date).toLocaleDateString("id-ID");
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

  const getFileIcon = (type) => {
    if (type.includes("image")) return "🖼️";
    if (type.includes("pdf")) return "📄";
    if (type.includes("word")) return "📝";
    if (
      type.includes("excel") ||
      type.includes("spreadsheet") ||
      type.includes("csv")
    )
      return "📊";
    if (type.includes("video")) return "🎥";
    if (type.includes("audio")) return "🎵";
    return "📁";
  };

  const isPdfFile = (file) => {
    if (!file) return false;
    const type = (file.type || "").toLowerCase();
    const name = (file.name || "").toLowerCase();
    return type.includes("pdf") || name.endsWith(".pdf");
  };

  const isImageFile = (file) => {
    if (!file) return false;
    const type = (file.type || "").toLowerCase();
    const name = (file.name || "").toLowerCase();
    return (
      type.includes("image") ||
      /(\.png|\.jpe?g|\.gif|\.webp|\.bmp|\.svg)$/i.test(name)
    );
  };

  const isExcelFile = (file) => {
    if (!file) return false;
    const type = (file.type || "").toLowerCase();
    const name = (file.name || "").toLowerCase();
    return (
      type.includes("sheet") ||
      type.includes("excel") ||
      /(\.xlsx|\.xls)$/i.test(name)
    );
  };

  const isCsvFile = (file) => {
    if (!file) return false;
    const type = (file.type || "").toLowerCase();
    const name = (file.name || "").toLowerCase();
    return type.includes("csv") || /\.csv$/i.test(name);
  };

  const isDocxFile = (file) => {
    if (!file) return false;
    const type = (file.type || "").toLowerCase();
    const name = (file.name || "").toLowerCase();
    return (
      type.includes("wordprocessingml") ||
      type.includes("msword") ||
      /\.docx?$/i.test(name)
    );
  };

  const canPreviewFile = (file) =>
    isPdfFile(file) ||
    isImageFile(file) ||
    isExcelFile(file) ||
    isCsvFile(file) ||
    isDocxFile(file);

  // Simple CSV parser that handles quoted fields and commas inside quotes
  const parseCsv = (text, maxRows = 200) => {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const next = text[i + 1];
      if (inQuotes) {
        if (char === '"') {
          if (next === '"') {
            // escaped quote
            cell += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cell += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ",") {
          row.push(cell);
          cell = "";
        } else if (char === "\n" || char === "\r") {
          // handle CRLF and LF
          if (char === "\r" && next === "\n") i++;
          row.push(cell);
          rows.push(row);
          cell = "";
          row = [];
          if (rows.length >= maxRows) break;
        } else {
          cell += char;
        }
      }
    }
    // push last cell/row if any
    if (cell.length > 0 || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  };

  // CSV parsing dengan multiple fallback methods
  useEffect(() => {
    let cancelled = false;
    if (previewFile && isCsvFile(previewFile)) {
      (async () => {
        try {
          setCsvLoading(true);
          setCsvError(null);
          setCsvRows([]);

          // Method 1: Try direct fetch (might work in some cases)
          try {
            const response = await fetch(previewFile.url);
            if (cancelled) return;

            if (response.ok) {
              const text = await response.text();
              if (cancelled) return;
              setCsvRows(parseCsv(text));
              return; // Success, exit
            }
          } catch (directError) {
            console.log("Direct fetch failed, trying proxy method...");
          }

          // Method 2: Try with CORS proxy
          try {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
              previewFile.url
            )}`;
            const response = await fetch(proxyUrl);
            if (cancelled) return;

            if (response.ok) {
              const text = await response.text();
              if (cancelled) return;
              setCsvRows(parseCsv(text));
              return; // Success, exit
            }
          } catch (proxyError) {
            console.log("Proxy fetch failed, showing fallback viewer...");
          }

          // Method 3: If all else fails, show error and fallback to iframe
          throw new Error(
            "Tidak dapat memuat CSV untuk preview tabel, menggunakan viewer eksternal"
          );
        } catch (err) {
          if (cancelled) return;
          setCsvError(err.message || String(err));
        } finally {
          if (!cancelled) setCsvLoading(false);
        }
      })();
    } else {
      // reset when not CSV or closing
      setCsvRows([]);
      setCsvLoading(false);
      setCsvError(null);
    }
    return () => {
      cancelled = true;
    };
  }, [previewFile]);



  const getBreadcrumb = () => {
    if (!currentFolder) return ["Beranda"];
    return ["Beranda", ...currentFolder.split("/")];
  };

  // Apply advanced filters
  const applyAdvancedFilters = (filesList) => {
    return filesList.filter((file) => {
      // Search term
      if (advancedFilters.searchTerm) {
        const matchesName = file.name
          ?.toLowerCase()
          .includes(advancedFilters.searchTerm.toLowerCase());
        if (!matchesName) return false;
      }

      // File type
      if (advancedFilters.fileType) {
        const type = (file.type || "").toLowerCase();
        const name = (file.name || "").toLowerCase();
        let matches = false;

        switch (advancedFilters.fileType) {
          case "pdf":
            matches = type.includes("pdf") || name.endsWith(".pdf");
            break;
          case "word":
            matches =
              type.includes("word") ||
              type.includes("document") ||
              /\.docx?$/i.test(name);
            break;
          case "excel":
            matches =
              type.includes("excel") ||
              type.includes("spreadsheet") ||
              /\.xlsx?$/i.test(name);
            break;
          case "csv":
            matches = type.includes("csv") || name.endsWith(".csv");
            break;
          case "image":
            matches = type.includes("image");
            break;
          case "video":
            matches = type.includes("video");
            break;
          case "audio":
            matches = type.includes("audio");
            break;
          default:
            matches = true;
        }
        if (!matches) return false;
      }

      // Uploader
      if (advancedFilters.uploader && file.userId !== advancedFilters.uploader) {
        return false;
      }

      // Size range (in KB)
      if (advancedFilters.sizeMin || advancedFilters.sizeMax) {
        const fileSizeKB = file.size / 1024;
        if (advancedFilters.sizeMin && fileSizeKB < parseFloat(advancedFilters.sizeMin)) {
          return false;
        }
        if (advancedFilters.sizeMax && fileSizeKB > parseFloat(advancedFilters.sizeMax)) {
          return false;
        }
      }

      // Date range
      if (advancedFilters.dateFrom || advancedFilters.dateTo) {
        const fileDate = toJsDate(file.createdAt);
        if (!fileDate || Number.isNaN(fileDate.getTime())) return false;

        if (advancedFilters.dateFrom) {
          const start = new Date(advancedFilters.dateFrom);
          start.setHours(0, 0, 0, 0);
          if (fileDate < start) return false;
        }

        if (advancedFilters.dateTo) {
          const end = new Date(advancedFilters.dateTo);
          end.setHours(23, 59, 59, 999);
          if (fileDate > end) return false;
        }
      }

      return true;
    });
  };

  // Get unique uploaders for filter
  const getUniqueUploaders = () => {
    const uniqueUserIds = [...new Set(allFiles.map((f) => f.userId))];
    return uniqueUserIds
      .map((userId) => ({
        userId,
        displayName: uploaderInfoByUserId[userId]?.displayName || userId,
      }))
      .filter((u) => u.userId);
  };

  // Apply filters
  const hasAdvancedFilters = Object.values(advancedFilters).some((v) => v !== "");
  const filteredFiles = applyAdvancedFilters(hasAdvancedFilters ? allFiles : files);

  const filteredFolders = folders.filter((folder) => {
    if (advancedFilters.searchTerm) {
      return folder.name
        .toLowerCase()
        .includes(advancedFilters.searchTerm.toLowerCase());
    }
    return true;
  });

  if (!user) {
    return (
      <div className="file-manager-container">
        <div className="auth-required">
          <h3>Silakan login untuk mengakses File Manager</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="file-manager-container">
      {/* Header with Search */}
      <div className="file-manager-header">
        <div className="header-top">
          <div className="header-left">
            {currentFolder && (
              <button
                className="btn btn-secondary"
                onClick={() => {
                  const parts = currentFolder.split("/");
                  parts.pop();
                  setCurrentFolder(parts.join("/"));
                }}
                title="Kembali ke folder sebelumnya"
                aria-label="Kembali ke folder sebelumnya"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  marginRight: "8px",
                }}
              >
                ← Kembali
              </button>
            )}
            <h2>📚 Arsip Digital Pemerintah</h2>
            <div className="breadcrumb">
              {getBreadcrumb().map((crumb, index) => (
                <span key={index}>
                  {index > 0 && <span className="breadcrumb-separator">›</span>}
                  <button
                    className="breadcrumb-item"
                    onClick={() => {
                      if (index === 0) {
                        setCurrentFolder("");
                      } else {
                        const path = getBreadcrumb().slice(1, index).join("/");
                        setCurrentFolder(path);
                      }
                    }}
                  >
                    {crumb}
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="header-right">
            <div className="view-toggle">
              <button
                className={`view-btn ${viewMode === "grid" ? "active" : ""}`}
                onClick={() => setViewMode("grid")}
              >
                ⊞
              </button>
              <button
                className={`view-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => setViewMode("list")}
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar in Header */}
        <div className="header-search">
          <AdvancedSearch
            onFilterChange={setAdvancedFilters}
            uploaders={getUniqueUploaders()}
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          {selectedItems.length === 0 ? (
            <>
              {hasPermission("canCreateFolders") && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowCreateFolder(true)}
                >
                  📁 Buat Folder
                </button>
              )}
              {hasPermission("canUploadFiles") && (
                <>
                  <label className="btn btn-secondary">
                    📤 Upload File
                    <input
                      id="fileInput"
                      type="file"
                      multiple
                      onChange={(e) => {
                        const files = Array.from(e.target.files);
                        setSelectedFiles((prev) => [...prev, ...files]);
                      }}
                      style={{ display: "none" }}
                    />
                  </label>
                  <FolderUpload
                    user={user}
                    currentFolder={currentFolder}
                    onUploadComplete={loadFilesAndFolders}
                  />
                </>
              )}
              {selectedFiles.length > 0 && hasPermission("canUploadFiles") && (
                <button
                  className="btn btn-success"
                  onClick={handleFileUpload}
                  disabled={uploading || isProcessing}
                >
                  {uploading || isProcessing
                    ? `⏳ Uploading ${Object.keys(uploadProgress).length}/${selectedFiles.length}...`
                    : `✅ Upload ${selectedFiles.length} File${selectedFiles.length > 1 ? "s" : ""}`}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                className="btn btn-secondary"
                onClick={clearSelection}
              >
                ✕ Clear ({selectedItems.length})
              </button>
              {selectedItems.some((i) => i.type === "file") && (
                <button
                  className="btn btn-primary"
                  onClick={handleBulkDownload}
                  disabled={isProcessing}
                >
                  ⬇️ Download ({selectedItems.filter((i) => i.type === "file").length})
                </button>
              )}
              <button
                className="btn btn-secondary"
                onClick={handleCopy}
                disabled={isProcessing}
              >
                📋 Copy
              </button>
              <button
                className="btn btn-primary"
                onClick={handleMove}
                disabled={isProcessing}
                style={{ background: "#8b5cf6" }}
              >
                📦 Move ({selectedItems.length})
              </button>
              <button
                className="btn btn-danger"
                onClick={handleBulkDelete}
                disabled={isProcessing}
                style={{ background: "#ef4444" }}
              >
                🗑️ Delete ({selectedItems.length})
              </button>
            </>
          )}
        </div>
        <div className="toolbar-right">
          {selectedItems.length === 0 && (
            <>
              <button
                className="btn btn-secondary"
                onClick={selectAll}
                style={{ marginRight: "8px", fontSize: "0.9rem" }}
              >
                ☑️ Select All
              </button>
              {clipboard.length > 0 && (
                <button
                  className="btn btn-primary"
                  onClick={handlePaste}
                  style={{ marginRight: "8px", fontSize: "0.9rem", background: "#10b981" }}
                >
                  📋 Paste ({clipboard.length})
                </button>
              )}
            </>
          )}
          <span className="item-count">
            {filteredFolders.length + filteredFiles.length} item
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div className="content-area">
        {loading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Memuat data...</p>
          </div>
        ) : (
          <div className={`items-container ${viewMode}`}>
            {/* Folders */}
            {filteredFolders.map((folder) => (
              <div
                key={folder.id}
                className={`item folder-item ${isSelected("folder", folder.id) ? "selected" : ""} ${clipboard.some((i) => i.type === "folder" && i.id === folder.id) ? "cut" : ""}`}
                onDoubleClick={() => {
                  if (selectedItems.length === 0) {
                    const newPath = currentFolder
                      ? `${currentFolder}/${folder.name}`
                      : folder.name;
                    setCurrentFolder(newPath);
                  }
                }}
                style={{ position: "relative" }}
              >
                <input
                  type="checkbox"
                  checked={isSelected("folder", folder.id)}
                  onChange={() => toggleSelection("folder", folder.id, folder)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    top: "8px",
                    left: "8px",
                    width: "18px",
                    height: "18px",
                    cursor: "pointer",
                    zIndex: 10,
                  }}
                />
                <div className="item-icon">📁</div>
                <div className="item-info">
                  <div className="item-name">{folder.name}</div>
                  <div className="item-meta">Folder</div>
                </div>
                <div className="item-actions" style={{ marginLeft: "auto" }}>
                  {hasPermission("canCreateFolders") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameItem(folder);
                        setRenameType("folder");
                      }}
                      className="action-btn"
                      title="Rename folder"
                      style={{ background: "#3498db", color: "white" }}
                    >
                      ✏️
                    </button>
                  )}
                  {hasPermission("canDeleteFolders") && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFolder(folder);
                      }}
                      className="action-btn delete"
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
                className={`item file-item ${isSelected("file", file.id) ? "selected" : ""} ${clipboard.some((i) => i.type === "file" && i.id === file.id) ? "cut" : ""}`}
                style={{ position: "relative" }}
              >
                <input
                  type="checkbox"
                  checked={isSelected("file", file.id)}
                  onChange={() => toggleSelection("file", file.id, file)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: "absolute",
                    top: "8px",
                    left: "8px",
                    width: "18px",
                    height: "18px",
                    cursor: "pointer",
                    zIndex: 10,
                  }}
                />
                <div className="item-icon">{getFileIcon(file.type)}</div>
                <div className="item-info">
                  <div className="item-name">{file.name}</div>
                  {(advancedFilters.searchTerm || hasAdvancedFilters) && file.folder && (
                    <div className="item-path">📁 {file.folder}</div>
                  )}
                  <div className="item-meta">
                    {formatFileSize(file.size)} • {formatDate(file.createdAt)}
                  </div>
                  <div className="item-meta" style={{ color: "#9CA3AF" }}>
                    Diunggah oleh:{" "}
                    {uploaderInfoByUserId[file.userId]?.displayName ||
                      file.userId}
                  </div>
                </div>
                <div className="item-actions">
                  {canPreviewFile(file) && (
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="action-btn"
                      title="Preview"
                      style={{ background: "#6366f1", color: "white" }}
                    >
                      👁️
                    </button>
                  )}
                  {hasPermission("canDownloadFiles") && (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="action-btn download"
                      title="Download"
                    >
                      ⬇️
                    </a>
                  )}
                  {hasPermission("canUploadFiles") && (
                    <button
                      onClick={() => {
                        setRenameItem(file);
                        setRenameType("file");
                      }}
                      className="action-btn"
                      title="Rename"
                      style={{ background: "#3498db", color: "white" }}
                    >
                      ✏️
                    </button>
                  )}
                  {hasPermission("canDeleteFiles") && (
                    <button
                      onClick={() => handleDeleteFile(file)}
                      className="action-btn delete"
                      title="Hapus"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            ))}

            {filteredFolders.length === 0 && filteredFiles.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon">📂</div>
                <h3>Folder kosong</h3>
                <p>
                  Belum ada file atau folder di sini. Mulai dengan mengupload
                  file atau membuat folder baru.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Buat Folder Baru</h3>
              <button
                className="close-btn"
                onClick={() => setShowCreateFolder(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Nama folder"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="folder-input"
                onKeyPress={(e) => e.key === "Enter" && handleCreateFolder()}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCreateFolder(false)}
              >
                Batal
              </button>
              <button className="btn btn-primary" onClick={handleCreateFolder}>
                Buat Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Files Preview */}
      {selectedFiles.length > 0 && (
        <div className="selected-files-preview">
          <div className="preview-header">
            <h4>Files yang akan diupload ({selectedFiles.length})</h4>
            <button className="clear-all-btn" onClick={clearAllSelectedFiles}>
              🗑️ Hapus Semua
            </button>
          </div>
          <div className="files-list">
            {selectedFiles.map((file, index) => (
              <div key={`${file.name}_${index}`} className="file-preview-item">
                <span className="file-icon">{getFileIcon(file.type)}</span>
                <div className="file-details">
                  <div className="file-name" title={file.name}>
                    {file.name.length > 30
                      ? `${file.name.substring(0, 30)}...`
                      : file.name}
                  </div>
                  <div className="file-size">{formatFileSize(file.size)}</div>
                </div>
                <button
                  className="remove-file-btn"
                  onClick={() => removeSelectedFile(index)}
                  title="Hapus file ini"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Progress indicators saat upload */}
          {uploading && Object.keys(uploadProgress).length > 0 && (
            <div className="upload-progress-section">
              <div className="total-progress">
                <div className="progress-label">
                  Total Progress: {Math.round(totalProgress)}%
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${totalProgress}%` }}
                  ></div>
                </div>
              </div>

              <div className="individual-progress">
                {Object.entries(uploadProgress).map(([fileId, progress]) => (
                  <div key={fileId} className="file-progress-item">
                    <div className="progress-info">
                      <span className="file-name">{progress.fileName}</span>
                      <span className={`status-badge ${progress.status}`}>
                        {progress.status === "uploading" && "⏳ Uploading..."}
                        {progress.status === "saving" && "💾 Saving..."}
                        {progress.status === "success" && "✅ Success"}
                        {progress.status === "error" && "❌ Failed"}
                      </span>
                    </div>
                    {progress.status === "error" && progress.error && (
                      <div className="error-message">{progress.error}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DOCX Viewer */}
      {previewFile && isDocxFile(previewFile) && (
        <DocxViewer file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      {/* Excel Viewer */}
      {previewFile && isExcelFile(previewFile) && (
        <ExcelViewer file={previewFile} onClose={() => setPreviewFile(null)} />
      )}

      {/* PDF/Image/CSV Preview Modal */}
      {previewFile && !isDocxFile(previewFile) && !isExcelFile(previewFile) && (
        <div className="modal-overlay" onClick={() => setPreviewFile(null)}>
          <div
            className="modal"
            style={{
              width: "90vw",
              maxWidth: "1200px",
              height: "80vh",
              maxHeight: "800px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h3>Preview: {previewFile.name}</h3>
              <button
                className="close-btn"
                onClick={() => setPreviewFile(null)}
              >
                ✕
              </button>
            </div>
            <div
              className="modal-body"
              style={{ padding: 0, flex: 1, overflow: "hidden" }}
            >
              {isPdfFile(previewFile) && (
                <iframe
                  title={`preview-pdf-${previewFile.id}`}
                  src={`${previewFile.url}#toolbar=1&navpanes=0&view=FitH`}
                  style={{ width: "100%", height: "100%", border: "none" }}
                />
              )}
              {isImageFile(previewFile) && (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#111",
                  }}
                >
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                    }}
                  />
                </div>
              )}
              {isCsvFile(previewFile) && (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {csvLoading && (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                      <div
                        style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}
                      >
                        ⏳
                      </div>
                      <div>Memuat CSV...</div>
                    </div>
                  )}

                  {!csvLoading && csvRows.length > 0 && (
                    <div>
                      <div
                        style={{
                          marginBottom: "1rem",
                          padding: "8px 12px",
                          backgroundColor: "#dcfce7",
                          borderRadius: "6px",
                          border: "1px solid #22c55e",
                          fontSize: "0.9rem",
                          color: "#166534",
                        }}
                      >
                        ✅ <strong>CSV berhasil dimuat!</strong> Menampilkan{" "}
                        {csvRows.length} baris data.
                      </div>
                      <div
                        style={{
                          height: "calc(100% - 100px)",
                          overflow: "auto",
                        }}
                      >
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "0.9rem",
                            backgroundColor: "#ffffff",
                          }}
                        >
                          <tbody>
                            {csvRows.map((row, idx) => (
                              <tr
                                key={idx}
                                style={{
                                  backgroundColor:
                                    idx === 0
                                      ? "#f3f4f6"
                                      : idx % 2 === 0
                                        ? "#ffffff"
                                        : "#f9fafb",
                                }}
                              >
                                {row.map((cell, j) => (
                                  <td
                                    key={j}
                                    style={{
                                      border: "1px solid #e5e7eb",
                                      padding: "8px 12px",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      maxWidth: "200px",
                                      fontWeight: idx === 0 ? "600" : "normal",
                                    }}
                                  >
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {!csvLoading && csvError && (
                    <div>
                      <div
                        style={{
                          marginBottom: "1rem",
                          padding: "12px",
                          backgroundColor: "#fef3c7",
                          borderRadius: "8px",
                          border: "1px solid #f59e0b",
                        }}
                      >
                        <div style={{ color: "#92400e", fontSize: "0.9rem" }}>
                          ⚠️ <strong>Fallback Viewer:</strong> {csvError}
                        </div>
                      </div>

                      {/* Fallback ke Google Sheets viewer sebagai alternatif */}
                      <iframe
                        title={`preview-csv-fallback-${previewFile.id}`}
                        src={`https://docs.google.com/gview?url=${encodeURIComponent(
                          previewFile.url
                        )}&embedded=true`}
                        style={{
                          width: "100%",
                          height: "calc(100% - 80px)",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          backgroundColor: "#ffffff",
                        }}
                        onLoad={() =>
                          console.log("Fallback CSV preview loaded")
                        }
                        onError={() =>
                          console.log("Fallback CSV preview failed")
                        }
                      />
                    </div>
                  )}

                  {!csvLoading && !csvError && csvRows.length === 0 && (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "2rem",
                        color: "#6b7280",
                      }}
                    >
                      <div
                        style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}
                      >
                        📄
                      </div>
                      <div>Tidak ada data untuk ditampilkan.</div>
                    </div>
                  )}
                </div>
              )}
              {!canPreviewFile(previewFile) && (
                <div style={{ padding: "1rem" }}>
                  Pratinjau tidak didukung untuk tipe ini.
                </div>
              )}
            </div>
            <div className="modal-footer">
              <a
                href={previewFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                Buka di Tab Baru
              </a>
              <a href={previewFile.url} download className="btn btn-secondary">
                Download
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {renameItem && (
        <RenameModal
          item={renameItem}
          type={renameType}
          onClose={() => {
            setRenameItem(null);
            setRenameType(null);
          }}
          onSuccess={() => {
            loadFilesAndFolders();
            setRenameItem(null);
            setRenameType(null);
          }}
        />
      )}

      {/* Move Modal */}
      {showMoveModal && (
        <MoveModal
          items={clipboard.length > 0 ? clipboard : selectedItems}
          currentFolder={currentFolder}
          user={user}
          onClose={() => setShowMoveModal(false)}
          onSuccess={() => {
            loadFilesAndFolders();
            clearSelection();
            setClipboard([]);
          }}
        />
      )}
    </div>
  );
};

export default FileManagerTab;
