"""
邮件服务 - 发送邮箱验证码
"""
import smtplib
import random
import logging
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pathlib import Path
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# 加载环境变量
project_root = Path(__file__).parent.parent.parent
load_dotenv(os.path.join(project_root, '.env'))

SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "465"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Green Tracker")
SMTP_TIMEOUT = int(os.getenv("SMTP_TIMEOUT", "10"))  # SMTP连接超时秒数


def generate_verification_code(length: int = 6) -> str:
    """生成指定长度的数字验证码"""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])


def send_verification_email(to_email: str, code: str, purpose: str = "register") -> bool:
    """
    发送邮箱验证码

    Args:
        to_email: 收件人邮箱
        code: 6位验证码
        purpose: 用途，"register" | "login" | "reset_password"

    Returns:
        bool: 是否发送成功
    """
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP 未配置，验证码将不会实际发送。验证码: %s -> %s, 用途: %s", code, to_email, purpose)
        return True  # 开发环境下允许通过

    # 根据用途生成不同的邮件文案
    if purpose == "login":
        subject = f"登录验证码：{code} - {SMTP_FROM_NAME}"
        purpose_text = f"您正在登录 {SMTP_FROM_NAME} 账号，以下是您的验证码："
        accent_color = "#2563eb"
        bg_color = "#eff6ff"
    elif purpose == "reset_password":
        subject = f"密码重置验证码：{code} - {SMTP_FROM_NAME}"
        purpose_text = f"您正在重置 {SMTP_FROM_NAME} 账号的密码，以下是您的验证码："
        accent_color = "#d97706"
        bg_color = "#fef3c7"
    else:
        subject = f"注册验证码：{code} - {SMTP_FROM_NAME}"
        purpose_text = f"您正在注册 {SMTP_FROM_NAME} 账号，以下是您的验证码："
        accent_color = "#16a34a"
        bg_color = "#f0fdf4"

    try:
        msg = MIMEMultipart()
        msg["Subject"] = subject
        msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
        msg["To"] = to_email

        html_content = f"""
        <div style="max-width:480px;margin:0 auto;font-family:Arial,sans-serif;">
            <div style="background:linear-gradient(135deg,#16a34a,#2563eb);padding:24px;border-radius:8px 8px 0 0;text-align:center;">
                <h1 style="color:#fff;margin:0;font-size:20px;">{SMTP_FROM_NAME}</h1>
            </div>
            <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <p style="margin:0 0 16px;color:#374151;font-size:14px;">{purpose_text}</p>
                <div style="text-align:center;padding:16px;background:{bg_color};border-radius:6px;margin-bottom:16px;">
                    <span style="font-size:28px;font-weight:700;letter-spacing:6px;color:{accent_color};">{code}</span>
                </div>
                <p style="margin:0;color:#6b7280;font-size:12px;">验证码 5 分钟内有效，请勿泄露给他人。</p>
            </div>
        </div>
        """

        msg.attach(MIMEText(html_content, "html", "utf-8"))

        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT) as server:
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)

        logger.info("验证码邮件已发送至 %s (用途: %s)", to_email, purpose)
        return True
    except Exception as e:
        logger.error("发送验证码邮件失败: %s", str(e))
        raise Exception(f"邮件发送失败: {str(e)}")


def _send_password_reset_email_sync(to_email: str, code: str) -> bool:
    """
    同步发送密码重置验证码（内部函数，用于后台任务）

    Args:
        to_email: 收件人邮箱
        code: 6位验证码

    Returns:
        bool: 是否发送成功
    """
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        logger.warning("SMTP 未配置，密码重置验证码将不会实际发送。验证码: %s -> %s", code, to_email)
        return True

    msg = MIMEMultipart()
    msg["Subject"] = f"密码重置验证码：{code} - {SMTP_FROM_NAME}"
    msg["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
    msg["To"] = to_email

    html_content = f"""
    <div style="max-width:480px;margin:0 auto;font-family:Arial,sans-serif;">
        <div style="background:linear-gradient(135deg,#16a34a,#2563eb);padding:24px;border-radius:8px 8px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:20px;">{SMTP_FROM_NAME}</h1>
        </div>
        <div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <p style="margin:0 0 16px;color:#374151;font-size:14px;">您正在重置 {SMTP_FROM_NAME} 账号的密码，以下是您的验证码：</p>
            <div style="text-align:center;padding:16px;background:#fef3c7;border-radius:6px;margin-bottom:16px;">
                <span style="font-size:28px;font-weight:700;letter-spacing:6px;color:#d97706;">{code}</span>
            </div>
            <p style="margin:0;color:#6b7280;font-size:12px;">验证码 5 分钟内有效，请勿泄露给他人。如非本人操作，请忽略此邮件。</p>
        </div>
    </div>
    """

    msg.attach(MIMEText(html_content, "html", "utf-8"))

    with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT) as server:
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.send_message(msg)

    logger.info("密码重置验证码邮件已发送至 %s", to_email)
    return True


def send_password_reset_email(to_email: str, code: str) -> bool:
    """
    发送密码重置验证码（带超时保护）

    Args:
        to_email: 收件人邮箱
        code: 6位验证码

    Returns:
        bool: 是否发送成功

    Raises:
        Exception: 邮件发送失败
    """
    try:
        return _send_password_reset_email_sync(to_email, code)
    except Exception as e:
        logger.error("发送密码重置邮件失败: %s", str(e))
        raise Exception(f"邮件发送失败: {str(e)}")
