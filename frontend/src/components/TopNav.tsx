import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function TopNav() {
  const { pathname } = useLocation();
  const showLogout = pathname !== "/login";
  return (
    <header className="topnav">
      <div className="brand">
        <span className="brand__logo">🏥</span>
        <span className="brand__name">AI-MedAssistant</span>
      </div>
      {showLogout && (
        <nav className="menu">
          <Link className={pathname==="/" ? "active" : ""} to="/">Logout</Link>
        </nav>
      )}
    </header>
  );
}
