import smtplib
from email.message import EmailMessage
import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def send_email(to_email: str, subject: str, html_content: str):
    """
    Sends an email using Gmail SMTP.
    Requires SMTP_EMAIL and SMTP_PASSWORD to be set in environment variables.
    """
    sender_email = os.getenv("SMTP_EMAIL", "akashkbsa01@gmail.com")
    sender_password = os.getenv("SMTP_PASSWORD", "") # The user must set this App Password
    
    # If no password is provided, just print to console (development mode)
    if not sender_password:
        print("*" * 50)
        print("WARNING: SMTP_PASSWORD is not set in the environment.")
        print(f"Would have sent email to: {to_email}")
        print(f"Subject: {subject}")
        print("Content:")
        print(html_content)
        print("*" * 50)
        return True

    msg = EmailMessage()
    msg['Subject'] = subject
    msg['From'] = f"CrowdFloat <{sender_email}>"
    msg['To'] = to_email
    
    msg.set_content("Please enable HTML to view this email.")
    msg.add_alternative(html_content, subtype='html')

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(sender_email, sender_password)
            smtp.send_message(msg)
        return True
    except Exception as e:
        print(f"Error sending email to {to_email}: {e}")
        return False

def send_otp_email(to_email: str, otp: str):
    subject = "Your CrowdFloat Login OTP"
    html = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px; color: #1e293b; max-width: 500px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #f8fafc;">
        <h2 style="color: #1d4ed8; text-align: center;">CrowdFloat Login</h2>
        <p>Hello,</p>
        <p>You requested a One-Time Password (OTP) to sign in to your CrowdFloat account.</p>
        <div style="background-color: #ffffff; padding: 16px; border-radius: 8px; text-align: center; margin: 20px 0; border: 1px dashed #cbd5e1;">
            <p style="font-size: 14px; color: #64748b; margin-bottom: 8px; margin-top: 0;">Your Verification Code</p>
            <h1 style="color: #0f172a; margin: 0; font-size: 36px; letter-spacing: 4px;">{otp}</h1>
        </div>
        <p style="font-size: 13px; color: #64748b;">This code will expire in 5 minutes. If you did not request this, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">&copy; 2026 CrowdFloat. All rights reserved.</p>
    </div>
    """
    return send_email(to_email, subject, html)

def send_invoice_approval_email(invoice_id: str, amount: float, token: str, buyer_email: str = "", frontend_url: str = "http://localhost:5173"):
    # Use the buyer's email when provided; fall back to the demo inbox.
    to_email = (buyer_email or "").strip() or os.getenv("DEMO_BUYER_EMAIL", "akashkbsa01@gmail.com")
    subject = f"Invoice Approval Required: {invoice_id}"
    
    approval_link = f"{frontend_url}/confirm-invoice?invoice_id={invoice_id}&token={token}&action=approve"
    rejection_link = f"{frontend_url}/confirm-invoice?invoice_id={invoice_id}&token={token}&action=reject"
    
    html = f"""
    <div style="font-family: Arial, sans-serif; padding: 24px; color: #1e293b; max-width: 550px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 24px;">
            <h2 style="color: #1d4ed8; margin: 0;">Invoice Approval Request</h2>
        </div>
        
        <p style="font-size: 16px;">Hello,</p>
        <p style="font-size: 16px;">An MSME supplier has submitted an invoice for your approval. Please review the details below:</p>
        
        <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; margin: 20px 0; border: 1px solid #e2e8f0;">
            <table style="width: 100%; font-size: 15px;">
                <tr>
                    <td style="color: #64748b; padding-bottom: 8px; width: 40%;">Invoice Number:</td>
                    <td style="font-weight: 600; color: #0f172a; padding-bottom: 8px;">{invoice_id}</td>
                </tr>
                <tr>
                    <td style="color: #64748b; padding-bottom: 8px;">Total Amount:</td>
                    <td style="font-weight: 600; color: #1e3a8a; font-size: 18px; padding-bottom: 8px;">₹{amount:,.2f}</td>
                </tr>
                <tr>
                    <td style="color: #64748b;">Action Required:</td>
                    <td style="font-weight: 600; color: #b45309;">Needs Confirmation</td>
                </tr>
            </table>
        </div>
        
        <p style="font-size: 18px; font-weight: bold; text-align: center; margin-top: 32px; margin-bottom: 24px;">
            Do you approve Invoice {invoice_id} for ₹{amount:,.2f}?
        </p>
        
        <table style="width: 100%; text-align: center; margin-bottom: 32px;">
            <tr>
                <td style="width: 50%; padding-right: 8px;">
                    <a href="{approval_link}" style="display: block; background-color: #16a34a; color: white; padding: 14px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        ✅ Approve
                    </a>
                </td>
                <td style="width: 50%; padding-left: 8px;">
                    <a href="{rejection_link}" style="display: block; background-color: #ef4444; color: white; padding: 14px 20px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                        ❌ Reject
                    </a>
                </td>
            </tr>
        </table>
        
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">Clicking 'Approve' will automatically mark this invoice as confirmed in your CrowdFloat Buyer Dashboard.</p>
    </div>
    """
    return send_email(to_email, subject, html)
