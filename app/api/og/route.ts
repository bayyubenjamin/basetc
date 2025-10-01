// app/api/og/route.ts
export const runtime = "edge";
export const revalidate = 0;

// PNG ungu 1200x800 (3:2) kecil (<10KB), dibangun sekali via base64.
// (Ini contoh; cukup untuk memastikan Warpcast & browser bisa render.)
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAABJAAAAMgCAYAAAB3l4XbAAAACXBIWXMAAAsSAAALEgHS3X78AAAAGXRFWHRTb2Z0d2FyZQBwYWludC5uZXQgNC4yLjH9TnU4AAAAB3RJTUUH5QQBDwAM8w1w7QAAABl0RVh0Q3JlYXRpb24gVGltZQAwMS8wMS8wMVvN3mIAAAAjSURBVHja7cExAQAAAMKg9U/tbQ8gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwK4aDAAG3Tq1nAAAAAElFTkSuQmCC";

export async function GET(req: Request) {
  // optional query (ignored in sample): user, epoch, hint
  const png = Buffer.from(PNG_BASE64, "base64");
  return new Response(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

