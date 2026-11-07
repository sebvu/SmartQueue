"use client";

import { useState, useEffect } from "react";

export default function Page() {
  const [username, setUsername] = useState("N/A");
  const [email, setEmail] = useState("N/A");

  // set username and email to display
  (async () => {
    try {
      const response = await fetch("api/me/profile", {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("API call for get profile failed");
      }

      const data = (await response.json()).data;

      setUsername(data.fullName);
      setEmail(data.email);
    } catch (err) {
      console.error(err);
    }
  })();

  return (
    <div>
      <header>Profile Page (unstyled)</header>

      <p>Username: {username}</p>
      <p>Email: {email}</p>
    </div>
  );
}
