import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Share2, Navigation, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

/**
 * DirectionsQR Component (Round 4g F5)
 * Encodes ONLY the Google Maps directions destination URL.
 * Strictly never encodes booking ID, personal data, or tokens.
 */
export const DirectionsQR = ({ coordinates, propertyName = "Property" }) => {
  const [qrDataUrl, setQrDataUrl] = useState(null);

  const hasCoords =
    coordinates &&
    typeof coordinates.lat === "number" &&
    typeof coordinates.lng === "number";

  const directionsUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`
    : "";

  useEffect(() => {
    if (!hasCoords || !directionsUrl) return;

    let isMounted = true;

    QRCode.toDataURL(directionsUrl, {
      width: 176,
      margin: 2,
      errorCorrectionLevel: "M",
      color: {
        dark: "#0b1220",
        light: "#ffffff",
      },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error("Failed to generate directions QR code:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [hasCoords, directionsUrl]);

  if (!hasCoords) {
    return null;
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(directionsUrl);
    toast.success("Link copied");
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Directions to ${propertyName}`,
          text: `Get directions to ${propertyName}`,
          url: directionsUrl,
        });
      } catch (err) {
        if (err.name !== "AbortError") {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 bg-white dark:bg-gray-900 text-left space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Navigation className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          Directions on your phone
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Scan with your phone to open directions in Google Maps
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* QR Code Canvas/Image */}
        <div className="w-[176px] h-[176px] bg-white p-2 rounded-lg border border-gray-200 shadow-sm shrink-0 flex items-center justify-center">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for directions to ${propertyName}`}
              aria-label={`QR code that opens directions to ${propertyName}`}
              className="w-full h-full object-contain"
              width={160}
              height={160}
            />
          ) : (
            <div className="w-full h-full bg-gray-100 animate-pulse rounded" />
          )}
        </div>

        {/* Text Actions & Alternative Links */}
        <div className="flex-1 space-y-2.5 w-full">
          <button
            type="button"
            onClick={handleCopyLink}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer min-h-[44px]"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy directions link
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors cursor-pointer min-h-[44px]"
          >
            <Share2 className="w-3.5 h-3.5" />
            Send directions
          </button>

          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center sm:text-left flex items-center gap-1.5 justify-center sm:justify-start">
            <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
            Please don't use your phone while driving.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DirectionsQR;
