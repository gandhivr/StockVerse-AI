import { useState, useEffect } from "react";

export function useBeginnerMode() {
  const [isBeginner, setIsBeginner] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("stockverse_beginner_mode") === "true";
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setIsBeginner(localStorage.getItem("stockverse_beginner_mode") === "true");
    };

    window.addEventListener("beginner-mode-changed", handleStorageChange);
    return () => {
      window.removeEventListener("beginner-mode-changed", handleStorageChange);
    };
  }, []);

  const toggleBeginnerMode = () => {
    const nextVal = !isBeginner;
    localStorage.setItem("stockverse_beginner_mode", String(nextVal));
    setIsBeginner(nextVal);
    window.dispatchEvent(new Event("beginner-mode-changed"));
  };

  return [isBeginner, toggleBeginnerMode] as const;
}
