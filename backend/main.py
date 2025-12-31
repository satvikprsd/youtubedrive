from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from pathlib import Path
import binascii
import numpy as np
import cv2
import uuid
import asyncio
import time
import os
import shutil
from dotenv import load_dotenv

load_dotenv()

MAX_FILE_SIZE = 5*1024*1024 #5 MB
MAX_TOTAL_STORAGE = 400*1024*1024 #400 MB
FILE_EXPIRY_SECONDS = 3*60 #3 min

WIDTH = 480
HEIGHT = 480
BOX_SIZE = 8
DELIMITER_HEX = "e"*4

BASE_DIR = Path(__file__).parent
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

COLORS = np.array([
    [0, 0, 255],
    [0, 255, 0],
    [255, 0, 0],
    [0, 255, 255],
    [255, 255, 0],
    [255, 0, 255],
    [0, 0, 128],
    [0, 128, 0],
    [128, 0, 0],
    [0, 128, 128],
    [128, 0, 128],
    [128, 128, 0],
    [192, 192, 192],
    [0, 165, 255],
    [180, 105, 255],
    [255, 255, 255],
], dtype=np.uint8)


async def cleanup_old_files():
    while True:
        try:
            now = time.time()
            files = list(OUTPUT_DIR.iterdir())
            
            for path in files:
                try:
                    if path.is_file():
                        file_age = now - path.stat().st_mtime
                        if file_age > FILE_EXPIRY_SECONDS:
                            print(f"Deleting {path.name}")
                            path.unlink()
                except Exception as e:
                    print(f"Error deleting {path.name}: {e}")
                    
        except Exception as e:
            print(f"Error in cleanup scanning: {e}")
        await asyncio.sleep(FILE_EXPIRY_SECONDS)

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(cleanup_old_files())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Youtube Drive API",
    description="Vector Video Encoder/Decoder for unlimited storage on youtube",
    lifespan=lifespan,
)

app.add_middleware(CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "message": "Youtube Drive API",
        "endpoints": {
            "/encode": "POST",
            "/decode": "POST",
        },
    }


@app.post("/encode")
async def encode_file(file: UploadFile = File(...)):
    try:
        data = await file.read()

        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(status_code=413,detail="File too large")

        total_space_used = sum(f.stat().st_size for f in OUTPUT_DIR.iterdir() if f.is_file())
        if total_space_used + len(data)*21 > MAX_TOTAL_STORAGE: # encoded ratio
            raise HTTPException(status_code=507, detail="Server out of space. Please try again later.")

        file_id = str(uuid.uuid4())[:8]
        file_name = os.path.splitext(file.filename)[0][:20]
        ext = os.path.splitext(file.filename)[1]

        file_hex = binascii.hexlify(data).decode()
        file_name_hex = binascii.hexlify(file_name.encode()).decode()
        ext_hex = binascii.hexlify(ext.encode()).decode()
        hexdata = file_hex + DELIMITER_HEX + file_name_hex + DELIMITER_HEX + ext_hex

        symbols = np.array([int(c, 16) for c in hexdata], dtype=np.uint8)

        blocks_x = WIDTH//BOX_SIZE
        blocks_y = HEIGHT//BOX_SIZE
        symbols_per_frame = blocks_x*blocks_y
        frames = (len(symbols) + symbols_per_frame - 1)//symbols_per_frame

        out_path = OUTPUT_DIR / f"encoded_{file_name}_{file_id}.avi"
        writer = cv2.VideoWriter(str(out_path),cv2.VideoWriter_fourcc(*"MJPG"),30,(WIDTH, HEIGHT))

        for i in range(frames):
            chunk = symbols[i*symbols_per_frame:(i + 1)*symbols_per_frame]

            if len(chunk)< symbols_per_frame: chunk = np.pad(chunk, (0, symbols_per_frame - len(chunk)), constant_values=15)
            grid = COLORS[chunk].reshape(blocks_y, blocks_x, 3)
            frame = np.repeat(np.repeat(grid, BOX_SIZE, axis=0), BOX_SIZE, axis=1)
            writer.write(frame)

        writer.release()

        return JSONResponse({"success": True,"filename": out_path.name, "download_url": f"/files/{out_path.name}"})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/decode")
async def decode_video(file: UploadFile = File(...)):
    try:
        file_id = str(uuid.uuid4())[:8]
        temp_video_path = OUTPUT_DIR / f"temp_{file_id}.avi"
        temp_hex_path = OUTPUT_DIR / f"temp_hex_{file_id}.bin"

        file.file.seek(0, 2)
        file_size = file.file.tell()
        file.file.seek(0)


        total_space_used = sum(f.stat().st_size for f in OUTPUT_DIR.iterdir() if f.is_file())
        print(f"Total space used: {total_space_used/1024/1024} MB")
        if total_space_used + file_size > MAX_TOTAL_STORAGE:
            temp_video_path.unlink(missing_ok=True)
            raise HTTPException(status_code=507, detail="Server out of space. Please try again later.")

        with temp_video_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        cap = cv2.VideoCapture(str(temp_video_path))
        if not cap.isOpened():
            temp_video_path.unlink(missing_ok=True)
            raise HTTPException(status_code=400, detail="Invalid video")

        palette = COLORS.astype(np.int32)
        palette_b = palette[np.newaxis, :, :]
        hex_map = np.array([f"{i:x}" for i in range(16)])

        rows = HEIGHT//BOX_SIZE
        cols = WIDTH//BOX_SIZE
        per_frame = rows*cols

        #decoded = []
        with temp_hex_path.open("w") as hex_file:
            while True:
                ok, frame = cap.read()
                if not ok:
                    break

                avg = frame.reshape(rows, BOX_SIZE, cols, BOX_SIZE, 3).swapaxes(1, 2).mean(axis=(2, 3)).astype(np.int32)
                flat = avg.reshape(per_frame, 3)[:, np.newaxis, :]
                diff = flat - palette_b
                dist = np.sum(diff** 2, axis=2)
                hex_file.write("".join(hex_map[np.argmin(dist, axis=1)]))

        cap.release()
        temp_video_path.unlink(missing_ok=True)

        file_size = temp_hex_path.stat().st_size
        if file_size == 0:
            raise HTTPException(status_code=400, detail="No data decoded")
        
        read_size = min(4096, file_size)

        with temp_hex_path.open("r") as hex_file:
            hex_file.seek(file_size - read_size)
            tail = hex_file.read()

        tail = tail.rstrip("f")

        if len(tail)%2 != 0:
            tail = tail[1:]

        # print(f"Tail data: {tail}")
        parts = tail.rsplit(DELIMITER_HEX, 2)
        data_end_offset = file_size
        # print(f"Parts: {parts}")
        if len(parts) == 3:
            _, file_name_hex, ext_hex = parts
            try:
                file_name = binascii.unhexlify(file_name_hex).decode()
                ext = binascii.unhexlify(ext_hex).decode()
                if not ext.startswith("."):
                    ext = "." + ext
                data_end_offset = file_size - len(file_name_hex) - len(ext_hex) - 2*len(DELIMITER_HEX)
            except Exception:
                ext = ".bin"
        else:
            file_name = "unknown"
            ext = ".bin"


        out_path = OUTPUT_DIR / f"{file_name}_{file_id}{ext}"
        with temp_hex_path.open("r") as hex_file, out_path.open("wb") as out_file:
            cur_pos = 0
            CHUNK_SIZE = 1024*1024

            while cur_pos < data_end_offset:
                read_size = min(CHUNK_SIZE, data_end_offset - cur_pos)
                hex_chunk = hex_file.read(read_size)
                if not hex_chunk:
                    break
                try:
                    out_file.write(binascii.unhexlify(hex_chunk))
                except Exception as e:
                    pass

                cur_pos += len(hex_chunk)
        temp_hex_path.unlink(missing_ok=True)

        return JSONResponse({"success": True,"filename": out_path.name, "download_url": f"/files/{out_path.name}"})

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


app.mount("/files", StaticFiles(directory=OUTPUT_DIR), name="files")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
