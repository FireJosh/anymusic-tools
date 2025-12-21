from flask import Flask, render_template, request, jsonify, send_from_directory, send_file
from downloader import start_download, get_progress, get_download_dir
import os
import subprocess
import uuid
from pathlib import Path
from werkzeug.utils import secure_filename

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500MB max upload

def get_temp_dir():
    """取得暫存目錄"""
    temp_dir = Path(__file__).parent / "temp"
    temp_dir.mkdir(exist_ok=True)
    return temp_dir

@app.route('/')
def index():
    """首頁"""
    return render_template('index.html')

@app.route('/pdf')
def pdf_editor():
    """PDF 編輯器頁面"""
    return render_template('pdf.html')

@app.route('/api/download', methods=['POST'])
def download():
    """處理下載請求"""
    data = request.get_json()
    url = data.get('url', '')
    is_playlist = data.get('is_playlist', False)
    
    if not url:
        return jsonify({'error': '請輸入影片網址'}), 400
    
    task_id = start_download(url, is_playlist)
    return jsonify({'task_id': task_id, 'message': '開始下載...'})

@app.route('/api/progress/<task_id>')
def progress(task_id):
    """查詢下載進度"""
    status = get_progress(task_id)
    return jsonify(status)

@app.route('/downloads/<path:filename>')
def download_file(filename):
    """提供下載檔案"""
    download_dir = get_download_dir()
    return send_from_directory(download_dir, filename, as_attachment=True)

@app.route('/api/trim', methods=['POST'])
def trim_audio():
    """切割音訊檔案"""
    if 'audio' not in request.files:
        return jsonify({'error': '請上傳音訊檔案'}), 400
    
    audio_file = request.files['audio']
    start_time = request.form.get('start_time', 0, type=int)
    end_time = request.form.get('end_time', 0, type=int)
    
    if not audio_file.filename:
        return jsonify({'error': '請選擇檔案'}), 400
    
    temp_dir = get_temp_dir()
    filename = secure_filename(audio_file.filename)
    input_path = temp_dir / f"input_{uuid.uuid4()}_{filename}"
    output_path = temp_dir / f"trimmed_{uuid.uuid4()}_{filename}"
    
    try:
        audio_file.save(str(input_path))
        
        # 使用 FFmpeg 切割
        duration = end_time - start_time
        cmd = [
            'ffmpeg', '-y',
            '-i', str(input_path),
            '-ss', str(start_time),
            '-t', str(duration),
            '-c', 'copy',
            str(output_path)
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            return jsonify({'error': f'FFmpeg 錯誤: {result.stderr}'}), 500
        
        return send_file(
            str(output_path),
            as_attachment=True,
            download_name=f"trimmed_{filename}"
        )
        
    finally:
        # 清理暫存檔案
        if input_path.exists():
            input_path.unlink()
        # output_path 會在送出後自動清理

# ============ PDF APIs ============

@app.route('/api/pdf/merge', methods=['POST'])
def merge_pdfs():
    """合併多個 PDF"""
    if 'pdfs' not in request.files:
        return jsonify({'error': '請上傳 PDF 檔案'}), 400
    
    files = request.files.getlist('pdfs')
    if len(files) < 2:
        return jsonify({'error': '請至少上傳 2 個 PDF 檔案'}), 400
    
    temp_dir = get_temp_dir()
    input_paths = []
    output_path = temp_dir / f"merged_{uuid.uuid4()}.pdf"
    
    try:
        # 儲存上傳的檔案
        for f in files:
            path = temp_dir / f"input_{uuid.uuid4()}_{secure_filename(f.filename)}"
            f.save(str(path))
            input_paths.append(str(path))
        
        # 使用 PyPDF2 合併
        from PyPDF2 import PdfMerger
        merger = PdfMerger()
        for path in input_paths:
            merger.append(path)
        merger.write(str(output_path))
        merger.close()
        
        return send_file(str(output_path), as_attachment=True, download_name="merged.pdf")
        
    finally:
        for path in input_paths:
            if Path(path).exists():
                Path(path).unlink()

@app.route('/api/pdf/split', methods=['POST'])
def split_pdf():
    """分割 PDF"""
    if 'pdf' not in request.files:
        return jsonify({'error': '請上傳 PDF 檔案'}), 400
    
    pdf_file = request.files['pdf']
    split_pages = request.form.get('pages', '')  # e.g., "1-3,5,7-9"
    
    temp_dir = get_temp_dir()
    input_path = temp_dir / f"input_{uuid.uuid4()}.pdf"
    output_path = temp_dir / f"split_{uuid.uuid4()}.pdf"
    
    try:
        pdf_file.save(str(input_path))
        
        from PyPDF2 import PdfReader, PdfWriter
        reader = PdfReader(str(input_path))
        writer = PdfWriter()
        
        # 解析頁碼
        pages_to_extract = parse_page_range(split_pages, len(reader.pages))
        
        for page_num in pages_to_extract:
            writer.add_page(reader.pages[page_num - 1])
        
        with open(str(output_path), 'wb') as f:
            writer.write(f)
        
        return send_file(str(output_path), as_attachment=True, download_name="split.pdf")
        
    finally:
        if input_path.exists():
            input_path.unlink()

@app.route('/api/pdf/rotate', methods=['POST'])
def rotate_pdf():
    """旋轉 PDF 頁面"""
    if 'pdf' not in request.files:
        return jsonify({'error': '請上傳 PDF 檔案'}), 400
    
    pdf_file = request.files['pdf']
    rotation = request.form.get('rotation', 90, type=int)  # 90, 180, 270
    pages = request.form.get('pages', 'all')  # "all" or "1,2,3"
    
    temp_dir = get_temp_dir()
    input_path = temp_dir / f"input_{uuid.uuid4()}.pdf"
    output_path = temp_dir / f"rotated_{uuid.uuid4()}.pdf"
    
    try:
        pdf_file.save(str(input_path))
        
        from PyPDF2 import PdfReader, PdfWriter
        reader = PdfReader(str(input_path))
        writer = PdfWriter()
        
        if pages == 'all':
            pages_to_rotate = list(range(1, len(reader.pages) + 1))
        else:
            pages_to_rotate = [int(p.strip()) for p in pages.split(',')]
        
        for i, page in enumerate(reader.pages):
            if (i + 1) in pages_to_rotate:
                page.rotate(rotation)
            writer.add_page(page)
        
        with open(str(output_path), 'wb') as f:
            writer.write(f)
        
        return send_file(str(output_path), as_attachment=True, download_name="rotated.pdf")
        
    finally:
        if input_path.exists():
            input_path.unlink()

@app.route('/api/pdf/delete', methods=['POST'])
def delete_pdf_pages():
    """刪除 PDF 頁面"""
    if 'pdf' not in request.files:
        return jsonify({'error': '請上傳 PDF 檔案'}), 400
    
    pdf_file = request.files['pdf']
    pages_to_delete = request.form.get('pages', '')  # "1,3,5"
    
    temp_dir = get_temp_dir()
    input_path = temp_dir / f"input_{uuid.uuid4()}.pdf"
    output_path = temp_dir / f"deleted_{uuid.uuid4()}.pdf"
    
    try:
        pdf_file.save(str(input_path))
        
        from PyPDF2 import PdfReader, PdfWriter
        reader = PdfReader(str(input_path))
        writer = PdfWriter()
        
        delete_set = set(int(p.strip()) for p in pages_to_delete.split(',') if p.strip())
        
        for i, page in enumerate(reader.pages):
            if (i + 1) not in delete_set:
                writer.add_page(page)
        
        with open(str(output_path), 'wb') as f:
            writer.write(f)
        
        return send_file(str(output_path), as_attachment=True, download_name="modified.pdf")
        
    finally:
        if input_path.exists():
            input_path.unlink()

def parse_page_range(page_string, total_pages):
    """解析頁碼範圍字串，如 '1-3,5,7-9'"""
    pages = set()
    if not page_string:
        return list(range(1, total_pages + 1))
    
    for part in page_string.split(','):
        part = part.strip()
        if '-' in part:
            start, end = part.split('-')
            pages.update(range(int(start), int(end) + 1))
        else:
            pages.add(int(part))
    
    return sorted([p for p in pages if 1 <= p <= total_pages])

# ============ QR Code & URL Shortener ============

@app.route('/qrcode')
def qrcode_page():
    """QR Code 產生器頁面"""
    return render_template('qrcode.html')

@app.route('/tools')
def tools_page():
    """更多工具頁面"""
    return render_template('tools.html')

@app.route('/api/qrcode', methods=['POST'])
def generate_qrcode():
    """產生 QR Code"""
    data = request.get_json()
    content = data.get('content', '')
    
    if not content:
        return jsonify({'error': '請輸入內容'}), 400
    
    try:
        import qrcode
        from io import BytesIO
        import base64
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(content)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{img_base64}'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/qrcode/download', methods=['POST'])
def download_qrcode():
    """下載 QR Code"""
    data = request.get_json()
    content = data.get('content', '')
    
    if not content:
        return jsonify({'error': '請輸入內容'}), 400
    
    try:
        import qrcode
        from io import BytesIO
        
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(content)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        buffer = BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        return send_file(buffer, mimetype='image/png', as_attachment=True, download_name='qrcode.png')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/shorten', methods=['POST'])
def shorten_url():
    """縮短網址 - 使用 TinyURL API"""
    data = request.get_json()
    url = data.get('url', '')
    
    if not url:
        return jsonify({'error': '請輸入網址'}), 400
    
    try:
        import urllib.request
        import urllib.parse
        
        # 使用 TinyURL API (無需額外套件)
        api_url = f"http://tinyurl.com/api-create.php?url={urllib.parse.quote(url, safe='')}"
        
        with urllib.request.urlopen(api_url, timeout=10) as response:
            short_url = response.read().decode('utf-8')
        
        return jsonify({
            'success': True,
            'original': url,
            'short': short_url
        })
        
    except Exception as e:
        return jsonify({'error': f'無法產生短網址: {str(e)}'}), 500

# ============ Image Tools ============

@app.route('/api/remove-bg', methods=['POST'])
def remove_background():
    """移除圖片背景"""
    if 'image' not in request.files:
        return jsonify({'error': '請上傳圖片'}), 400
    
    image_file = request.files['image']
    
    if not image_file.filename:
        return jsonify({'error': '請選擇檔案'}), 400
    
    temp_dir = get_temp_dir()
    filename = secure_filename(image_file.filename)
    input_path = temp_dir / f"input_{uuid.uuid4()}_{filename}"
    output_path = temp_dir / f"nobg_{uuid.uuid4()}.png"
    
    try:
        image_file.save(str(input_path))
        
        from rembg import remove
        from PIL import Image
        
        with open(str(input_path), 'rb') as inp:
            input_data = inp.read()
        
        output_data = remove(input_data)
        
        with open(str(output_path), 'wb') as out:
            out.write(output_data)
        
        return send_file(
            str(output_path),
            mimetype='image/png',
            as_attachment=True,
            download_name=f"nobg_{filename.rsplit('.', 1)[0]}.png"
        )
    
    except ImportError:
        return jsonify({'error': '圖片去背功能需要安裝 rembg 套件。請執行: pip install rembg'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        if input_path.exists():
            input_path.unlink()

@app.route('/api/mask-text', methods=['POST'])
def mask_sensitive_text():
    """遮蓋敏感資訊"""
    data = request.get_json()
    text = data.get('text', '')
    patterns = data.get('patterns', [])
    mask_char = data.get('mask_char', '*')
    
    if not text:
        return jsonify({'error': '請輸入文字'}), 400
    
    import re
    
    result = text
    masked_items = []
    
    # 預設敏感資訊模式
    default_patterns = {
        'email': r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',
        'phone': r'\b0\d{1,2}[-\s]?\d{3,4}[-\s]?\d{3,4}\b',
        'id': r'\b[A-Z][12]\d{8}\b',  # 台灣身分證
        'credit_card': r'\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b',
    }
    
    # 如果沒有指定模式，使用全部預設模式
    if not patterns:
        patterns = list(default_patterns.keys())
    
    for pattern_name in patterns:
        if pattern_name in default_patterns:
            pattern = default_patterns[pattern_name]
            matches = re.findall(pattern, result)
            for match in matches:
                masked = mask_char * len(match)
                result = result.replace(match, masked)
                masked_items.append({'type': pattern_name, 'original': match, 'masked': masked})
    
    return jsonify({
        'success': True,
        'original': text,
        'masked': result,
        'items': masked_items
    })

if __name__ == '__main__':
    get_download_dir()
    get_temp_dir()
    print("=== AnyMusic Tools Suite ===")
    print("開啟瀏覽器訪問: http://localhost:5000")
    print("- 音訊工具: http://localhost:5000")
    print("- PDF 編輯: http://localhost:5000/pdf")
    print("- QR Code: http://localhost:5000/qrcode")
    print("- 更多工具: http://localhost:5000/tools")
    app.run(debug=True, host='0.0.0.0', port=5000)
