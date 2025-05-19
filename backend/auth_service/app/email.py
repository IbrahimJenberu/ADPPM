# auth_service/app/email.py
"""Email utilities for sending emails."""
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Tuple
import asyncio
from datetime import datetime

from .config import settings

# Set up logging
logger = logging.getLogger("auth_service.email")

async def send_email_async(
    recipients: List[str],
    subject: str,
    html_content: str,
    plain_content: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    Send an email asynchronously.
    
    Args:
        recipients: List of recipient email addresses
        subject: Email subject
        html_content: HTML content of the email
        plain_content: Plain text content of the email (optional)
        
    Returns:
        Tuple containing (success_status, error_message)
    """
    # Check SMTP configuration
    if not settings.SMTP_SERVER or not settings.SMTP_PORT:
        error_msg = "Email not sent: SMTP server or port not configured"
        logger.error(error_msg)
        return False, error_msg
        
    # Check SMTP credentials
    if not settings.SMTP_USERNAME or not settings.SMTP_PASSWORD:
        error_msg = "Email not sent: SMTP credentials not configured"
        logger.warning(error_msg)
        return False, error_msg
    
    # Run the email sending in a thread to not block asyncio
    loop = asyncio.get_event_loop()
    try:
        result, error_msg = await loop.run_in_executor(
            None, 
            send_email_sync, 
            recipients, 
            subject, 
            html_content, 
            plain_content
        )
        return result, error_msg
    except Exception as e:
        error_msg = f"Error sending email: {str(e)}"
        logger.error(error_msg)
        return False, error_msg

def send_email_sync(
    recipients: List[str],
    subject: str,
    html_content: str,
    plain_content: Optional[str] = None
) -> Tuple[bool, Optional[str]]:
    """
    Send an email synchronously.
    
    Args:
        recipients: List of recipient email addresses
        subject: Email subject
        html_content: HTML content of the email
        plain_content: Plain text content of the email (optional)
        
    Returns:
        Tuple containing (success_status, error_message)
    """
    try:
        # Create message
        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = settings.EMAIL_FROM
        message["To"] = ", ".join(recipients)
        
        # Add plain text version if provided, else use stripped HTML
        if plain_content is None:
            # Simple stripping of HTML tags for plain text
            import re
            plain_content = re.sub(r'<.*?>', '', html_content)
        
        # Attach parts
        message.attach(MIMEText(plain_content, "plain"))
        message.attach(MIMEText(html_content, "html"))
        
        # Send email
        with smtplib.SMTP(settings.SMTP_SERVER, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
            server.send_message(message)
            
        logger.info(f"Email sent to {', '.join(recipients)}")
        return True, None
        
    except smtplib.SMTPAuthenticationError:
        error_msg = "SMTP authentication failed: Invalid credentials"
        logger.error(error_msg)
        return False, error_msg
    except smtplib.SMTPConnectError:
        error_msg = f"Failed to connect to SMTP server {settings.SMTP_SERVER}:{settings.SMTP_PORT}"
        logger.error(error_msg)
        return False, error_msg
    except Exception as e:
        error_msg = f"Error sending email: {str(e)}"
        logger.error(error_msg)
        return False, error_msg

async def send_password_reset_email(email: str, reset_token: str) -> Tuple[bool, Optional[str]]:
    """
    Send a password reset email.
    
    Args:
        email: Recipient email address
        reset_token: Password reset token
        
    Returns:
        Tuple containing (success_status, error_message)
    """
    # Create reset link
    reset_link = f"https://adppm.com/reset-password?token={reset_token}"
    
    # Create email content
    subject = "ADPPM Password Reset"
    html_content = f"""
    <html>
        <body>
            <h2>Password Reset Request</h2>
            <p>You requested a password reset for your ADPPM account. Click the link below to reset your password:</p>
            <p><a href="{reset_link}">Reset Your Password</a></p>
            <p>If you did not request this reset, please ignore this email.</p>
            <p>The link will expire in 24 hours.</p>
            <p>Regards,<br>ADPPM Team</p>
        </body>
    </html>
    """
    
    # Send email
    return await send_email_async([email], subject, html_content)

async def send_welcome_email(email: str, username: str) -> Tuple[bool, Optional[str]]:
    """
    Send a welcome email to a new user.
    
    Args:
        email: Recipient email address
        username: User's username
        
    Returns:
        Tuple containing (success_status, error_message)
    """
    subject = "Welcome to ADPPM"
    html_content = f"""
    <html>
        <body>
            <h2>Welcome to ADPPM!</h2>
            <p>Hello {username},</p>
            <p>Your account has been successfully created. You can now log in to the system with your credentials.</p>
            <p>If you need any assistance, please contact our support team.</p>
            <p>Regards,<br>ADPPM Team</p>
        </body>
    </html>
    """
    
    # Send email
    return await send_email_async([email], subject, html_content)

async def send_security_alert_email(email: str, client_info: dict) -> Tuple[bool, Optional[str]]:
    """
    Send a security alert email when suspicious activity is detected.
    
    Args:
        email: Recipient email address
        client_info: Information about the client (IP, user agent, etc.)
        
    Returns:
        Tuple containing (success_status, error_message)
    """
    # Create email content
    subject = "ADPPM Security Alert - Unusual Account Activity"
    html_content = f"""
    <html>
        <body>
            <h2>Security Alert: Unusual Account Activity</h2>
            <p>We detected unusual activity on your ADPPM account.</p>
            <p>IP Address: {client_info.get('ip', 'unknown')}</p>
            <p>Device: {client_info.get('user_agent', 'unknown')}</p>
            <p>Time: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC</p>
            <p>If this was not you, please change your password immediately and contact support.</p>
            <p>Regards,<br>ADPPM Security Team</p>
        </body>
    </html>
    """
    
    # Send email
    return await send_email_async([email], subject, html_content)