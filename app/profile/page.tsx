"use client";

import { useState, useEffect } from "react";

export default function Page() {
  const [username, setUsername] = useState("N/A");
  const [email, setEmail] = useState("N/A");

	// set username super ugly
	(async () => {

	})().then((res) {

	});
	 
	// set email super ugly

  async function getCurrentProfile() {
    return await fetch();
  }

  return <header>Profile Page (unstyled)</header>;
}
