
import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";

import { services } from "../config/services.js";

const router = express.Router();

const createServiceProxy = (target, backendPrefix) => {
  if (!target) {
    throw new Error(
      `Missing target URL for backend route ${backendPrefix}`
    );
  }

  return createProxyMiddleware({
    target,
    changeOrigin: true,

    pathRewrite: (path) => {
      const normalizedPath = path.startsWith("/")
        ? path
        : `/${path}`;

      return `${backendPrefix}${normalizedPath}`;
    },

    on: {
      error: (error, req, res) => {
        console.error(
          `Proxy error [${backendPrefix}]:`,
          error.message
        );

        if (!res.headersSent && !res.destroyed) {
          res.writeHead(502, {
            "Content-Type": "application/json",
          });

          res.end(
            JSON.stringify({
              success: false,
              message:
                "The requested service is currently unavailable",
            })
          );
        }
      },
    },
  });
};

router.use(
  "/users",
  createServiceProxy(services.user, "/api/users")
);

router.use(
  "/hotels",
  createServiceProxy(services.catalog, "/api/hotels")
);

router.use(
  "/rooms",
  createServiceProxy(services.catalog, "/api/rooms")
);

router.use(
  "/bookings",
  createServiceProxy(services.booking, "/api/bookings")
);

router.use(
  "/payments",
  createServiceProxy(services.payment, "/api/payments")
);

// Stripe webhook: preserve raw body and Stripe-Signature header.
router.use(
  "/webhooks/stripe",
  createServiceProxy(
    services.payment,
    "/api/webhooks/stripe"
  )
);

export default router;
