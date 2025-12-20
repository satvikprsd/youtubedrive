Here’s a clean, minimal **README.md** that matches your project’s vibe and explains it clearly without overdoing it.

---

# YouTube Drive

Unlimited* file storage powered by YouTube.

Upload any file, encode it into a YouTube-compatible format, and retrieve it later by decoding it back. Simple, fast, and minimal.

> ⚠️ This is a **demo / experimental project**.

---

## Features

* Encode files and upload them to YouTube
* Decode previously encoded files back to original form
* Drag & drop file upload
* Clean single-page UI
* Encode / Decode tab switch
* Loading, success, and error states
* Secure download links
* Max file size: **5MB**

---

## Tech Stack

**Frontend**

* Next.js (App Router)
* React
* TypeScript
* Tailwind CSS

**Backend**

* Any API that supports:

  * `POST /encode`
  * `POST /decode`
  * Multipart file uploads
  * JSON response with `download_url`

---

## How It Works

1. Select **Encode** or **Decode**
2. Upload a file (drag & drop or click)
3. File is sent to the backend
4. Backend processes the file
5. A download link is returned
6. Download the processed file

---

## API Contract

### Encode

```
POST /encode
Content-Type: multipart/form-data
Body: file
```

### Decode

```
POST /decode
Content-Type: multipart/form-data
Body: file
```

### Response

```json
{
  "download_url": "/downloads/file_name.ext"
}
```

---

## Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

---

## File Size Limit

* **Client-side limit:** 5MB
* Files larger than 5MB are rejected before upload
* Backend should also enforce this limit

---

## Development

```bash
npm install
npm run dev
```

Open:
`http://localhost:3000`

---

## Notes

* Files are stored **temporarily**
* Data may be deleted after processing
* Do **not** use for sensitive or important files
* YouTube’s ToS may apply

---

## Disclaimer

This project is for **educational and experimental purposes only**.
Do not use it for illegal content or production storage.

---