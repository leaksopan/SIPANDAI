import React, { useState } from "react";
import useAuth from "../hooks/useAuth";

const LoginButton = () => {
  const {
    user,
    loading,
    error,
    handleGoogleLogin,
    handleEmailPasswordLogin,
    handleEmailPasswordRegister,
    handleLogout,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isLoginMode, setIsLoginMode] = useState(true);

  const handleEmailPasswordSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isLoginMode) {
        await handleEmailPasswordLogin(email, password);
      } else {
        await handleEmailPasswordRegister(email, password, displayName);
      }
    } catch (error) {
      // Error sudah dihandle di useAuth hook
    }
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: "12px 24px",
        }}
      >
        <div
          style={{
            width: "20px",
            height: "20px",
            border: "2px solid #e5e5e5",
            borderTop: "2px solid #3b82f6",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        ></div>
        <span style={{ marginLeft: "8px" }}>Memuat...</span>
      </div>
    );
  }

  if (user) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          padding: "24px",
          border: "1px solid #e5e5e5",
          borderRadius: "8px",
          backgroundColor: "#f9fafb",
        }}
      >
        {/* Logo
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: "8px",
          }}
        >
          <img
            src="/68_geografis-dan-iklim.png"
            alt="Logo SMART-ID"
            style={{
              width: "60px",
              height: "60px",
              objectFit: "contain",
              borderRadius: "6px",
            }}
          />
        </div> */}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          <img
            src={user.photoURL}
            alt={user.displayName}
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "50%",
              objectFit: "cover",
            }}
          />
          <div>
            <p style={{ margin: 0, fontWeight: "600" }}>{user.displayName}</p>
            <p style={{ margin: 0, fontSize: "14px", color: "#6b7280" }}>
              {user.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: "8px 16px",
            backgroundColor: "#ef4444",
            color: "white",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "14px",
            fontWeight: "500",
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = "#dc2626")}
          onMouseOut={(e) => (e.target.style.backgroundColor = "#ef4444")}
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
      }}
    >
      {/* Form Section - Kiri */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "60px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "400px",
            margin: "0 auto",
            backgroundColor: "white",
            padding: "40px",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
          }}
        >
          <h2
            style={{
              margin: "0 0 8px 0",
              fontSize: "24px",
              fontWeight: "700",
              color: "#1f2937",
              textAlign: "center",
            }}
          >
            Selamat Datang
          </h2>
          <p
            style={{
              margin: "0 0 24px 0",
              textAlign: "center",
              color: "#6b7280",
              fontSize: "14px",
            }}
          >
            Silakan login untuk mengakses dashboard
          </p>

          {error && (
            <div
              style={{
                padding: "12px",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                color: "#dc2626",
                fontSize: "14px",
                marginBottom: "24px",
              }}
            >
              {error}
            </div>
          )}

          {/* Form Email/Password */}
          <form
            onSubmit={handleEmailPasswordSubmit}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "20px",
            }}
          >
            {!isLoginMode && (
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "8px",
                    fontSize: "14px",
                    fontWeight: "500",
                    color: "#374151",
                  }}
                >
                  NAMA LENGKAP
                </label>
                <input
                  type="text"
                  placeholder="Masukkan nama lengkap"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "1px solid #d1d5db",
                    borderRadius: "8px",
                    fontSize: "16px",
                    boxSizing: "border-box",
                    backgroundColor: "#f9fafb",
                  }}
                />
              </div>
            )}
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                }}
              >
                USERNAME
              </label>
              <input
                type="email"
                placeholder="Masukkan email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "16px",
                  boxSizing: "border-box",
                  backgroundColor: "#f9fafb",
                }}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: "8px",
                  fontSize: "14px",
                  fontWeight: "500",
                  color: "#374151",
                }}
              >
                PASSWORD
              </label>
              <input
                type="password"
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  fontSize: "16px",
                  boxSizing: "border-box",
                  backgroundColor: "#f9fafb",
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "14px",
                backgroundColor: "#4f46e5",
                color: "white",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "16px",
                fontWeight: "600",
                marginTop: "8px",
              }}
              onMouseOver={(e) => (e.target.style.backgroundColor = "#4338ca")}
              onMouseOut={(e) => (e.target.style.backgroundColor = "#4f46e5")}
            >
              {isLoginMode ? "Masuk" : "Daftar"}
            </button>

            {/* <div style={{ textAlign: "center", margin: "16px 0" }}>
              <a
                href="#"
                style={{
                  color: "#4f46e5",
                  fontSize: "14px",
                  textDecoration: "none",
                }}
              >
                Lupa Password?
              </a>
            </div> */}

            <button
              type="button"
              onClick={() => setIsLoginMode(!isLoginMode)}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "transparent",
                color: "#6b7280",
                border: "none",
                cursor: "pointer",
                fontSize: "14px",
                textDecoration: "underline",
              }}
            >
              {isLoginMode
                ? "Belum punya akun? Daftar"
                : "Sudah punya akun? Masuk"}
            </button>
          </form>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "16px",
              margin: "24px 0",
            }}
          >
            <div
              style={{
                flex: 1,
                height: "1px",
                backgroundColor: "#e5e7eb",
              }}
            ></div>
            <span
              style={{
                color: "#6b7280",
                fontSize: "14px",
              }}
            >
              atau
            </span>
            <div
              style={{
                flex: 1,
                height: "1px",
                backgroundColor: "#e5e7eb",
              }}
            ></div>
          </div>

          <button
            onClick={() => handleGoogleLogin().catch(console.error)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "12px",
              width: "100%",
              padding: "12px 24px",
              backgroundColor: "#4285f4",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "500",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = "#3367d6")}
            onMouseOut={(e) => (e.target.style.backgroundColor = "#4285f4")}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Masuk dengan Google
          </button>
        </div>
      </div>

      {/* Logo Section - Kanan */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "100px",
          color: "white",
        }}
      >
        <div
          style={{
            textAlign: "center",
            width: "100%",
          }}
        >
          <img
            src="/68_geografis-dan-iklim.png"
            alt="Logo Kab Buleleng"
            style={{
              width: "400px",
              height: "400px",
              objectFit: "contain",
              marginBottom: "32px",
              filter: "drop-shadow(0 10px 20px rgba(0,0,0,0.3))",
            }}
          />
          <h1
            style={{
              margin: "0 0 16px 0",
              fontSize: "36px",
              fontWeight: "700",
              textShadow: "0 2px 4px rgba(0,0,0,0.3)",
            }}
          >
            SMART-ID
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "18px",
              opacity: 0.9,
              lineHeight: "1.6",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}
          >
            Inspektorat Daerah Kabupaten Buleleng
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "18px",
              opacity: 0.9,
              lineHeight: "1.6",
              textShadow: "0 1px 2px rgba(0,0,0,0.3)",
            }}
          >
            Sistem Manajemen Arsip Terpusat-Irban Dua
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginButton;
