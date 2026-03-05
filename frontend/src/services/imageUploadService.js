/**
 * 图像上传服务
 * 提供图像上传、格式识别和批量上传功能
 */

import { getApiUrl } from './api';

/**
 * 获取当前用户的认证token
 */
function getAuthToken() {
    return localStorage.getItem('token');
}

/**
 * 创建带有认证头的请求配置
 */
function createAuthHeaders() {
    const token = getAuthToken();
    const headers = {};
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
}

class ImageUploadService {
    constructor() {
        this.baseUrl = getApiUrl();
    }

    /**
     * 上传单个图像文件
     * @param {File} file - 图像文件
     * @param {Object} options - 上传选项
     * @returns {Promise} 上传结果
     */
    async uploadImage(file, options = {}) {
        const formData = new FormData();
        formData.append('file', file);
        
        // 添加可选参数
        if (options.session_id) {
            formData.append('session_id', options.session_id);
        }
        if (options.data_subtype) {
            formData.append('data_subtype', options.data_subtype);
        }
        if (options.description) {
            formData.append('description', options.description);
        }

        try {
            const headers = createAuthHeaders();
            const response = await fetch(`${this.baseUrl}/api/file-upload/image`, {
                method: 'POST',
                body: formData,
                headers: headers,
                credentials: 'include',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || '图像上传失败');
            }

            return result;
        } catch (error) {
            console.error('图像上传失败:', error);
            throw error;
        }
    }

    /**
     * 批量上传图像文件
     * @param {FileList} files - 图像文件列表
     * @param {Object} options - 上传选项
     * @returns {Promise} 批量上传结果
     */
    async uploadBatchImages(files, options = {}) {
        const formData = new FormData();
        
        // 添加所有文件
        Array.from(files).forEach(file => {
            formData.append('files', file);
        });
        
        // 添加可选参数
        if (options.session_id) {
            formData.append('session_id', options.session_id);
        }
        if (options.data_subtype) {
            formData.append('data_subtype', options.data_subtype);
        }

        try {
            const headers = createAuthHeaders();
            const response = await fetch(`${this.baseUrl}/api/file-upload/batch-images`, {
                method: 'POST',
                body: formData,
                headers: headers,
                credentials: 'include',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || '批量上传失败');
            }

            return result;
        } catch (error) {
            console.error('批量上传失败:', error);
            throw error;
        }
    }

    /**
     * 获取支持的图像格式
     * @returns {Promise} 支持的格式信息
     */
    async getSupportedFormats() {
        try {
            const headers = createAuthHeaders();
            const response = await fetch(`${this.baseUrl}/api/file-upload/supported-formats`, {
                method: 'GET',
                headers: headers,
                credentials: 'include',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || '获取支持的格式失败');
            }

            return result;
        } catch (error) {
            console.error('获取支持的格式失败:', error);
            throw error;
        }
    }

    /**
     * 删除已上传的图像
     * @param {string} fileId - 文件ID
     * @returns {Promise} 删除结果
     */
    async deleteImage(fileId) {
        try {
            const headers = createAuthHeaders();
            const response = await fetch(`${this.baseUrl}/api/file-upload/image/${fileId}`, {
                method: 'DELETE',
                headers: headers,
                credentials: 'include',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || '删除图像失败');
            }

            return result;
        } catch (error) {
            console.error('删除图像失败:', error);
            throw error;
        }
    }

    /**
     * 验证图像文件
     * @param {File} file - 图像文件
     * @param {Object} limits - 文件限制
     * @returns {Object} 验证结果
     */
    validateImageFile(file, limits = {}) {
        const maxSize = limits.maxSizeMB || 50; // 默认50MB
        const supportedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
            'image/bmp', 'image/tiff', 'image/webp', 'image/x-icon',
            'image/svg+xml'
        ];

        const validation = {
            isValid: true,
            errors: [],
            warnings: []
        };

        // 检查文件类型
        if (!supportedTypes.includes(file.type)) {
            validation.isValid = false;
            validation.errors.push(`不支持的文件类型: ${file.type}`);
        }

        // 检查文件大小
        const fileSizeMB = file.size / (1024 * 1024);
        if (fileSizeMB > maxSize) {
            validation.isValid = false;
            validation.errors.push(`文件大小 ${fileSizeMB.toFixed(2)}MB 超过限制 ${maxSize}MB`);
        } else if (fileSizeMB > 10) {
            validation.warnings.push(`文件大小 ${fileSizeMB.toFixed(2)}MB 较大，可能影响上传速度`);
        }

        // 检查文件名
        if (!file.name || file.name.length === 0) {
            validation.isValid = false;
            validation.errors.push('文件名不能为空');
        }

        return validation;
    }

    /**
     * 创建图像预览URL
     * @param {File} file - 图像文件
     * @returns {Promise} 预览URL
     */
    createPreviewUrl(file) {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                reject(new Error('不是图像文件'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                resolve(e.target.result);
            };
            reader.onerror = () => {
                reject(new Error('读取文件失败'));
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * 格式化文件大小
     * @param {number} bytes - 字节数
     * @returns {string} 格式化的文件大小
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 从文件名获取扩展名
     * @param {string} filename - 文件名
     * @returns {string} 扩展名
     */
    getFileExtension(filename) {
        return filename.split('.').pop().toLowerCase();
    }

    /**
     * 检查文件是否为支持的图像格式
     * @param {string} filename - 文件名
     * @returns {boolean} 是否为支持的格式
     */
    isSupportedImageFormat(filename) {
        const supportedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'ico', 'svg'];
        const extension = this.getFileExtension(filename);
        return supportedExtensions.includes(extension);
    }
}

// 创建单例实例
const imageUploadService = new ImageUploadService();

export default imageUploadService;