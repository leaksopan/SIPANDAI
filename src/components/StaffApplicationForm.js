import React, { useState, useEffect } from "react";
import { collection, addDoc, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase/config";
import useAuth from "../hooks/useAuth";

const StaffApplicationForm = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    nama: "",
    section: "",
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [checkingApplication, setCheckingApplication] = useState(true);

  const sections = ["Irban", "Auditor/Pengawas"];

  // Cek apakah user sudah pernah submit aplikasi
  useEffect(() => {
    const checkExistingApplication = async () => {
      if (!user) return;

      try {
        const q = query(
          collection(db, "staff_applications"),
          where("userId", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          // User sudah pernah submit aplikasi
          setSuccess(true);
        }
      } catch (err) {
        console.error("Error checking existing application:", err);
      } finally {
        setCheckingApplication(false);
      }
    };

    checkExistingApplication();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.nama || !formData.section) {
      setError("Nama dan Section harus diisi");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const applicationData = {
        userId: user.uid,
        userEmail: user.email,
        userDisplayName: user.displayName,
        userPhotoURL: user.photoURL,
        nama: formData.nama,
        section: formData.section,
        status: "pending", // pending, approved, rejected
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await addDoc(collection(db, "staff_applications"), applicationData);

      setSuccess(true);
      setFormData({ nama: "", section: "" });
    } catch (err) {
      console.error("Error submitting application:", err);
      setError("Gagal mengirim aplikasi. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  // Loading state saat cek aplikasi
  if (checkingApplication) {
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
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid #e5e5e5",
              borderTop: "3px solid #3b82f6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          <p style={{ color: "#6b7280", margin: 0 }}>
            Memeriksa status aplikasi...
          </p>
        </div>
      </div>
    );
  }

  if (success) {
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
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <div
            style={{
              width: "80px",
              height: "80px",
              backgroundColor: "#dcfce7",
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "36px",
            }}
          >
            ✅
          </div>

          <div>
            <h2
              style={{
                fontSize: "28px",
                fontWeight: "700",
                color: "#1f2937",
                margin: "0 0 12px 0",
              }}
            >
              Aplikasi Berhasil Dikirim!
            </h2>
            <p
              style={{
                fontSize: "16px",
                color: "#6b7280",
                margin: 0,
                maxWidth: "400px",
              }}
            >
              Aplikasi Anda untuk menjadi staff telah dikirim dan sedang
              menunggu persetujuan dari Super Admin atau Kepala Bidang.
            </p>
          </div>

          {/* <button
            onClick={() => setSuccess(false)}
            style={{
              padding: "12px 24px",
              backgroundColor: "#3b82f6",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500",
              marginTop: "16px",
            }}
          >
            Kembali ke Dashboard
          </button> */}
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "white",
        borderRadius: "12px",
        boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
        padding: "32px",
      }}
    >
      <div
        style={{
          marginBottom: "32px",
          textAlign: "center",
        }}
      >
        <h2
          style={{
            fontSize: "24px",
            fontWeight: "700",
            color: "#1f2937",
            margin: "0 0 8px 0",
          }}
        >
          📝 Aplikasi Menjadi Staff
        </h2>
        <p
          style={{
            color: "#6b7280",
            margin: 0,
            fontSize: "16px",
          }}
        >
          Isi form di bawah untuk mengajukan diri menjadi staff
        </p>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "24px",
            color: "#dc2626",
            textAlign: "center",
          }}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
              marginBottom: "8px",
            }}
          >
            Nama Lengkap
          </label>
          <input
            type="text"
            name="nama"
            value={formData.nama}
            onChange={handleInputChange}
            placeholder="Masukkan nama lengkap Anda"
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "16px",
              outline: "none",
              transition: "border-color 0.2s",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
            onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "14px",
              fontWeight: "600",
              color: "#374151",
              marginBottom: "8px",
            }}
          >
            Jabatan yang dipilih
          </label>
          <select
            name="section"
            value={formData.section}
            onChange={handleInputChange}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "16px",
              outline: "none",
              transition: "border-color 0.2s",
              backgroundColor: "white",
              boxSizing: "border-box",
            }}
            onFocus={(e) => (e.target.style.borderColor = "#3b82f6")}
            onBlur={(e) => (e.target.style.borderColor = "#d1d5db")}
          >
            <option value="">Pilih Section</option>
            {sections.map((section) => (
              <option key={section} value={section}>
                {section}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "16px 24px",
            backgroundColor: loading ? "#9ca3af" : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: loading ? "not-allowed" : "pointer",
            fontSize: "16px",
            fontWeight: "600",
            transition: "all 0.2s",
            marginTop: "8px",
          }}
          onMouseOver={(e) => {
            if (!loading) {
              e.target.style.backgroundColor = "#2563eb";
              e.target.style.transform = "translateY(-1px)";
            }
          }}
          onMouseOut={(e) => {
            if (!loading) {
              e.target.style.backgroundColor = "#3b82f6";
              e.target.style.transform = "translateY(0)";
            }
          }}
        >
          {loading ? "Mengirim..." : "Kirim Aplikasi"}
        </button>
      </form>
    </div>
  );
};

export default StaffApplicationForm;
