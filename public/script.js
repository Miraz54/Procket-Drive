async function previewFile(id, name, type) {
    const modal = document.getElementById('previewModal');
    const title = document.getElementById('previewFileName');
    const content = document.getElementById('previewContent');
    title.innerText = `Preview: ${name}`;
    content.innerHTML = 'Loading...';
    modal.style.display = 'flex';
    try {
        const res = await fetch(`/api/files/preview/${id}`);
        if (!res.ok) throw new Error('Preview failed');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (type.startsWith('image/')) {
            content.innerHTML = `<img src="${url}" style="max-width:100%; max-height:70vh;">`;
        } else if (type === 'application/pdf') {
            content.innerHTML = `<iframe src="${url}" style="width:100%; height:70vh;"></iframe>`;
        } else {
            content.innerHTML = `<p>Preview not supported</p>`;
        }
    } catch (err) {
        content.innerHTML = `<p>Error loading preview: ${err.message}</p>`;
    }
}