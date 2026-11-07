"use client";

import { useState, useEffect } from "react";

export default function Page() {
  const [username, setUsername] = useState("N/A");
  const [email, setEmail] = useState("N/A");

  async function getCurrentProfile() {
    await fetch();
  }

  return <header>Profile Page (unstyled)</header>;
}
