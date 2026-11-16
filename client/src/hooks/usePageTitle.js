import { useEffect } from "react";
import { BRAND_NAME } from "../config/brand";

export const usePageTitle = (pageTitle, description) => {
  useEffect(() => {
    const prevTitle = document.title;
    if (pageTitle) {
      const fullTitle = pageTitle.includes(BRAND_NAME)
        ? pageTitle
        : `${pageTitle} | ${BRAND_NAME}`;
      document.title = fullTitle;
    }

    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }
      meta.content = description;
    }

    return () => {
      document.title = prevTitle;
    };
  }, [pageTitle, description]);
};

export default usePageTitle;
