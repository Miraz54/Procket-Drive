// ======================== FILE UPLOAD (using signed URL for Vercel) ========================
async function uploadFile(input) {
    const file = input.files[0];
    if (!file) return;

    // 1. Get signed upload URL from backend
    let signedUrl, publicUrl;
    try {
        const res = await fetch(`/api/files/upload-url?name=${encodeURIComponent(file.name)}`);
        if (!res.ok) throw new Error('Failed to get upload URL');
        const data = await res.json();
        signedUrl = data.signedUrl;
        publicUrl = data.publicUrl;
    } catch (err) {
        alert('Failed to prepare upload: ' + err.message);
        return;
    }

    // 2. Upload file directly to Supabase using PUT
    const xhr = new XMLHttpRequest();
    const progressContainer = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressPercent = document.getElementById('uploadProgressPercent');
    progressContainer.style.display = 'block';
    progressBar.style.width = '0%';
    progressPercent.innerText = '0%';

    xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            progressBar.style.width = percent + '%';
            progressPercent.innerText = percent + '%';
        }
    });

    xhr.onload = () => {
        progressContainer.style.display = 'none';
        if (xhr.status === 200) {
            // 3. Register file metadata in database
            fetch('/api/files/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    publicUrl: publicUrl
                })
            })
            .then(r => r.json())
            .then(data => {
                if (data.success) {
                    alert(`✅ Upload Complete!\n${file.name} (${formatFileSize(file.size)})`);
                    loadFiles();
                } else {
                    alert('Upload succeeded but failed to save metadata: ' + data.error);
                }
            })
            .catch(err => alert('Metadata save error: ' + err.message));
        } else {
            alert('Upload failed. Status: ' + xhr.status);
        }
    };

    xhr.onerror = () => {
        progressContainer.style.display = 'none';
        alert('Upload failed. Network error.');
    };

    xhr.open('PUT', signedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
    input.value = '';
}