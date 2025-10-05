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
  const [selectedItems, setSelectedItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [totalProgress, setTotalProgress] = useState(0);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [previewFile, setPreviewFile] = useState(null); // file untuk preview PDF
  const [csvRows, setCsvRows] = useState([]);
  const [csvLoading, setCsvLoading] = useState(false);
  const [csvError, setCsvError] = useState(null);
  const [xlsxRows, setXlsxRows] = useState([]);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [xlsxError, setXlsxError] = useState(null);
  const [xlsxSheets, setXlsxSheets] = useState([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [uploaderInfoByUserId, setUploaderInfoByUserId] = useState({});

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

  const canPreviewFile = (file) =>
    isPdfFile(file) ||
    isImageFile(file) ||
    isExcelFile(file) ||
    isCsvFile(file);

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

  // XLSX parsing dengan multiple fallback methods
  useEffect(() => {
    let cancelled = false;
    if (previewFile && isExcelFile(previewFile)) {
      (async () => {
        try {
          setXlsxLoading(true);
          setXlsxError(null);
          setXlsxRows([]);

          // Method 1: Try direct fetch (might work in some cases)
          try {
            console.log("🔄 XLSX Preview: Trying Method 1 - Direct Fetch");
            const response = await fetch(previewFile.url);
            if (cancelled) return;

            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              if (cancelled) return;

              const workbook = XLSX.read(arrayBuffer, { type: "array" });

              // Parse all sheets with merged cells support
              const sheetsData = workbook.SheetNames.map((sheetName, index) => {
                const worksheet = workbook.Sheets[sheetName];

                // Get sheet range
                const range = XLSX.utils.decode_range(
                  worksheet["!ref"] || "A1:A1"
                );

                // Get merged cells information
                const merges = worksheet["!merges"] || [];
                console.log(
                  `📊 Method 1 - Found ${merges.length} merged cell ranges in sheet "${sheetName}":`,
                  merges
                );
                const mergedCells = new Set();
                const mergeMap = new Map();

                // Process merged cells
                merges.forEach((merge) => {
                  const startRow = merge.s.r;
                  const endRow = merge.e.r;
                  const startCol = merge.s.c;
                  const endCol = merge.e.c;

                  // Mark all cells in merge range except top-left
                  for (let r = startRow; r <= endRow; r++) {
                    for (let c = startCol; c <= endCol; c++) {
                      const cellKey = `${r}-${c}`;
                      if (r === startRow && c === startCol) {
                        // Top-left cell gets merge info
                        mergeMap.set(cellKey, {
                          rowspan: endRow - startRow + 1,
                          colspan: endCol - startCol + 1,
                          isMergeStart: true,
                        });
                      } else {
                        // Other cells are marked as merged (hidden)
                        mergedCells.add(cellKey);
                      }
                    }
                  }
                });

                const jsonData = [];

                // Parse row by row dengan merged cells
                for (
                  let rowNum = range.s.r;
                  rowNum <= Math.min(range.e.r, range.s.r + 199);
                  rowNum++
                ) {
                  const row = [];
                  for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
                    const cellKey = `${rowNum}-${colNum}`;
                    const cellAddress = XLSX.utils.encode_cell({
                      r: rowNum,
                      c: colNum,
                    });
                    const cell = worksheet[cellAddress];
                    const cellValue = cell ? cell.w || cell.v || "" : "";

                    if (mergedCells.has(cellKey)) {
                      // Skip merged cells (will be handled by parent)
                      row.push({ hidden: true });
                    } else if (mergeMap.has(cellKey)) {
                      // Merged cell start
                      const mergeInfo = mergeMap.get(cellKey);
                      row.push({
                        value: cellValue,
                        rowspan: mergeInfo.rowspan,
                        colspan: mergeInfo.colspan,
                        isMerged: true,
                      });
                    } else {
                      // Normal cell
                      row.push({ value: cellValue });
                    }
                  }
                  jsonData.push(row);
                }

                return {
                  name: sheetName,
                  data: jsonData,
                  index: index,
                };
              });

              setXlsxSheets(sheetsData);
              setActiveSheet(0);
              setXlsxRows(sheetsData[0]?.data || []);
              console.log(
                "✅ XLSX Preview: Method 1 completed with merged cells support"
              );
              console.log(
                "📋 Parsed sheets:",
                sheetsData.map((s) => ({ name: s.name, rows: s.data.length }))
              );
              return; // Success, exit
            }
          } catch (directError) {
            console.log(
              "❌ XLSX Preview: Method 1 failed, trying proxy method...",
              directError
            );
          }

          // Method 2: Try with CORS proxy
          try {
            const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(
              previewFile.url
            )}`;
            const response = await fetch(proxyUrl);
            if (cancelled) return;

            if (response.ok) {
              const arrayBuffer = await response.arrayBuffer();
              if (cancelled) return;

              const workbook = XLSX.read(arrayBuffer, { type: "array" });

              // Parse all sheets with merged cells support (same as Method 1)
              const sheetsData = workbook.SheetNames.map((sheetName, index) => {
                const worksheet = workbook.Sheets[sheetName];

                // Get sheet range
                const range = XLSX.utils.decode_range(
                  worksheet["!ref"] || "A1:A1"
                );

                // Get merged cells information
                const merges = worksheet["!merges"] || [];
                console.log(
                  `📊 Method 2 - Found ${merges.length} merged cell ranges in sheet "${sheetName}":`,
                  merges
                );
                const mergedCells = new Set();
                const mergeMap = new Map();

                // Process merged cells
                merges.forEach((merge) => {
                  const startRow = merge.s.r;
                  const endRow = merge.e.r;
                  const startCol = merge.s.c;
                  const endCol = merge.e.c;

                  // Mark all cells in merge range except top-left
                  for (let r = startRow; r <= endRow; r++) {
                    for (let c = startCol; c <= endCol; c++) {
                      const cellKey = `${r}-${c}`;
                      if (r === startRow && c === startCol) {
                        // Top-left cell gets merge info
                        mergeMap.set(cellKey, {
                          rowspan: endRow - startRow + 1,
                          colspan: endCol - startCol + 1,
                          isMergeStart: true,
                        });
                      } else {
                        // Other cells are marked as merged (hidden)
                        mergedCells.add(cellKey);
                      }
                    }
                  }
                });

                const jsonData = [];

                // Parse row by row dengan merged cells
                for (
                  let rowNum = range.s.r;
                  rowNum <= Math.min(range.e.r, range.s.r + 199);
                  rowNum++
                ) {
                  const row = [];
                  for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
                    const cellKey = `${rowNum}-${colNum}`;
                    const cellAddress = XLSX.utils.encode_cell({
                      r: rowNum,
                      c: colNum,
                    });
                    const cell = worksheet[cellAddress];
                    const cellValue = cell ? cell.w || cell.v || "" : "";

                    if (mergedCells.has(cellKey)) {
                      // Skip merged cells (will be handled by parent)
                      row.push({ hidden: true });
                    } else if (mergeMap.has(cellKey)) {
                      // Merged cell start
                      const mergeInfo = mergeMap.get(cellKey);
                      row.push({
                        value: cellValue,
                        rowspan: mergeInfo.rowspan,
                        colspan: mergeInfo.colspan,
                        isMerged: true,
                      });
                    } else {
                      // Normal cell
                      row.push({ value: cellValue });
                    }
                  }
                  jsonData.push(row);
                }

                return {
                  name: sheetName,
                  data: jsonData,
                  index: index,
                };
              });

              setXlsxSheets(sheetsData);
              setActiveSheet(0);
              setXlsxRows(sheetsData[0]?.data || []);
              console.log(
                "✅ XLSX Preview: Method 2 completed with merged cells support"
              );
              return; // Success, exit
            }
          } catch (proxyError) {
            console.log(
              "❌ XLSX Preview: Method 2 failed, showing fallback viewer...",
              proxyError
            );
          }

          // Method 3: If all else fails, show error and fallback to iframe
          console.log(
            "❌ XLSX Preview: All methods failed, using fallback iframe viewer"
          );
          throw new Error(
            "Tidak dapat memuat XLSX untuk preview tabel, menggunakan viewer eksternal"
          );
        } catch (err) {
          if (cancelled) return;
          setXlsxError(err.message || String(err));
        } finally {
          if (!cancelled) setXlsxLoading(false);
        }
      })();
    } else {
      // reset when not XLSX or closing
      setXlsxRows([]);
      setXlsxLoading(false);
      setXlsxError(null);
      setXlsxSheets([]);
      setActiveSheet(0);
    }
    return () => {
      cancelled = true;
    };
  }, [previewFile]);

  // Handle sheet change
  const handleSheetChange = (sheetIndex) => {
    setActiveSheet(sheetIndex);
    setXlsxRows(xlsxSheets[sheetIndex]?.data || []);
  };

  const getBreadcrumb = () => {
    if (!currentFolder) return ["Beranda"];
    return ["Beranda", ...currentFolder.split("/")];
  };

  // Jika ada search term, cari di semua files. Jika tidak, tampilkan files di folder aktif
  const filteredFiles = (searchTerm ? allFiles : files).filter((file) => {
    const matchesText = file.name
      ?.toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesDate =
      !startDate && !endDate ? true : isWithinDateRange(file.createdAt);
    return matchesText && matchesDate;
  });

  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      {/* Header */}
      <div className="file-manager-header">
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
          <div className="search-box">
            <input
              type="text"
              placeholder="Cari file atau folder..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            <span className="search-icon">🔍</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#7f8c8d", fontSize: "0.9rem" }}>Dari</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  padding: "6px 8px",
                  border: "1px solid #e1e8ed",
                  borderRadius: "6px",
                }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ color: "#7f8c8d", fontSize: "0.9rem" }}>
                Sampai
              </span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  padding: "6px 8px",
                  border: "1px solid #e1e8ed",
                  borderRadius: "6px",
                }}
              />
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                }}
                className="btn btn-secondary"
                title="Reset filter tanggal"
              >
                Reset
              </button>
            )}
          </div>
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

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          {hasPermission("canCreateFolders") && (
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateFolder(true)}
            >
              📁 Buat Folder
            </button>
          )}
          {hasPermission("canUploadFiles") && (
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
          )}
          {selectedFiles.length > 0 && hasPermission("canUploadFiles") && (
            <button
              className="btn btn-success"
              onClick={handleFileUpload}
              disabled={uploading || isProcessing}
            >
              {uploading || isProcessing
                ? `⏳ Uploading ${Object.keys(uploadProgress).length}/${
                    selectedFiles.length
                  }...`
                : `✅ Upload ${selectedFiles.length} File${
                    selectedFiles.length > 1 ? "s" : ""
                  }`}
            </button>
          )}
        </div>
        <div className="toolbar-right">
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
                className="item folder-item"
                onDoubleClick={() => {
                  const newPath = currentFolder
                    ? `${currentFolder}/${folder.name}`
                    : folder.name;
                  setCurrentFolder(newPath);
                }}
                style={{ position: "relative" }}
              >
                <div className="item-icon">📁</div>
                <div className="item-info">
                  <div className="item-name">{folder.name}</div>
                  <div className="item-meta">Folder</div>
                </div>
                {hasPermission("canDeleteFolders") && (
                  <div className="item-actions" style={{ marginLeft: "auto" }}>
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
                  </div>
                )}
              </div>
            ))}

            {/* Files */}
            {filteredFiles.map((file) => (
              <div key={file.id} className="item file-item">
                <div className="item-icon">{getFileIcon(file.type)}</div>
                <div className="item-info">
                  <div className="item-name">{file.name}</div>
                  {searchTerm && file.folder && (
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

      {/* PDF Preview Modal */}
      {previewFile && (
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
              {isExcelFile(previewFile) && (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {xlsxLoading && (
                    <div style={{ textAlign: "center", padding: "2rem" }}>
                      <div
                        style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}
                      >
                        ⏳
                      </div>
                      <div>Memuat Excel...</div>
                    </div>
                  )}

                  {!xlsxLoading && xlsxRows.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        height: "100%",
                      }}
                    >
                      {/* Success message and sheet selector */}
                      <div style={{ marginBottom: "1rem", flexShrink: 0 }}>
                        <div
                          style={{
                            padding: "8px 12px",
                            backgroundColor: "#dcfce7",
                            borderRadius: "6px",
                            border: "1px solid #22c55e",
                            fontSize: "0.9rem",
                            color: "#166534",
                            marginBottom:
                              xlsxSheets.length > 1 ? "0.5rem" : "0",
                          }}
                        >
                          ✅ <strong>Excel berhasil dimuat!</strong> Menampilkan{" "}
                          {xlsxRows.length} baris data.
                        </div>

                        {/* Sheet selector jika ada multiple sheets */}
                        {xlsxSheets.length > 1 && (
                          <div
                            style={{
                              display: "flex",
                              gap: "4px",
                              flexWrap: "wrap",
                            }}
                          >
                            {xlsxSheets.map((sheet, index) => (
                              <button
                                key={index}
                                onClick={() => handleSheetChange(index)}
                                style={{
                                  padding: "4px 8px",
                                  fontSize: "0.8rem",
                                  border: "1px solid #e5e7eb",
                                  borderRadius: "4px",
                                  backgroundColor:
                                    activeSheet === index
                                      ? "#3b82f6"
                                      : "#ffffff",
                                  color:
                                    activeSheet === index
                                      ? "#ffffff"
                                      : "#374151",
                                  cursor: "pointer",
                                  transition: "all 0.2s ease",
                                }}
                                onMouseOver={(e) => {
                                  if (activeSheet !== index) {
                                    e.target.style.backgroundColor = "#f3f4f6";
                                  }
                                }}
                                onMouseOut={(e) => {
                                  if (activeSheet !== index) {
                                    e.target.style.backgroundColor = "#ffffff";
                                  }
                                }}
                              >
                                {sheet.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Table container dengan proper scroll */}
                      <div
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          border: "1px solid #e5e7eb",
                          borderRadius: "6px",
                          backgroundColor: "#ffffff",
                          position: "relative",
                        }}
                      >
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            overflow: "auto",
                            maxHeight: "100%",
                          }}
                        >
                          <table
                            style={{
                              width: "max-content",
                              minWidth: "100%",
                              borderCollapse: "collapse",
                              fontSize: "0.8rem",
                              tableLayout: "fixed",
                            }}
                          >
                            <tbody>
                              {xlsxRows.map((row, idx) => (
                                <tr key={idx}>
                                  {row.map((cell, j) => {
                                    // Skip hidden cells (part of merged cells)
                                    if (cell?.hidden) return null;

                                    const cellValue =
                                      typeof cell === "object"
                                        ? cell.value
                                        : cell;
                                    const cellLength = cellValue?.length || 10;

                                    return (
                                      <td
                                        key={j}
                                        rowSpan={cell?.rowspan || 1}
                                        colSpan={cell?.colspan || 1}
                                        style={{
                                          border: "1px solid #e5e7eb",
                                          padding: "8px 12px",
                                          whiteSpace: "pre-wrap",
                                          wordBreak: "break-word",
                                          overflowWrap: "break-word",
                                          width: `${Math.max(
                                            150,
                                            Math.min(300, cellLength * 8)
                                          )}px`,
                                          maxWidth: "300px",
                                          minWidth: "120px",
                                          fontWeight:
                                            idx === 0 ? "600" : "normal",
                                          fontSize: "0.8rem",
                                          lineHeight: "1.4",
                                          verticalAlign: "top",
                                          boxSizing: "border-box",
                                          textAlign: cell?.isMerged
                                            ? "center"
                                            : "left",
                                          backgroundColor: cell?.isMerged
                                            ? idx === 0
                                              ? "#f0f8ff"
                                              : "#fafafa"
                                            : idx === 0
                                            ? "#f8fafc"
                                            : idx % 2 === 0
                                            ? "#ffffff"
                                            : "#f9fafb",
                                        }}
                                      >
                                        {cellValue || ""}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {!xlsxLoading && xlsxError && (
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
                          ⚠️ <strong>Fallback Viewer:</strong> {xlsxError}
                        </div>
                      </div>

                      {/* Fallback ke Microsoft Office Online viewer sebagai alternatif */}
                      <iframe
                        title={`preview-xlsx-fallback-${previewFile.id}`}
                        src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
                          previewFile.url
                        )}`}
                        style={{
                          width: "100%",
                          height: "calc(100% - 80px)",
                          border: "1px solid #e5e7eb",
                          borderRadius: "8px",
                          backgroundColor: "#ffffff",
                        }}
                        onLoad={() =>
                          console.log("Fallback XLSX preview loaded")
                        }
                        onError={() =>
                          console.log("Fallback XLSX preview failed")
                        }
                      />
                    </div>
                  )}

                  {!xlsxLoading && !xlsxError && xlsxRows.length === 0 && (
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
                        📊
                      </div>
                      <div>Tidak ada data untuk ditampilkan.</div>
                    </div>
                  )}
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
    </div>
  );
};

export default FileManagerTab;
