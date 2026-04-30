const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Use memory storage (no disk writing)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }
});

function requireAuth(req, res, next) {
    if (!req.session.userId) return res.status(401).json({ error: 'Authentication required' });
    next();
}

// Upload file to Supabase Storage bucket 'userfiles'
router.post('/upload', requireAuth, upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const userId = req.session.userId;
    const originalName = req.file.originalname;
    const timestamp = Date.now();
    const safeName = `${timestamp}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const filePath = `${userId}/${safeName}`;

    // Upload to 'userfiles' bucket (must be created in Supabase as Public)
    const { error: uploadError } = await supabase.storage
        .from('userfiles')
        .upload(filePath, req.file.buffer, {
            contentType: req.file.mimetype,
            cacheControl: '3600'
        });

    if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        return res.status(500).json({ error: 'File upload to Supabase failed: ' + uploadError.message });
    }

    // Get public URL
    const { data: urlData } = supabase.storage.from('userfiles').getPublicUrl(filePath);

    // Insert file metadata into 'files' table
    const { data: inserted, error: dbError } = await supabase
        .from('files')
        .insert([{
            user_id: userId,
            original_name: originalName,
            file_path: urlData.publicUrl,
            file_size: req.file.size,
            mime_type: req.file.mimetype,
            is_deleted: 0
        }])
        .select();

    if (dbError) {
        console.error('DB error:', dbError);
        return res.status(500).json({ error: 'Database error: ' + dbError.message });
    }

    res.json({
        success: true,
        file: {
            id: inserted[0].id,
            name: originalName,
            size: req.file.size,
            type: req.file.mimetype
        }
    });
});

// List active (not deleted) files
router.get('/list', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', req.session.userId)
        .eq('is_deleted', 0)
        .order('uploaded_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Failed to fetch files' });
    res.json(data.map(f => ({
        id: f.id,
        name: f.original_name,
        size: f.file_size,
        type: f.mime_type,
        uploaded_at: f.uploaded_at
    })));
});

// Trash (deleted files)
router.get('/trash', requireAuth, async (req, res) => {
    const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('user_id', req.session.userId)
        .eq('is_deleted', 1)
        .order('deleted_at', { ascending: false });

    if (error) return res.status(500).json({ error: 'Failed to fetch trash' });
    res.json(data.map(f => ({
        id: f.id,
        name: f.original_name,
        size: f.file_size,
        type: f.mime_type,
        deleted_at: f.deleted_at
    })));
});

// Soft delete (move to trash)
router.delete('/delete/:id', requireAuth, async (req, res) => {
    const { error } = await supabase
        .from('files')
        .update({ is_deleted: 1, deleted_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .eq('user_id', req.session.userId);

    if (error) return res.status(500).json({ error: 'Move to trash failed' });
    res.json({ success: true, message: 'Moved to trash' });
});

// Restore from trash
router.post('/restore/:id', requireAuth, async (req, res) => {
    const { error } = await supabase
        .from('files')
        .update({ is_deleted: 0, deleted_at: null })
        .eq('id', req.params.id)
        .eq('user_id', req.session.userId);

    if (error) return res.status(500).json({ error: 'Restore failed' });
    res.json({ success: true, message: 'Restored successfully' });
});

// Permanently delete (remove from storage and DB)
router.delete('/permanent/:id', requireAuth, async (req, res) => {
    // First get the file info
    const { data: file, error: fetchError } = await supabase
        .from('files')
        .select('file_path')
        .eq('id', req.params.id)
        .eq('user_id', req.session.userId)
        .eq('is_deleted', 1)
        .single();

    if (fetchError || !file) return res.status(404).json({ error: 'File not found in trash' });

    // Extract storage path from public URL
    const urlParts = file.file_path.split('/');
    const storagePath = urlParts.slice(urlParts.indexOf('userfiles') + 1).join('/');

    // Delete from storage
    await supabase.storage.from('userfiles').remove([storagePath]);

    // Delete database record
    await supabase.from('files').delete().eq('id', req.params.id);

    res.json({ success: true, message: 'Permanently deleted' });
});

// Preview (inline file content)
router.get('/preview/:id', requireAuth, async (req, res) => {
    const { data: file, error } = await supabase
        .from('files')
        .select('file_path, mime_type')
        .eq('id', req.params.id)
        .eq('user_id', req.session.userId)
        .eq('is_deleted', 0)
        .single();

    if (error || !file) return res.status(404).json({ error: 'File not found' });

    const urlParts = file.file_path.split('/');
    const storagePath = urlParts.slice(urlParts.indexOf('userfiles') + 1).join('/');
    const { data, error: downloadError } = await supabase.storage.from('userfiles').download(storagePath);

    if (downloadError) return res.status(500).json({ error: 'Failed to retrieve file' });

    res.setHeader('Content-Type', file.mime_type);
    res.setHeader('Content-Disposition', 'inline');
    res.send(Buffer.from(await data.arrayBuffer()));
});

// Download (redirect to public URL)
router.get('/download/:id', requireAuth, async (req, res) => {
    const { data: file, error } = await supabase
        .from('files')
        .select('file_path, original_name')
        .eq('id', req.params.id)
        .eq('user_id', req.session.userId)
        .eq('is_deleted', 0)
        .single();

    if (error || !file) return res.status(404).json({ error: 'File not found' });
    res.redirect(file.file_path);
});

module.exports = router;