/**
 * 图像上传服务
 * 提供图像上传、格式识别和批量上传功能
 */

import { getApiUrl } from './api';

export interface UploadOptions {
    session_id: string;
    data_subtype?: string;
    description?: string;
    location_geom?: string;
    altitude_m?: number;
    heading?: number;
}

export interface BatchItemResult {
    file: string;
    success: boolean;
    data?: unknown;
    error?: string;
}

export interface BatchUploadResult {
    total: number;
    success_count: number;
    failed_count: number;
    results: BatchItemResult[];
    errors: { file: string; error: string }[];
}

export interface SupportedFormatsResponse {
    code: number;
    message: string;
    data: {
        supported_formats: Record<string, {
            extensions: string[];
            mime_types: string[];
            description: string;
        }>;
        max_file_size_mb: number;
        max_batch_size: number;
    };
}

export interface ValidationOutcome {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * 获取当前用户的认证token
 */
function getAuthToken(): string | null {
    return localStorage.getItem('token');
}

/**
 * 创建带有认证头的请求配置
 */
function createAuthHeaders(): Record<string, string> {
    const token = getAuthToken();
    const headers: Record<string, string> = {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
}

class ImageUploadService {
    private baseUrl: string;

    constructor() {
        this.baseUrl = getApiUrl();
    }

    /**
     * 上传单个文件
     */
    async uploadFile(file: File, options: Partial<UploadOptions> = {}): Promise<unknown> {
        const formData = new FormData();
        formData.append('file', file);

        // 添加必需参数
        if (!options.session_id) {
            throw new Error('session_id 是必需的');
        }
        formData.append('session_id', options.session_id);

        // 添加可选参数
        if (options.data_subtype) {
            formData.append('data_subtype', options.data_subtype);
        }
        if (options.description) {
            formData.append('description', options.description);
        }
        if (options.location_geom) {
            formData.append('location_geom', options.location_geom);
        }
        if (options.altitude_m !== undefined) {
            formData.append('altitude_m', String(options.altitude_m));
        }
        if (options.heading !== undefined) {
            formData.append('heading', String(options.heading));
        }

        try {
            const headers = createAuthHeaders();
            const response = await fetch(`${this.baseUrl}/api/raw-data/upload-file`, {
                method: 'POST',
                body: formData,
                headers: headers,
                credentials: 'include',
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.detail || '文件上传失败');
            }

            return result;
        } catch (error) {
            console.error('文件上传失败:', error);
            throw error;
        }
    }

    /**
     * 批量上传文件（通过多次调用单文件上传）
     */
    async uploadBatchFiles(files: FileList | File[], options: Partial<UploadOptions> = {}): Promise<BatchUploadResult> {
        const fileArray = Array.from(files);
        const results: BatchItemResult[] = [];
        const errors: { file: string; error: string }[] = [];

        for (const file of fileArray) {
            try {
                const result = await this.uploadFile(file, options);
                results.push({
                    file: file.name,
                    success: true,
                    data: result
                });
            } catch (error) {
                const message = (error as Error).message;
                errors.push({
                    file: file.name,
                    error: message
                });
                results.push({
                    file: file.name,
                    success: false,
                    error: message
                });
            }
        }

        return {
            total: fileArray.length,
            success_count: results.filter(r => r.success).length,
            failed_count: errors.length,
            results,
            errors
        };
    }

    /**
     * 上传单个图像文件（兼容旧接口名）
     * @deprecated 请使用 uploadFile 代替
     */
    async uploadImage(file: File, options: Partial<UploadOptions> = {}): Promise<unknown> {
        return this.uploadFile(file, options);
    }

    /**
     * 批量上传图像文件（兼容旧接口名）
     * @deprecated 请使用 uploadBatchFiles 代替
     */
    async uploadBatchImages(files: FileList | File[], options: Partial<UploadOptions> = {}): Promise<BatchUploadResult> {
        return this.uploadBatchFiles(files, options);
    }

    /**
     * 获取支持的格式信息
     * 注：后端暂无对应端点，此处返回静态清单（原文件存在两个同名方法，
     * JS 类中后者覆盖前者、网络版从未生效，已于结构规范化时删除）。
     */
    async getSupportedFormats(): Promise<SupportedFormatsResponse> {
        try {
            const headers = createAuthHeaders();
            const response = await fetch(`${this.baseUrl}/api/raw-data/upload-data`, {
                method: 'GET',
                headers: headers,
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('获取支持格式失败');
            }

            // 返回支持的文件类型信息
            return {
                code: 200,
                message: "success",
                data: {
                    supported_formats: {
                        "RGB": {
                            extensions: ["jpg", "jpeg", "png"],
                            mime_types: ["image/jpeg", "image/png"],
                            description: "RGB图像"
                        },
                        "NIR": {
                            extensions: ["tif", "tiff", "png"],
                            mime_types: ["image/tiff", "image/png"],
                            description: "近红外图像"
                        },
                        "THERMAL": {
                            extensions: ["jpg", "tif"],
                            mime_types: ["image/jpeg", "image/tiff"],
                            description: "热成像"
                        },
                        "MULTISPECTRAL": {
                            extensions: ["tif", "tiff"],
                            mime_types: ["image/tiff"],
                            description: "多光谱图像"
                        },
                        "VIDEO": {
                            extensions: ["mp4", "mov"],
                            mime_types: ["video/mp4", "video/quicktime"],
                            description: "视频文件"
                        }
                    },
                    max_file_size_mb: 50,
                    max_batch_size: 20
                }
            };
        } catch (error) {
            console.error('获取支持的格式失败:', error);
            throw error;
        }
    }

    /**
     * 验证图像文件
     * @param limits - 文件限制
     */
    validateImageFile(file: File, limits: { maxSizeMB?: number } = {}): ValidationOutcome {
        const maxSize = limits.maxSizeMB || 50; // 默认50MB
        const supportedTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
            'image/bmp', 'image/tiff', 'image/webp', 'image/x-icon',
            'image/svg+xml'
        ];

        const validation: ValidationOutcome = {
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
     */
    createPreviewUrl(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                reject(new Error('不是图像文件'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                resolve(e.target?.result as string);
            };
            reader.onerror = () => {
                reject(new Error('读取文件失败'));
            };
            reader.readAsDataURL(file);
        });
    }

    /**
     * 格式化文件大小
     */
    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * 从文件名获取扩展名
     */
    getFileExtension(filename: string): string {
        return filename.split('.').pop() ?? '';
    }

    /**
     * 检查文件是否为支持的图像格式
     */
    isSupportedImageFormat(filename: string): boolean {
        const supportedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'tif', 'webp', 'ico', 'svg'];
        const extension = this.getFileExtension(filename);
        return supportedExtensions.includes(extension);
    }
}

// 创建单例实例
const imageUploadService = new ImageUploadService();

export default imageUploadService;
