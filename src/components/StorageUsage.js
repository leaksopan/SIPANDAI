import React, { useState, useEffect } from "react";
import { getStorage, ref, listAll, getMetadata } from "firebase/storage";
import app from "../firebase/config";
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

  const storage = getStorage(app);

  const formatBytes = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const calculateStorageUsage = async () => {
    try {
      setStorageInfo((prev) => ({ ...prev, loading: true, error: null }));

      if (!user) {
        throw new Error("User tidak terautentikasi");
      }

      let totalSize = 0;
      let fileCount = 0;

      // Fungsi rekursif untuk menghitung semua file di storage
      const calculateFolderSize = async (folderRef) => {
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
          for (const folderRef of result.prefixes) {
            await calculateFolderSize(folderRef);
          }
        } catch (error) {
          console.warn(`Error listing folder ${folderRef.fullPath}:`, error);
        }
      };

      if (isSuperAdmin) {
        // Super admin dapat melihat storage usage mereka sendiri + informasi sistem
        const userFolderRef = ref(storage, `users/${user.uid}`);
        await calculateFolderSize(userFolderRef);

        // Set flag khusus untuk super admin
        setStorageInfo((prev) => ({
          ...prev,
          isSuperAdminView: true,
        }));
      } else {
        // User biasa hanya melihat folder mereka sendiri
        const userFolderRef = ref(storage, `users/${user.uid}`);
        await calculateFolderSize(userFolderRef);
      }

      setStorageInfo({
        totalSize,
        fileCount,
        loading: false,
        error: null,
      });
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

  useEffect(() => {
    if (user) {
      calculateStorageUsage();
    }
  }, [user, isSuperAdmin]);

  const refreshData = () => {
    calculateStorageUsage();
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
              ? "Monitor penggunaan storage Anda (Super Admin: gunakan Firebase Console untuk monitoring sistem lengkap)"
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
              <strong>Limitation Firebase Storage Security Rules:</strong> Untuk
              alasan keamanan, Firebase tidak mengizinkan akses ke folder{" "}
              <code>users/</code> secara keseluruhan melalui client-side API.
            </p>
            <p style={{ margin: "0 0 8px 0" }}>
              <strong>Alternatif monitoring:</strong>
            </p>
            <ul style={{ margin: "0 0 8px 0", paddingLeft: "20px" }}>
              <li>
                Gunakan Firebase Console → Storage untuk monitoring lengkap
              </li>
              <li>
                Implementasi Firebase Cloud Functions untuk server-side
                monitoring
              </li>
              <li>
                Buat sistem tracking terpisah di Firestore untuk metadata file
              </li>
            </ul>
            <p style={{ margin: 0 }}>
              Data di atas menunjukkan penggunaan storage untuk akun Super Admin
              Anda sendiri.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default StorageUsage;
