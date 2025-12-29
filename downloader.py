import yt_dlp
import os
import uuid
import threading
from pathlib import Path

# 下載進度追蹤
download_progress = {}

def get_download_dir():
    """取得下載目錄"""
    download_dir = Path(__file__).parent / "downloads"
    download_dir.mkdir(exist_ok=True)
    return download_dir

def get_cookies_file():
    """取得 cookies 檔案路徑（如果存在）"""
    cookies_file = Path(__file__).parent / "cookies.txt"
    if cookies_file.exists():
        return str(cookies_file)
    return None

def get_youtube_opts():
    """取得 YouTube 下載選項（自動選擇認證方式）"""
    opts = {}
    
    # 優先使用 cookies 檔案
    cookies_file = get_cookies_file()
    if cookies_file:
        opts['cookiefile'] = cookies_file
        print(f"[INFO] 使用 cookies 檔案: {cookies_file}")
    # 否則使用 yt-dlp 預設模式（不加額外參數）
    
    return opts

def progress_hook(task_id):
    """建立進度回調函數"""
    def hook(d):
        if d['status'] == 'downloading':
            total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
            downloaded = d.get('downloaded_bytes', 0)
            if total > 0:
                percent = (downloaded / total) * 100
                download_progress[task_id]['progress'] = percent
                download_progress[task_id]['status'] = 'downloading'
        elif d['status'] == 'finished':
            download_progress[task_id]['status'] = 'converting'
    return hook

def get_video_info(url):
    """取得影片資訊"""
    ydl_opts = {
        'quiet': True,
        'no_warnings': True,
        'extract_flat': True,
    }
    
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=False)
        return info

def download_single(url, task_id):
    """下載單一影片為 MP3"""
    download_dir = get_download_dir()
    
    # 取得 YouTube 認證選項
    youtube_opts = get_youtube_opts()
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': str(download_dir / '%(title)s.%(ext)s'),
        'progress_hooks': [progress_hook(task_id)],
        'quiet': True,
        'no_warnings': True,
        **youtube_opts,  # 套用認證選項
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = ydl.prepare_filename(info)
            # 變更副檔名為 mp3
            mp3_filename = Path(filename).stem + '.mp3'
            download_progress[task_id]['status'] = 'completed'
            download_progress[task_id]['progress'] = 100
            download_progress[task_id]['files'] = [mp3_filename]
            download_progress[task_id]['title'] = info.get('title', 'Unknown')
            return mp3_filename
    except Exception as e:
        download_progress[task_id]['status'] = 'error'
        download_progress[task_id]['error'] = str(e)
        return None

def download_playlist(url, task_id):
    """下載整個播放清單為 MP3"""
    download_dir = get_download_dir()
    downloaded_files = []
    
    # 取得 YouTube 認證選項
    youtube_opts = get_youtube_opts()
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': str(download_dir / '%(playlist_title)s/%(title)s.%(ext)s'),
        'progress_hooks': [progress_hook(task_id)],
        'quiet': True,
        'no_warnings': True,
        'ignoreerrors': True,
        **youtube_opts,  # 套用認證選項
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            
            if 'entries' in info:
                playlist_title = info.get('title', 'playlist')
                for entry in info['entries']:
                    if entry:
                        mp3_filename = f"{playlist_title}/{entry.get('title', 'Unknown')}.mp3"
                        downloaded_files.append(mp3_filename)
            
            download_progress[task_id]['status'] = 'completed'
            download_progress[task_id]['progress'] = 100
            download_progress[task_id]['files'] = downloaded_files
            download_progress[task_id]['title'] = info.get('title', 'Unknown Playlist')
            return downloaded_files
    except Exception as e:
        download_progress[task_id]['status'] = 'error'
        download_progress[task_id]['error'] = str(e)
        return None

def start_download(url, is_playlist=False):
    """啟動背景下載任務"""
    task_id = str(uuid.uuid4())
    download_progress[task_id] = {
        'status': 'starting',
        'progress': 0,
        'files': [],
        'title': '',
        'error': None
    }
    
    def run_download():
        if is_playlist:
            download_playlist(url, task_id)
        else:
            download_single(url, task_id)
    
    thread = threading.Thread(target=run_download)
    thread.start()
    
    return task_id

def get_progress(task_id):
    """取得下載進度"""
    return download_progress.get(task_id, {'status': 'not_found'})
