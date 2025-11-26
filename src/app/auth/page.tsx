"use client";

import { useState } from "react";

export default function AuthPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    const res = await fetch("/api/login", {
      method: 'POST',
      body: JSON.stringify({ password }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      window.location.href = "/";
    } else {
      setError("Sai mật khẩu");
    }
  };

  return (
    <div style={{
      display: "flex",
      height: "100vh",
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: "#1f1f2e",
      fontFamily: "'Lexend Deca', sans-serif"
    }}>
      <div style={{
        backgroundColor: "#27293d",
        padding: "40px 30px",
        borderRadius: 12,
        boxShadow: "0 10px 25px rgba(0,0,0,0.3)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        minWidth: 300
      }}>
        <h2 style={{ color: "#fff", marginBottom: 20 }}>Đăng nhập</h2>
        <input
          type="password"
          placeholder="Nhập mật khẩu"
          value={password}
          onChange={e => setPassword(e.target.value)}
          style={{
            padding: "12px 15px",
            marginBottom: 15,
            borderRadius: 8,
            border: "1px solid #444",
            backgroundColor: "#1f1f2e",
            color: "#fff",
            width: "100%",
            outline: "none",
            transition: "border 0.2s",
          }}
          onFocus={e => e.currentTarget.style.border = "1px solid #4cd964"}
          onBlur={e => e.currentTarget.style.border = "1px solid #444"}
        />
        <button
          onClick={submit}
          style={{
            padding: "12px 15px",
            borderRadius: 8,
            border: "none",
            backgroundColor: "#4cd964",
            color: "#fff",
            fontWeight: 600,
            cursor: "pointer",
            width: "100%",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = "#42c85a"}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = "#4cd964"}
        >
          Đăng nhập
        </button>
        {error && <p style={{ color: "#ff6b6b", marginTop: 15 }}>{error}</p>}
      </div>
    </div>
  );
}
