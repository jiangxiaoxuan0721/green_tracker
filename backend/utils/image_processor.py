"""
图像处理工具函数
提供图像格式识别和基础处理功能
"""

import magic
import hashlib
from typing import Optional, Any, Dict
from pathlib import Path


class ImageProcessor:
    """图像处理器"""
    
    # 支持的图像格式映射
    IMAGE_FORMATS: dict[str, list[str]] = {
        'JPEG': ['jpg', 'jpeg'],
        'PNG': ['png'],
        'GIF': ['gif'],
        'BMP': ['bmp'],
        'TIFF': ['tiff', 'tif'],
        'WEBP': ['webp'],
        'ICO': ['ico'],
        'SVG': ['svg']
    }
    
    # MIME类型映射
    MIME_TYPES: dict[str, str] = {
        'image/jpeg': 'JPEG',
        'image/jpg': 'JPEG',
        'image/png': 'PNG',
        'image/gif': 'GIF',
        'image/bmp': 'BMP',
        'image/tiff': 'TIFF',
        'image/webp': 'WEBP',
        'image/x-icon': 'ICO',
        'image/svg+xml': 'SVG'
    }
    
    @staticmethod
    def detect_image_format(file_data: bytes, filename: Optional[str] = None) -> Dict[str, Any]:
        """
        检测图像格式
        
        Args:
            file_data: 文件字节数据
            filename: 文件名（可选）
            
        Returns:
            包含格式信息的字典
        """
        try:
            result: Dict[str, Any] = {
                'format': None,
                'extension': None,
                'mime_type': None,
                'size_bytes': len(file_data),
                'is_valid_image': False,
                'confidence': 0.0
            }
            
            # 使用python-magic检测MIME类型
            try:
                mime_type = magic.from_buffer(file_data, mime=True)
                result['mime_type'] = mime_type
                
                # 根据MIME类型确定格式
                if mime_type in ImageProcessor.MIME_TYPES:
                    format_name = ImageProcessor.MIME_TYPES[mime_type]
                    result['format'] = format_name
                    result['is_valid_image'] = True
                    result['confidence'] = 0.9
            except Exception:
                pass
            
 # 基于文件头的额外验证
            try:
                # 检查常见图像格式的文件头
                def get_format_from_header(data: bytes) -> str | None:
                    if data.startswith(b'\xFF\xD8\xFF'):
                        return 'JPEG'
                    elif data.startswith(b'\x89PNG\r\n\x1a\n'):
                        return 'PNG'
                    elif data.startswith(b'GIF87a') or data.startswith(b'GIF89a'):
                        return 'GIF'
                    elif data.startswith(b'BM'):
                        return 'BMP'
                    elif data.startswith(b'II*\x00') or data.startswith(b'MM\x00*'):
                        return 'TIFF'
                    elif data.startswith(b'RIFF') and len(data) > 8:
                        # WEBP格式检查
                        if data[8:12] == b'WEBP':
                            return 'WEBP'
                    elif data.startswith(b'<svg'):
                        return 'SVG'
                    return None
                
                header_format = get_format_from_header(file_data)
                if header_format:
                    # 如果文件头检测和magic检测都成功，提高置信度
                    if result['format'] and result['format'] == header_format:
                        result['confidence'] = min(result['confidence'] + 0.2, 1.0)
                    elif not result['format']:
                        result['format'] = header_format
                        result['is_valid_image'] = True
                        result['confidence'] = 0.8
            except Exception:
                pass
            
            # 从文件名推断扩展名
            if filename:
                ext = Path(filename).suffix.lower().lstrip('.')
                result['extension'] = ext
                
                # 验证扩展名与检测格式的一致性
                if result['format'] and result['format'].lower() in ext.lower():
                    result['confidence'] = min(result['confidence'] + 0.1, 1.0)
            
            # 确定最终的扩展名
            if result['format']:
                format_lower = result['format'].lower()
                for fmt, exts in ImageProcessor.IMAGE_FORMATS.items():
                    if fmt.lower() == format_lower:
                        # 直接更新扩展名
                        result['extension'] = exts[0]  # 使用第一个扩展名
                        break
            
            return result
            
        except Exception as e:
            return {
                'format': None,
                'extension': None,
                'mime_type': None,
                'size_bytes': len(file_data),
                'is_valid_image': False,
                'confidence': 0.0,
                'error': str(e)
            }
    
    @staticmethod
    def calculate_checksum(file_data: bytes) -> str:
        """
        计算文件校验和
        
        Args:
            file_data: 文件字节数据
            
        Returns:
            MD5校验和
        """
        return hashlib.md5(file_data).hexdigest()
    
    @staticmethod
    def get_image_metadata(file_data: bytes) -> Dict[str, Any]:
        """
        获取图像元数据
        
        Args:
            file_data: 文件字节数据
            
        Returns:
            图像元数据字典
        """
        try:
            from PIL import Image
            import io
            
            # 使用PIL获取图像信息
            image = Image.open(io.BytesIO(file_data))
            
            metadata = {
                'width': image.width,
                'height': image.height,
                'mode': image.mode,
                'has_transparency': image.mode in ('RGBA', 'LA') or 'transparency' in image.info,
                'format': image.format,
                'size_mb': round(len(file_data) / (1024 * 1024), 2)
            }
            
            # 尝试获取EXIF信息
            if hasattr(image, '_getexif') and image._getexif() is not None:
                try:
                    exif = image._getexif()
                    if exif:
                        from PIL.ExifTags import TAGS
                        exif_data = {}
                        for tag_id, value in exif.items():
                            tag = TAGS.get(tag_id, tag_id)
                            if isinstance(value, (str, int, float)):
                                exif_data[tag] = value
                        metadata['exif'] = exif_data
                except Exception:
                    pass
            
            image.close()
            return metadata
            
        except ImportError:
            # 如果没有安装PIL，返回基本信息
            return {
                'size_mb': round(len(file_data) / (1024 * 1024), 2),
                'format': None,
                'width': None,
                'height': None,
                'mode': None,
                'has_transparency': None,
                'note': 'PIL库未安装，仅获取基本信息'
            }
        except Exception as e:
            return {
                'size_mb': round(len(file_data) / (1024 * 1024), 2),
                'error': f'获取图像元数据失败: {str(e)}'
            }
    
    @staticmethod
    def validate_image_file(file_data: bytes, max_size_mb: int = 50) -> Dict[str, Any]:
        """
        验证图像文件
        
        Args:
            file_data: 文件字节数据
            max_size_mb: 最大文件大小（MB）
            
        Returns:
            验证结果字典
        """
        size_mb = len(file_data) / (1024 * 1024)
        
        validation_result: Dict[str, Any] = {
            'is_valid': True,
            'errors': [],
            'warnings': []
        }
        
        # 检查文件大小
        if size_mb > max_size_mb:
            validation_result['is_valid'] = False
            validation_result['errors'].append(f'文件大小 {size_mb:.2f}MB 超过限制 {max_size_mb}MB')
        elif size_mb > 10:
            validation_result['warnings'].append(f'文件大小 {size_mb:.2f}MB 较大，可能影响上传速度')
        
        # 检测图像格式
        format_info = ImageProcessor.detect_image_format(file_data)
        
        if not format_info['is_valid_image']:
            validation_result['is_valid'] = False
            validation_result['errors'].append('不是有效的图像文件')
        elif format_info['confidence'] < 0.7:
            validation_result['warnings'].append('图像格式检测置信度较低')
        
        # 检查是否为支持的格式
        if format_info['format'] and format_info['format'] not in ImageProcessor.IMAGE_FORMATS:
            validation_result['is_valid'] = False
            validation_result['errors'].append(f'不支持的图像格式: {format_info["format"]}')
        
        validation_result['format_info'] = format_info
        
        return validation_result


def get_image_processor() -> ImageProcessor:
    """获取图像处理器实例"""
    return ImageProcessor()