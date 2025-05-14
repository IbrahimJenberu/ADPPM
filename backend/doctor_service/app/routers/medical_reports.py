import uuid
import os
import tempfile
import datetime
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, status, Query, Path
from fastapi.responses import FileResponse, JSONResponse
from typing import Optional, List

# ReportLab imports
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable
from reportlab.lib.units import cm, mm, inch
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

from app import models, schemas
from app.dependencies import get_db_pool, get_current_doctor, validate_doctor_patient_access
from app.exceptions import PatientNotFoundException, ReportGenerationException, DatabaseException

# Try to register fonts - wrap in try/except in case fonts are not available
try:
    # These are common fonts, but you can replace with specific fonts if needed
    pdfmetrics.registerFont(TTFont('Roboto', 'Roboto-Regular.ttf'))
    pdfmetrics.registerFont(TTFont('Roboto-Bold', 'Roboto-Bold.ttf'))
    pdfmetrics.registerFont(TTFont('Roboto-Italic', 'Roboto-Italic.ttf'))
    CUSTOM_FONTS_AVAILABLE = True
except:
    CUSTOM_FONTS_AVAILABLE = False

router = APIRouter(prefix="/reports", tags=["medical reports"])

@router.post("/", response_model=schemas.MedicalReportResponse)
async def generate_report(
    report_data: schemas.MedicalReportCreate,
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Generate a medical report for a patient."""
    try:
        # Create report
        report = await models.MedicalReport.create(
            pool,
            report_data.patient_id,
            doctor_id,
            report_data.dict(),
            report_data.format_type
        )
        
        return {
            "success": True,
            "message": "Medical report generated successfully",
            "report": report
        }
        
    except Exception as e:
        raise ReportGenerationException(detail=f"Failed to generate report: {str(e)}")

@router.get("/", response_model=schemas.MedicalReportsListResponse)
async def get_patient_reports(
    patient_id: uuid.UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Get all medical reports for a patient."""
    try:
        # Get reports
        reports = await models.MedicalReport.get_patient_reports(pool, patient_id)
        
        # Apply pagination
        total = len(reports)
        paginated_reports = reports[skip:skip+limit]
        
        return {
            "success": True,
            "reports": paginated_reports,
            "total": total
        }
        
    except Exception as e:
        raise DatabaseException(detail=f"Failed to get patient reports: {str(e)}")

@router.delete("/{report_id}", response_model=schemas.BaseResponse)
async def delete_medical_report(
    report_id: uuid.UUID = Path(...),
    deletion_reason: str = Query(None, description="Reason for deletion"),
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Permanently delete a medical report by marking it as inactive."""
    try:
        async with pool.acquire() as conn:
            async with conn.transaction():
                # Check if report exists and belongs to this doctor
                check_query = """
                    SELECT mr.id, mr.patient_id, p.first_name || ' ' || p.last_name as patient_name
                    FROM medical_reports mr
                    JOIN patients p ON mr.patient_id = p.id
                    WHERE mr.id = $1 AND mr.doctor_id = $2 AND mr.is_active = true
                """
                
                record = await conn.fetchrow(check_query, report_id, doctor_id)
                
                if not record:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail="Medical report not found or you don't have permission to delete it"
                    )
                
                # Check if the report has been sent to external systems or referenced elsewhere
                # This is a placeholder - implement actual checks based on your business rules
                # For example, you might want to check if the report has been sent to a patient portal
                # or referenced in referrals
                
                # Mark report as inactive (soft delete)
                update_query = """
                    UPDATE medical_reports
                    SET is_active = false, updated_at = NOW()
                    WHERE id = $1
                    RETURNING *
                """
                
                deleted_record = await conn.fetchrow(update_query, report_id)
                
                # Optionally, you could log this deletion in an audit table similar to lab_request_history
                # If you have such a table, add the code here
                
                # Create notification for relevant staff
                notification_title = "Medical Report Deleted"
                notification_content = (
                    f"Medical report for patient {record['patient_name']} has been deleted.\n\n"
                    f"Reason: {deletion_reason or 'No reason provided'}"
                )
                
                # Get doctor name for audit/notification purposes
                doctor_name_query = "SELECT full_name FROM users WHERE id = $1"
                doctor_name = await conn.fetchval(doctor_name_query, doctor_id)
                
                # Create notification for nursing staff or other relevant roles
                # This is optional - adjust based on your requirements
                try:
                    notification_id = uuid.uuid4()
                    notification_query = """
                        INSERT INTO notifications (
                            id, recipient_id, message, notification_type, entity_id, is_read
                        )
                        SELECT
                            $1, 
                            u.id, 
                            $2, 
                            'medical_report_deleted', 
                            $3, 
                            false
                        FROM users u
                        WHERE u.role = 'nurse' AND u.is_active = true
                    """
                    
                    await conn.execute(
                        notification_query,
                        notification_id,
                        notification_content,
                        report_id
                    )
                except Exception as notify_error:
                    # Log notification error but don't fail the deletion
                    print(f"Failed to create notification: {str(notify_error)}")
                
                return {
                    "success": True,
                    "message": "Medical report deleted successfully"
                }
                
    except HTTPException:
        raise
    except Exception as e:
        raise DatabaseException(detail=f"Failed to delete medical report: {str(e)}")

def create_hospital_logo():
    """
    Create a programmatically generated hospital logo since we can't load external images.
    Returns a ReportLab drawing that can be used in the PDF.
    """
    # Create a drawing for the logo
    from reportlab.graphics.shapes import Drawing, Rect, String, Line, Circle
    from reportlab.graphics import renderPDF
    
    d = Drawing(2*cm, 2*cm)
    
    # Draw a circle for the hospital logo
    c = Circle(1*cm, 1*cm, 1*cm, fillColor=colors.HexColor("#5D5CDE"), strokeColor=colors.HexColor("#5D5CDE"))
    d.add(c)
    
    # Draw a white plus sign
    line1 = Line(1*cm, 0.5*cm, 1*cm, 1.5*cm, strokeColor=colors.white, strokeWidth=2)
    line2 = Line(0.5*cm, 1*cm, 1.5*cm, 1*cm, strokeColor=colors.white, strokeWidth=2)
    d.add(line1)
    d.add(line2)
    
    return d

def create_report_styles():
    """Create and return custom styles for the report"""
    # Get the base styles
    base_styles = getSampleStyleSheet()
    
    # Create a dictionary for our custom styles
    styles = {}
    
    # Define new style objects based on whether custom fonts are available
    if CUSTOM_FONTS_AVAILABLE:
        styles['Title'] = ParagraphStyle(
            'Title',
            fontName='Roboto-Bold',
            fontSize=16,
            alignment=TA_CENTER,
            spaceAfter=6
        )
        styles['Heading1'] = ParagraphStyle(
            'Heading1',
            fontName='Roboto-Bold',
            fontSize=14,
            leading=16,
            spaceAfter=4
        )
        styles['Heading2'] = ParagraphStyle(
            'Heading2',
            fontName='Roboto-Bold',
            fontSize=12,
            leading=14,
            spaceBefore=6,
            spaceAfter=4
        )
        styles['Normal'] = ParagraphStyle(
            'Normal',
            fontName='Roboto',
            fontSize=10,
            leading=12,
            spaceAfter=6
        )
        styles['Small'] = ParagraphStyle(
            'Small',
            fontName='Roboto',
            fontSize=8,
            leading=10
        )
        styles['Footer'] = ParagraphStyle(
            'Footer',
            fontName='Roboto',
            fontSize=8,
            textColor=colors.gray,
            alignment=TA_CENTER
        )
    else:
        # Use default fonts but with our custom sizing and formats
        styles['Title'] = ParagraphStyle(
            'Title',
            parent=base_styles['Title'],
            fontSize=16,
            alignment=TA_CENTER,
            spaceAfter=6
        )
        styles['Heading1'] = ParagraphStyle(
            'Heading1',
            parent=base_styles['Heading1'],
            fontSize=14,
            leading=16,
            spaceAfter=4
        )
        styles['Heading2'] = ParagraphStyle(
            'Heading2',
            parent=base_styles['Heading2'],
            fontSize=12,
            leading=14,
            spaceBefore=6,
            spaceAfter=4
        )
        styles['Normal'] = ParagraphStyle(
            'Normal',
            parent=base_styles['Normal'],
            fontSize=10,
            leading=12,
            spaceAfter=6
        )
        styles['Small'] = ParagraphStyle(
            'Small',
            parent=base_styles['Normal'],
            fontSize=8,
            leading=10
        )
        styles['Footer'] = ParagraphStyle(
            'Footer',
            parent=base_styles['Normal'],
            fontSize=8,
            textColor=colors.gray,
            alignment=TA_CENTER
        )
    
    return styles

@router.get("/{report_id}/download")
async def download_report(
    report_id: uuid.UUID = Path(...),
    pool = Depends(get_db_pool),
    doctor_id: uuid.UUID = Query(..., description="Doctor ID from frontend"),
):
    """Download a medical report."""
    try:
        async with pool.acquire() as conn:
            # Get the report with additional patient data using LEFT JOINs
            query = """
                SELECT 
                    mr.*, 
                    p.first_name || ' ' || p.last_name as patient_name,
                    p.date_of_birth,
                    p.gender,
                    p.phone_number,
                    p.blood_group,
                    p.allergies,
                    u.full_name as doctor_name,
                    u.specialization as doctor_specialization
                FROM medical_reports mr
                LEFT JOIN patients p ON mr.patient_id = p.id
                LEFT JOIN users u ON mr.doctor_id = u.id
                WHERE mr.id = $1 AND mr.doctor_id = $2 AND mr.is_active = true
            """
            
            record = await conn.fetchrow(query, report_id, doctor_id)
            
            if not record:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Report not found"
                )
                
            report = dict(record)
            
            if report["format_type"] == "pdf":
                # Generate a unique temporary file path
                pdf_path = f"/tmp/medical_report_{report_id}_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}.pdf"
                
                # Create PDF with professional styling
                doc = SimpleDocTemplate(
                    pdf_path,
                    pagesize=A4,
                    rightMargin=2*cm,
                    leftMargin=2*cm,
                    topMargin=2*cm,
                    bottomMargin=2*cm,
                    title=f"Medical Report - {report['patient_name']}",
                    author="Arba Minch Referral Hospital"
                )
                
                # Get custom styles
                styles = create_report_styles()
                
                # Build content
                content = []
                
                # Hospital Logo and Header
                logo = create_hospital_logo()
                
                # Create header table with logo and hospital info
                hospital_name = "ARBA MINCH REFERRAL HOSPITAL"
                hospital_address = "Arba Minch, SNNPR, Ethiopia"
                hospital_contact = "Tel: +251-123-456789 | Email: info@arbaminchreferal.gov.et"
                hospital_website = "www.arbaminchreferal.gov.et"
                
                header_data = [
                    [Image(logo, width=1.5*cm, height=1.5*cm), 
                     Paragraph(f"<b>{hospital_name}</b>", styles['Title']), 
                     ""],
                    ["", Paragraph(hospital_address, styles['Normal']), ""],
                    ["", Paragraph(hospital_contact, styles['Small']), ""],
                    ["", Paragraph(hospital_website, styles['Small']), ""]
                ]
                
                header_table = Table(header_data, colWidths=[2*cm, 13*cm, 2*cm])
                header_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (0, 3), 'CENTER'),
                    ('ALIGN', (1, 0), (1, 3), 'CENTER'),
                    ('VALIGN', (0, 0), (0, 3), 'MIDDLE'),
                    ('SPAN', (0, 0), (0, 3)),
                ]))
                content.append(header_table)
                content.append(Spacer(1, 5*mm))
                
                # Document Title and Separator
                content.append(Paragraph("MEDICAL REPORT", styles['Title']))
                content.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#5D5CDE"), spaceAfter=5*mm))
                content.append(Spacer(1, 3*mm))
                
                # Report metadata
                report_date = report['created_at'].strftime('%Y-%m-%d')
                report_id_formatted = str(report_id).upper()
                report_meta_data = [
                    ["Report ID:", report_id_formatted, "Date Issued:", report_date],
                    ["Report Type:", "Clinical Assessment", "Confidentiality:", "CONFIDENTIAL"]
                ]
                
                meta_table = Table(report_meta_data, colWidths=[2.5*cm, 6.5*cm, 2.5*cm, 5.5*cm])
                meta_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, 1), colors.HexColor("#F2F2F7")),
                    ('BACKGROUND', (2, 0), (2, 1), colors.HexColor("#F2F2F7")),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('FONTSIZE', (0, 0), (-1, -1), 9),
                ]))
                content.append(meta_table)
                content.append(Spacer(1, 5*mm))
                
                # Patient Information Section
                content.append(Paragraph("PATIENT INFORMATION", styles['Heading1']))
                
                # Calculate age from date of birth if available
                age = "N/A"
                if report.get('date_of_birth'):
                    try:
                        today = datetime.date.today()
                        born = report['date_of_birth']
                        age = f"{today.year - born.year - ((today.month, today.day) < (born.month, born.day))}"
                    except:
                        # If there's any error in calculating age, just use N/A
                        age = "N/A"
                
                # Safe access to date of birth
                dob_str = "Not Available"
                if report.get('date_of_birth'):
                    try:
                        dob_str = report['date_of_birth'].strftime('%Y-%m-%d')
                    except:
                        dob_str = "Not Available"
                
                # Handle allergies with proper error checking
                allergies = "None reported"
                if report.get('allergies'):
                    try:
                        if isinstance(report['allergies'], list):
                            allergies = ", ".join(report['allergies'])
                        elif isinstance(report['allergies'], str):
                            allergies = report['allergies']
                    except:
                        allergies = "None reported"
                                
                patient_data = [
                    ["Patient Name:", report['patient_name'] or "Not Available", "Gender:", report.get('gender') or "Not Available"],
                    ["Date of Birth:", dob_str, "Age:", f"{age} years"],
                    ["Blood Group:", report.get('blood_group') or "Not Available", "Contact:", report.get('phone_number') or "Not Available"],
                    ["Allergies:", allergies, "", ""]
                ]
                
                patient_table = Table(patient_data, colWidths=[2.5*cm, 6.5*cm, 2.5*cm, 5.5*cm])
                patient_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F2F2F7")),
                    ('BACKGROUND', (2, 0), (2, -1), colors.HexColor("#F2F2F7")),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('SPAN', (1, 3), (3, 3)),  # Span allergies across columns
                ]))
                content.append(patient_table)
                content.append(Spacer(1, 5*mm))
                
                # Healthcare Provider Information
                content.append(Paragraph("HEALTHCARE PROVIDER", styles['Heading1']))
                provider_data = [
                    ["Physician:", report['doctor_name'] or "Not Available"],
                    ["Specialization:", report.get('doctor_specialization') or "Not Available"]
                ]
                
                provider_table = Table(provider_data, colWidths=[3*cm, 14*cm])
                provider_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#F2F2F7")),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ]))
                content.append(provider_table)
                content.append(Spacer(1, 7*mm))
                
                # Clinical Information
                content.append(Paragraph("CLINICAL INFORMATION", styles['Heading1']))
                
                # Diagnosis section
                content.append(Paragraph("Diagnosis", styles['Heading2']))
                content.append(Paragraph(report['diagnosis'], styles['Normal']))
                content.append(Spacer(1, 3*mm))
                
                # Treatment section
                content.append(Paragraph("Treatment Plan", styles['Heading2']))
                content.append(Paragraph(report['treatment'], styles['Normal']))
                content.append(Spacer(1, 3*mm))
                
                # Prescriptions section
                content.append(Paragraph("Medications Prescribed", styles['Heading2']))
                
                # Format prescriptions in a nice table if there are any
                if report['prescriptions'] and len(report['prescriptions']) > 0:
                    prescription_data = [["Medication", "Dosage", "Instructions"]]
                    
                    # Parse prescriptions - assume they might have dosage info
                    for prescription in report['prescriptions']:
                        parts = prescription.split(',', 2)
                        if len(parts) >= 3:
                            prescription_data.append([parts[0].strip(), parts[1].strip(), parts[2].strip()])
                        elif len(parts) == 2:
                            prescription_data.append([parts[0].strip(), parts[1].strip(), "As directed"])
                        else:
                            prescription_data.append([prescription, "As prescribed", "As directed"])
                    
                    prescription_table = Table(prescription_data, colWidths=[7*cm, 4*cm, 6*cm])
                    prescription_table.setStyle(TableStyle([
                        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#F2F2F7")),
                        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ]))
                    content.append(prescription_table)
                else:
                    content.append(Paragraph("No medications prescribed", styles['Normal']))
                
                content.append(Spacer(1, 3*mm))
                
                # Observations section
                content.append(Paragraph("Clinical Observations", styles['Heading2']))
                content.append(Paragraph(report['observations'] or 'None reported', styles['Normal']))
                content.append(Spacer(1, 3*mm))
                
                # Recommendations section
                content.append(Paragraph("Follow-up Recommendations", styles['Heading2']))
                content.append(Paragraph(report['recommendations'] or 'None provided', styles['Normal']))
                content.append(Spacer(1, 10*mm))
                
                # Signature section
                signature_data = [
                    ["____________________________", "", "____________________________"],
                    ["Physician Signature", "", "Date"],
                    [f"Dr. {report['doctor_name']}", "", report_date]
                ]
                
                signature_table = Table(signature_data, colWidths=[7*cm, 3*cm, 7*cm])
                signature_table.setStyle(TableStyle([
                    ('ALIGN', (0, 0), (0, -1), 'CENTER'),
                    ('ALIGN', (2, 0), (2, -1), 'CENTER'),
                    ('ALIGN', (0, 1), (0, 1), 'CENTER'),
                    ('ALIGN', (2, 1), (2, 1), 'CENTER'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('FONTSIZE', (0, 2), (2, 2), 9),
                ]))
                content.append(signature_table)
                
                # Footer with disclaimer
                content.append(Spacer(1, 10*mm))
                content.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
                content.append(Spacer(1, 2*mm))
                
                disclaimer = """This report is confidential and intended solely for the patient named above and healthcare professionals involved in their care. 
                Unauthorized disclosure, copying, or distribution is prohibited. The information in this report is based on clinical assessment 
                at the time of examination and may require further review."""
                
                content.append(Paragraph(disclaimer, styles['Footer']))
                
                # Build the PDF
                doc.build(content)
                
                # Return the PDF file
                return FileResponse(
                    path=pdf_path,
                    filename=f"AMRH_Medical_Report_{report_id}.pdf",
                    media_type="application/pdf"
                )
            else:
                # Text format - improved but simpler format
                with tempfile.NamedTemporaryFile(delete=False, suffix=".txt") as temp_file:
                    # Generate enhanced text content
                    content = f"""
=============================================================
                ARBA MINCH REFERRAL HOSPITAL
                   MEDICAL REPORT
=============================================================
Report ID: {report_id}
Date Issued: {report['created_at'].strftime('%Y-%m-%d')}

PATIENT INFORMATION:
--------------------
Name: {report['patient_name'] or "Not Available"}
Gender: {report.get('gender') or "Not Available"}
Date of Birth: {report.get('date_of_birth').strftime('%Y-%m-%d') if report.get('date_of_birth') else "Not Available"}
Blood Group: {report.get('blood_group') or "Not Available"}
Contact: {report.get('phone_number') or "Not Available"}
Allergies: {", ".join(report.get('allergies') or ["None reported"]) if isinstance(report.get('allergies'), list) else "None reported"}

HEALTHCARE PROVIDER:
-------------------
Physician: {report['doctor_name'] or "Not Available"}
Specialization: {report.get('doctor_specialization') or "Not Available"}

CLINICAL INFORMATION:
--------------------
DIAGNOSIS:
{report['diagnosis']}

TREATMENT PLAN:
{report['treatment']}

MEDICATIONS PRESCRIBED:
{', '.join(report['prescriptions']) if report['prescriptions'] else "None prescribed"}

CLINICAL OBSERVATIONS:
{report['observations'] or 'None reported'}

FOLLOW-UP RECOMMENDATIONS:
{report['recommendations'] or 'None provided'}

=============================================================
Physician Signature: __________________________ Date: {report['created_at'].strftime('%Y-%m-%d')}
Dr. {report['doctor_name']}

CONFIDENTIAL: This report is confidential and intended solely for the patient named 
above and healthcare professionals involved in their care.
=============================================================
"""
                    temp_file.write(content.encode('utf-8'))
                    temp_file_path = temp_file.name
                
                # Return the text file
                return FileResponse(
                    path=temp_file_path,
                    filename=f"AMRH_Medical_Report_{report_id}.txt",
                    media_type="text/plain"
                )
                
    except HTTPException:
        raise
    except Exception as e:
        raise ReportGenerationException(detail=f"Failed to download report: {str(e)}")