import React, { useState } from "react";
import { MapPin } from "lucide-react";
import { getOwnerCoordinates } from "../../lib/geo";
import { Button } from "../ui/Button";
import { EditPropertyModal } from "../EditPropertyModal";

export const MissingLocationNotice = ({ hotels = [] }) => {
  const [editingHotel, setEditingHotel] = useState(null);

  // Filter properties lacking valid owner coordinates
  const missing = hotels.filter((h) => !getOwnerCoordinates(h));

  if (!missing || missing.length === 0) {
    return null;
  }

  const count = missing.length;
  const targetHotel = missing[0];

  const noticeText =
    count === 1
      ? "Add your location so guests can see your property on the map"
      : `${count} properties are missing location. Add your location so guests can see your property on the map`;

  return (
    <>
      <div
        role="region"
        aria-label="Location notice"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-white/10 text-stone-700 dark:text-stone-300 shadow-2xs"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
          <span className="text-xs font-medium truncate">{noticeText}</span>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditingHotel(targetHotel)}
            className="rounded-[10px] text-xs font-semibold py-1.5 h-auto border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"
          >
            Add location
          </Button>
        </div>
      </div>

      {editingHotel && (
        <EditPropertyModal
          hotel={editingHotel}
          isOpen={Boolean(editingHotel)}
          onClose={() => setEditingHotel(null)}
          initialTab="location"
        />
      )}
    </>
  );
};

export default MissingLocationNotice;