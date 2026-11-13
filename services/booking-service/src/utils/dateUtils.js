
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

// Convert a date into UTC midnight.
export const normalizeDate = (date) => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    throw new Error("Invalid date");
  }

  return new Date(
    Date.UTC(
      parsedDate.getUTCFullYear(),
      parsedDate.getUTCMonth(),
      parsedDate.getUTCDate()
    )
  );
};

// Calculate the number of nights.
// Check-in is inclusive; checkout is exclusive.
export const calculateNights = (checkIn, checkOut) => {
  const start = normalizeDate(checkIn);
  const end = normalizeDate(checkOut);

  const difference = end.getTime() - start.getTime();

  if (difference <= 0) {
    throw new Error(
      "Check-out must be after check-in"
    );
  }

  return difference / DAY_IN_MILLISECONDS;
};

// Generate every night between check-in and checkout.
export const getStayDates = (checkIn, checkOut) => {
  const start = normalizeDate(checkIn);
  const nights = calculateNights(checkIn, checkOut);

  const dates = [];

  for (let i = 0; i < nights; i++) {
    dates.push(
      new Date(
        start.getTime() + i * DAY_IN_MILLISECONDS
      )
    );
  }

  return dates;
};
