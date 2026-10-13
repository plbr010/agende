"use client";

import { useEffect } from "react";
import { scrollToHash } from "./hash-link";

export function MarketingHashOnLoad() {
  useEffect(() => {
    if (window.location.hash) {
      scrollToHash(window.location.hash);
    }
  }, []);
  return null;
}
