
import { createNotificationFromEvent } from "../services/notificationService.js";

export const handleBookingEvent = async (event) => {
  const result = await createNotificationFromEvent(event);

  if (result.duplicate) {
    console.log(
      `Duplicate booking event ignored: ${event.eventId}`
    );
  } else {
    console.log(
      `Notification job created for event: ${event.eventId}`
    );
  }

  return result;
};
