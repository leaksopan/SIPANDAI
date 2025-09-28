import React from "react";
import LoginButton from "./components/LoginButton";
import Dashboard from "./components/Dashboard";
import useAuth from "./hooks/useAuth";
import "./App.css";

const App = () => {
  const { user, loading } = useAuth();

  // Show loading state
  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
            padding: "48px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "4px solid #e5e5e5",
              borderTop: "4px solid #3b82f6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px auto",
            }}
          ></div>
          <p
            style={{
              color: "#6b7280",
              margin: 0,
              fontSize: "16px",
            }}
          >
            Memuat SMART-ID...
          </p>
        </div>
      </div>
    );
  }

  // Show dashboard if user is logged in
  if (user) {
    return <Dashboard />;
  }

  // Show login page if user is not logged in
  return <LoginButton />;
};

export default App;
