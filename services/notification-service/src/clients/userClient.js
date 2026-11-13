
const USER_SERVICE_URL = process.env.USER_SERVICE_URL;
const INTERNAL_SERVICE_SECRET =
  process.env.INTERNAL_SERVICE_SECRET;

const REQUEST_TIMEOUT_MS = 5000;

export const getUserDetails = async (userId) => {
  if (!userId) {
    throw new Error("User ID is required");
  }

  if (!USER_SERVICE_URL || !INTERNAL_SERVICE_SECRET) {
    throw new Error(
      "User Service configuration is missing"
    );
  }

  const baseUrl = USER_SERVICE_URL.replace(/\/+$/, "");

  const url =
    `${baseUrl}/internal/users/${encodeURIComponent(userId)}`;

  let response;

  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "x-internal-service-key": INTERNAL_SERVICE_SECRET,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    throw new Error(
      `User Service request failed: ${error.message}`
    );
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");

    throw new Error(
      `User Service returned ${response.status}: ${errorBody}`
    );
  }

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      "User Service returned invalid JSON"
    );
  }

  // User Service contract:
  // { success: true, data: user }
  if (result.success !== true || !result.data) {
    throw new Error(
      "User Service returned an invalid user response"
    );
  }

  const user = result.data;

  if (
    typeof user !== "object" ||
    Array.isArray(user)
  ) {
    throw new Error("Invalid user data from User Service");
  }

  if (user.status && user.status !== "ACTIVE") {
    throw new Error(
      `User account is not active: ${userId}`
    );
  }

  const email =
    typeof user.email === "string"
      ? user.email.trim().toLowerCase()
      : "";

  if (!email) {
    throw new Error(
      `No valid email address found for user ${userId}`
    );
  }

  const displayName =
    user.displayName?.trim() ||
    [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Customer";

  return {
    userId: user.clerkUserId,
    email,
    displayName,
  };
};
