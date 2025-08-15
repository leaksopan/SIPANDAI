import React, { useState, useEffect } from 'react';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject 
} from 'firebase/storage';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { storage, db } from '../firebase/config';
import useAuth from '../hooks/useAuth';
import useUserRole from '../hooks/useUserRole';
import './FileManagerTab.css';

const FileManagerTab = () => {
  const { user } = useAuth();
  const { hasPermission, loading: roleLoading } = useUserRole();
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolder, setCurrentFolder] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [allFiles, setAllFiles] = useState([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // grid or list
  const [selectedItems, setSelectedItems] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);

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
      
      if (hasPermission('canAccessAllFiles')) {
        // Staff, Kepala Bidang, dan Super Admin bisa lihat semua file
        filesQuery = query(collection(db, 'files'));
      } else {
        // Guest hanya bisa lihat file mereka sendiri
        filesQuery = query(
          collection(db, 'files'),
          where('userId', '==', user.uid)
        );
      }
      
      const filesSnapshot = await getDocs(filesQuery);
      const filesData = filesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setAllFiles(filesData);
    } catch (error) {
      console.error('Error loading all files:', error);
    }
  };

  const loadFilesAndFolders = async () => {
    setLoading(true);
    try {
      await Promise.all([loadFiles(), loadFolders()]);
    } catch (error) {
      console.error('Error loading files and folders:', error);
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
      
      if (hasPermission('canAccessAllFiles')) {
        // Staff, Kepala Bidang, dan Super Admin bisa lihat semua file
        filesQuery = query(
          collection(db, 'files'),
          where('folder', '==', currentFolder || '')
        );
      } else {
        // Guest hanya bisa lihat file mereka sendiri
        filesQuery = query(
          collection(db, 'files'),
          where('userId', '==', user.uid),
          where('folder', '==', currentFolder || '')
        );
      }
      
      const filesSnapshot = await getDocs(filesQuery);
      const filesData = filesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setFiles(filesData);
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const loadFolders = async () => {
    try {
      // Jika role masih loading, skip untuk sementara
      if (roleLoading) {
        return;
      }
      
      let foldersQuery;
      
      if (hasPermission('canAccessAllFiles')) {
        // Staff, Kepala Bidang, dan Super Admin bisa lihat semua folder
        foldersQuery = query(
          collection(db, 'folders'),
          where('parentFolder', '==', currentFolder || '')
        );
      } else {
        // Guest hanya bisa lihat folder mereka sendiri
        foldersQuery = query(
          collection(db, 'folders'),
          where('userId', '==', user.uid),
          where('parentFolder', '==', currentFolder || '')
        );
      }
      
      const foldersSnapshot = await getDocs(foldersQuery);
      const foldersData = foldersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setFolders(foldersData);
    } catch (error) {
      console.error('Error loading folders:', error);
    }
  };

  const handleFileUpload = async () => {
    if (!hasPermission('canUploadFiles')) {
      alert('Anda tidak memiliki permission untuk upload file');
      return;
    }
    
    if (!selectedFile) {
      alert('Pilih file terlebih dahulu');
      return;
    }

    if (isProcessing || uploading) {
      return; // Prevent multiple calls
    }

    setUploading(true);
    setIsProcessing(true);
    try {
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const filePath = currentFolder ? `${currentFolder}/${fileName}` : fileName;
      const storageRef = ref(storage, `users/${user.uid}/${filePath}`);
      
      const snapshot = await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(snapshot.ref);

      await addDoc(collection(db, 'files'), {
        name: selectedFile.name,
        originalName: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        url: downloadURL,
        storagePath: snapshot.ref.fullPath,
        folder: currentFolder || '',
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      setSelectedFile(null);
      document.getElementById('fileInput').value = '';
      
      // Reload files dan update allFiles state
      await loadFiles();
      
      // Update allFiles dengan file baru tanpa reload semua
      const newFileData = {
        id: 'temp_' + Date.now(), // temporary ID
        name: selectedFile.name,
        originalName: selectedFile.name,
        size: selectedFile.size,
        type: selectedFile.type,
        url: downloadURL,
        storagePath: snapshot.ref.fullPath,
        folder: currentFolder || '',
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      setAllFiles(prev => [newFileData, ...prev]);
      alert('File berhasil diupload!');
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Gagal mengupload file');
    } finally {
      setUploading(false);
      setIsProcessing(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!hasPermission('canCreateFolders')) {
      alert('Anda tidak memiliki permission untuk membuat folder');
      return;
    }
    
    if (!newFolderName.trim()) {
      alert('Nama folder tidak boleh kosong');
      return;
    }

    try {
      await addDoc(collection(db, 'folders'), {
        name: newFolderName,
        parentFolder: currentFolder || '',
        userId: user.uid,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      setNewFolderName('');
      setShowCreateFolder(false);
      await loadFolders();
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Gagal membuat folder');
    }
  };

  const handleDeleteFile = async (file) => {
    if (!window.confirm(`Hapus file ${file.name}?`)) return;

    try {
      const storageRef = ref(storage, file.storagePath);
      await deleteObject(storageRef);
      await deleteDoc(doc(db, 'files', file.id));
      
      // Update local state tanpa reload semua
      await loadFiles();
      setAllFiles(prev => prev.filter(f => f.id !== file.id));
      
      alert('File berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting file:', error);
      alert('Gagal menghapus file');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date) => {
    if (!date) return '';
    
    // Handle Firestore Timestamp
    if (date.toDate && typeof date.toDate === 'function') {
      return date.toDate().toLocaleDateString('id-ID');
    }
    
    // Handle Firestore Timestamp with seconds property
    if (date.seconds) {
      return new Date(date.seconds * 1000).toLocaleDateString('id-ID');
    }
    
    // Handle regular Date object or string
    return new Date(date).toLocaleDateString('id-ID');
  };

  const getFileIcon = (type) => {
    if (type.includes('image')) return '🖼️';
    if (type.includes('pdf')) return '📄';
    if (type.includes('word')) return '📝';
    if (type.includes('excel') || type.includes('spreadsheet')) return '📊';
    if (type.includes('video')) return '🎥';
    if (type.includes('audio')) return '🎵';
    return '📁';
  };

  const getBreadcrumb = () => {
    if (!currentFolder) return ['Beranda'];
    return ['Beranda', ...currentFolder.split('/')];
  };

  // Jika ada search term, cari di semua files. Jika tidak, tampilkan files di folder aktif
  const filteredFiles = searchTerm 
    ? allFiles.filter(file => 
        file.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : files.filter(file => 
        file.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

  const filteredFolders = folders.filter(folder => 
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
          <h2>📚 Arsip Digital Pemerintah</h2>
          <div className="breadcrumb">
            {getBreadcrumb().map((crumb, index) => (
              <span key={index}>
                {index > 0 && <span className="breadcrumb-separator">›</span>}
                <button 
                  className="breadcrumb-item"
                  onClick={() => {
                    if (index === 0) {
                      setCurrentFolder('');
                    } else {
                      const path = getBreadcrumb().slice(1, index).join('/');
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
          <div className="view-toggle">
            <button 
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              ⊞
            </button>
            <button 
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              ☰
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-left">
          {hasPermission('canCreateFolders') && (
            <button 
              className="btn btn-primary"
              onClick={() => setShowCreateFolder(true)}
            >
              📁 Buat Folder
            </button>
          )}
          {hasPermission('canUploadFiles') && (
            <label className="btn btn-secondary">
              📤 Upload File
              <input
                id="fileInput"
                type="file"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                style={{ display: 'none' }}
              />
            </label>
          )}
          {selectedFile && hasPermission('canUploadFiles') && (
            <button 
              className="btn btn-success"
              onClick={handleFileUpload}
              disabled={uploading || isProcessing}
            >
              {uploading || isProcessing ? '⏳ Uploading...' : '✅ Konfirmasi Upload'}
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
            {filteredFolders.map(folder => (
              <div 
                key={folder.id} 
                className="item folder-item"
                onDoubleClick={() => {
                  const newPath = currentFolder ? `${currentFolder}/${folder.name}` : folder.name;
                  setCurrentFolder(newPath);
                }}
              >
                <div className="item-icon">📁</div>
                <div className="item-info">
                  <div className="item-name">{folder.name}</div>
                  <div className="item-meta">Folder</div>
                </div>
              </div>
            ))}

            {/* Files */}
            {filteredFiles.map(file => (
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
                </div>
                <div className="item-actions">
                  {hasPermission('canDownloadFiles') && (
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
                  {hasPermission('canDeleteFiles') && (
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
                <p>Belum ada file atau folder di sini. Mulai dengan mengupload file atau membuat folder baru.</p>
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
                onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
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
              <button 
                className="btn btn-primary"
                onClick={handleCreateFolder}
              >
                Buat Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected File Preview */}
      {selectedFile && (
        <div className="selected-file-preview">
          <div className="preview-content">
            <span className="file-icon">{getFileIcon(selectedFile.type)}</span>
            <div className="file-details">
              <div className="file-name">{selectedFile.name}</div>
              <div className="file-size">{formatFileSize(selectedFile.size)}</div>
            </div>
            <button 
              className="remove-btn"
              onClick={() => {
                setSelectedFile(null);
                document.getElementById('fileInput').value = '';
              }}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileManagerTab;