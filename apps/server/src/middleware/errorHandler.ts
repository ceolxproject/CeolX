import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export const errorHandler = (err: Error, c: Context) => {
  console.error("[API Error]", { message: err.message, path: c.req.path });

  if (err instanceof HTTPException) {
    return c.json(
      {
        error: err.constructor.name,
        code: `HTTP_${err.status}`,
        message: err.message,
        statusCode: err.status,
      },
      err.status,
    );
  }

  return c.json(
    {
      error: "InternalServerError",
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
      statusCode: 500,
    },
    500,
  );
};
