import React, { useState, useCallback, useRef } from 'react';
import './ImageUpload.css';
import imageUploadService from '../../services/imageUploadService';

const ImageUpload = ({ 
  onUploadSuccess, 
  onUploadError, 
  maxSizeMB = 50,
  maxFiles = 1,
  multiple = false,
  accept = 'image/*',
  disabled = false,
  className = '',
  uploadOptions = {} // 上传选项，包含session_id等
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [previews, setPreviews] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // 处理文件选择
  const handleFileSelect = useCallback(async (files) => {
    if (disabled || isUploading) return;

    const fileArray = Array.from(files);
    
    // 验证文件数量
    if (fileArray.length > maxFiles) {
      onUploadError?.(`最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    // 验证每个文件
    const invalidFiles = [];
    const validFiles = [];

    for (const file of fileArray) {
      const validation = imageUploadService.validateImageFile(file, { maxSizeMB });
      if (!validation.isValid) {
        invalidFiles.push({
          file: file.name,
          errors: validation.errors
        });
      } else {
        validFiles.push({
          file,
          warnings: validation.warnings
        });
      }
    }

    if (invalidFiles.length > 0) {
      const errorMessages = invalidFiles.map(item => 
        `${item.file}: ${item.errors.join(', ')}`
      ).join('; ');
      onUploadError?.(errorMessages);
      return;
    }

    // 创建预览
    const newPreviews = [];
    for (const fileData of validFiles) {
      try {
        const previewUrl = await imageUploadService.createPreviewUrl(fileData.file);
        newPreviews.push({
          id: Date.now() + Math.random(),
          file: fileData.file,
          preview: previewUrl,
          name: fileData.file.name,
          size: fileData.file.size,
          warnings: fileData.warnings
        });
      } catch (error) {
        onUploadError?.(`创建预览失败: ${fileData.file.name}`);
      }
    }

    setPreviews(prev => [...prev, ...newPreviews]);
  }, [disabled, isUploading, maxFiles, maxSizeMB, onUploadError]);

  // 处理输入文件变化
  const handleInputChange = useCallback((e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files);
    }
    // 清空input以允许重复选择同一文件
    e.target.value = '';
  }, [handleFileSelect]);

  // 处理拖拽
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  // 移除预览
  const removePreview = useCallback((id) => {
    setPreviews(prev => prev.filter(preview => preview.id !== id));
  }, []);

  // 清空所有预览
  const clearPreviews = useCallback(() => {
    setPreviews([]);
  }, []);

  // 上传文件
  const handleUpload = useCallback(async () => {
    if (previews.length === 0 || isUploading) return;

    setIsUploading(true);
    const initialProgress = {};
    previews.forEach(preview => {
      initialProgress[preview.id] = 0;
    });
    setUploadProgress(initialProgress);

    try {
      let result;
      if (previews.length === 1) {
        // 单文件上传
        const preview = previews[0];
        result = await imageUploadService.uploadImage(preview.file, uploadOptions);
      } else {
        // 批量上传
        const files = previews.map(p => p.file);
        result = await imageUploadService.uploadBatchImages(files, uploadOptions);
      }

      onUploadSuccess?.(result);
      clearPreviews();
    } catch (error) {
      onUploadError?.(error.message);
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  }, [previews, isUploading, onUploadSuccess, onUploadError, clearPreviews]);

  // 点击上传区域
  const handleUploadAreaClick = useCallback(() => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  }, [disabled, isUploading]);

  return (
    <div className={`image-upload ${className} ${disabled ? 'disabled' : ''}`}>
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled || isUploading}
        style={{ display: 'none' }}
      />

      {/* 上传区域 */}
      <div
        className={`upload-area ${dragActive ? 'drag-active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleUploadAreaClick}
      >
        <div className="upload-content">
          <div className="upload-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="17 8 12 3 7 8"></polyline>
              <line x1="12" y1="3" x2="12" y2="15"></line>
            </svg>
          </div>
          <div className="upload-text">
            <p>点击或拖拽图像文件到此处上传</p>
            <p className="upload-hint">
              支持格式：JPEG, PNG, GIF, BMP, TIFF, WEBP 等
              {maxSizeMB && ` • 最大 ${maxSizeMB}MB`}
              {maxFiles > 1 && ` • 最多 ${maxFiles} 个文件`}
            </p>
          </div>
        </div>
      </div>

      {/* 预览区域 */}
      {previews.length > 0 && (
        <div className="preview-area">
          <div className="preview-header">
            <span>已选择 {previews.length} 个文件</span>
            <button 
              className="clear-btn"
              onClick={clearPreviews}
              disabled={isUploading}
            >
              清空
            </button>
          </div>
          
          <div className="preview-grid">
            {previews.map(preview => (
              <div key={preview.id} className="preview-item">
                <div className="preview-image">
                  <img src={preview.preview} alt={preview.name} />
                  {!isUploading && (
                    <button 
                      className="remove-btn"
                      onClick={() => removePreview(preview.id)}
                      title="移除"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  )}
                </div>
                <div className="preview-info">
                  <p className="preview-name" title={preview.name}>{preview.name}</p>
                  <p className="preview-size">
                    {imageUploadService.formatFileSize(preview.size)}
                  </p>
                  {preview.warnings && preview.warnings.length > 0 && (
                    <p className="preview-warnings">
                      {preview.warnings.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 上传按钮 */}
      {previews.length > 0 && (
        <div className="upload-actions">
          <button
            className="upload-btn primary"
            onClick={handleUpload}
            disabled={isUploading || previews.length === 0}
          >
            {isUploading ? (
              <>
                <div className="spinner"></div>
                上传中...
              </>
            ) : (
              `上传 ${previews.length} 个文件`
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUpload;