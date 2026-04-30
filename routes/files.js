router.get('/preview/:id', requireAuth, async (req, res) => {
    const { data: file, error } = await supabase
        .from('files')
        .select('file_path, mime_type')
        .eq('id', req.params.id)
        .eq('user_id', req.session.userId)
        .eq('is_deleted', 0)
        .single();

    if (error || !file) return res.status(404).json({ error: 'File not found' });

    // Extract storage path from the public URL
    const urlParts = file.file_path.split('/');
    const storagePath = urlParts.slice(urlParts.indexOf('userfiles') + 1).join('/');
    
    const { data, error: downloadError } = await supabase.storage
        .from('userfiles')
        .download(storagePath);
    
    if (downloadError) return res.status(500).json({ error: 'Download failed' });
    
    res.setHeader('Content-Type', file.mime_type);
    res.send(Buffer.from(await data.arrayBuffer()));
});