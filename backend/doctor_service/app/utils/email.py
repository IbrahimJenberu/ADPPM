import smtplib
from email.message import EmailMessage
import os
from typing import Optional
import logging

# Configure logging
logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", 587))
        self.smtp_username = os.getenv("SMTP_USERNAME")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.from_email = os.getenv("FROM_EMAIL", "noreply@hospital.com")

    async def send_email(
        self,
        recipient: str,
        subject: str,
        content: str,
        html_content: Optional[str] = None
    ) -> bool:
        """Send email using SMTP server with async support"""
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = self.from_email
            msg["To"] = recipient
            msg.set_content(content)
            
            if html_content:
                msg.add_alternative(html_content, subtype="html")

            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_username, self.smtp_password)
                server.send_message(msg)
            
            logger.info(f"Email sent to {recipient}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return False

# Singleton instance
email_service = EmailService()

async def send_email(recipient: str, subject: str, content: str) -> bool:
    """Helper function for sending emails"""
    return await email_service.send_email(recipient, subject, content)