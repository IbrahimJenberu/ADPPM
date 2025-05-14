# app/routers/reports.py
import uuid
import os
import io
import base64
import sys
import traceback
import asyncio
import tempfile
from typing import List, Optional, Dict, Any, Tuple, Union
from fastapi import APIRouter, Depends, Query, Path, HTTPException, status, Body, BackgroundTasks
from datetime import datetime, date, timedelta
import json
from fastapi.responses import FileResponse, JSONResponse
from math import ceil
import logging

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

# New dependencies for enhanced reports
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak, ListFlowable, ListItem
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.graphics.shapes import Drawing, Line
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.linecharts import HorizontalLineChart
from reportlab.graphics.charts.legends import Legend
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.graphics.shapes import String
# Do not import makeMarker, use standard markers
from itertools import groupby
from operator import itemgetter

from ..schemas import ReportGenerateRequest, ReportResponse
from ..database import get_connection, fetch_all, insert
from ..exceptions import NotFoundException, DatabaseException
from ..config import settings

# Constants for retry policy
MAX_DB_RETRIES = 3
DB_RETRY_DELAY = 0.5  # seconds

router = APIRouter(prefix="/reports", tags=["Reports"])

# -------- Helper functions for data acquisition --------
async def get_report_data(start_date, end_date):
    """Get all report data needed for generation in any format"""
    # Get a new database connection
    retries = 0
    last_exception = None
    
    while retries < MAX_DB_RETRIES:
        conn = None
        try:
            conn = await get_connection()
            
            # Query for lab requests within date range
            query = """
                SELECT lr.id, lr.patient_id, lr.doctor_id, lr.technician_id, 
                       lr.test_type, lr.priority, lr.status, lr.notes,
                       lr.created_at, lr.updated_at, lr.completed_at,
                       lr.is_read, lr.read_at
                FROM lab_requests lr
                WHERE DATE(lr.created_at) BETWEEN $1 AND $2
                ORDER BY lr.created_at ASC
            """
            
            rows = await conn.fetch(query, start_date, end_date)
            
            # Get users data separately for doctor and technician names
            user_ids = set()
            for row in rows:
                if row["doctor_id"]:
                    user_ids.add(str(row["doctor_id"]))
                if row["technician_id"]:
                    user_ids.add(str(row["technician_id"]))
            
            # Get all user names in a single query if any IDs exist
            users_data = {}
            if user_ids:
                users_query = """
                    SELECT id, full_name, role
                    FROM users 
                    WHERE id = ANY($1::uuid[])
                """
                users_rows = await conn.fetch(users_query, list(user_ids))
                users_data = {str(row["id"]): row["full_name"] for row in users_rows}
            
            lab_requests = []
            for db_row in rows:
                try:
                    row = dict(db_row)
                    # Add names from users data
                    row["doctor_name"] = users_data.get(str(row.get("doctor_id")), "Unknown")
                    row["technician_name"] = users_data.get(str(row.get("technician_id")), "")
                    # Generate a patient identifier from the UUID
                    patient_id = str(row.get('patient_id', ''))
                    if patient_id:
                        row["patient_name"] = f"Patient {patient_id.replace('-','')[-8:]}"
                    else:
                        row["patient_name"] = "Unknown Patient"
                    lab_requests.append(row)
                except Exception as row_error:
                    logger.warning(f"Error processing lab request row: {str(row_error)}")
                    # Continue with next row instead of failing the entire report
            
            # Calculate summary statistics with defensive programming
            total_requests = len(lab_requests)
            status_counts = {}
            priority_counts = {}
            test_type_counts = {}
            unread_count = 0
            completed_count = 0
            avg_response_time = None
            
            # Daily trend data
            date_range_days = (end_date - start_date).days + 1
            daily_data = {}
            
            for i in range(date_range_days):
                current_date = start_date + timedelta(days=i)
                daily_data[current_date.isoformat()] = 0
            
            response_times = []
            
            for req in lab_requests:
                try:
                    # Count by status
                    status = req.get("status")
                    if status:  # Only count if status is not None
                        status_counts[status] = status_counts.get(status, 0) + 1
                    
                    # Count by priority
                    priority = req.get("priority")
                    if priority:  # Only count if priority is not None
                        priority_counts[priority] = priority_counts.get(priority, 0) + 1
                    
                    # Count by test type
                    test_type = req.get("test_type")
                    if test_type:  # Only count if test_type is not None
                        test_type_counts[test_type] = test_type_counts.get(test_type, 0) + 1
                    
                    # Count unread
                    if req.get("is_read") is False:  # Explicitly check for False
                        unread_count += 1
                        
                    # Count completed and calculate response time
                    if status == "completed":
                        completed_count += 1
                        
                        # Calculate response time for completed requests
                        completed_at = req.get("completed_at")
                        created_at = req.get("created_at")
                        
                        if completed_at and created_at:
                            # Calculate time difference in hours
                            diff = (completed_at - created_at).total_seconds() / 3600
                            if diff >= 0:  # Ensure positive time difference
                                response_times.append(diff)
                    
                    # Add to daily trend data
                    created_at = req.get("created_at")
                    if created_at:
                        request_date = created_at.date().isoformat()
                        if request_date in daily_data:
                            daily_data[request_date] += 1
                except Exception as stat_error:
                    logger.warning(f"Error calculating statistics for request: {str(stat_error)}")
                    # Continue with next request instead of failing
            
            # Calculate average response time
            if response_times:
                avg_response_time = sum(response_times) / len(response_times)
            
            # Calculate completion rate
            completion_rate = (completed_count / total_requests * 100) if total_requests > 0 else 0
            
            # Prepare trend data for charts
            trend_data = [{"date": date, "count": count} for date, count in daily_data.items()]
            
            report_data = {
                "lab_requests": lab_requests,
                "total_requests": total_requests,
                "status_counts": status_counts,
                "priority_counts": priority_counts,
                "test_type_counts": test_type_counts,
                "unread_count": unread_count,
                "completed_count": completed_count,
                "avg_response_time": avg_response_time,
                "completion_rate": completion_rate,
                "trend_data": trend_data
            }
            
            await conn.close()
            return report_data
            
        except Exception as e:
            last_exception = e
            retries += 1
            logger.error(f"Database error (attempt {retries}/{MAX_DB_RETRIES}): {str(e)}")
            
            if conn:
                try:
                    await conn.close()
                except:
                    pass
                    
            if retries < MAX_DB_RETRIES:
                await asyncio.sleep(DB_RETRY_DELAY * retries)  # Exponential backoff
            
    # If we get here, all retries failed
    logger.error(f"All database connection attempts failed: {str(last_exception)}")
    raise DatabaseException(f"Failed to fetch report data after {MAX_DB_RETRIES} attempts: {str(last_exception)}")

# -------- PDF Report Generation Functions --------

def create_hospital_letterhead(canvas, doc, title, report_type, date_range, report_id=None):
    """Create a professional hospital letterhead for the PDF"""
    try:
        # Save canvas state
        canvas.saveState()
        
        # Add logo
        # For a real implementation, store the logo in the static assets
        # Here we'll create a placeholder rectangle
        canvas.setFillColorRGB(0.32, 0.32, 0.87)  # Hospital brand blue color
        canvas.rect(0.5*inch, doc.height + 0.5*inch, 1*inch, 0.5*inch, fill=True)
        
        # Add hospital name and title
        canvas.setFont("Helvetica-Bold", 16)
        canvas.setFillColorRGB(0, 0, 0)
        canvas.drawString(1.7*inch, doc.height + 0.75*inch, "ARBAMINCH REFERRAL HOSPITAL")
        
        canvas.setFont("Helvetica", 12)
        canvas.drawString(1.7*inch, doc.height + 0.55*inch, "Laboratory Management System")
        
        # Add report title - with length check to avoid overflow
        safe_title = str(title)[:50]  # Limit title length
        canvas.setFont("Helvetica-Bold", 14)
        canvas.drawString(0.5*inch, doc.height + 0.2*inch, safe_title)
        
        # Add report metadata
        canvas.setFont("Helvetica", 10)
        canvas.drawString(0.5*inch, doc.height, f"Report Type: {report_type}")
        
        # Format date range safely
        date_range_str = f"Period: {date_range[0][:10]} to {date_range[1][:10]}"
        canvas.drawString(2.5*inch, doc.height, date_range_str)
        
        curr_date = datetime.now().strftime('%Y-%m-%d %H:%M')
        canvas.drawString(5.5*inch, doc.height, f"Generated: {curr_date}")
        
        # Add report ID if provided
        if report_id:
            safe_id = str(report_id)[:36]  # UUID is 36 chars max
            canvas.setFont("Helvetica", 8)
            canvas.drawString(0.5*inch, doc.height - 0.2*inch, f"Report ID: {safe_id}")
        
        # Add separator line
        canvas.setStrokeColorRGB(0.32, 0.32, 0.87)
        canvas.line(0.5*inch, doc.height - 0.3*inch, 7.5*inch, doc.height - 0.3*inch)
        
        # Restore canvas state
        canvas.restoreState()
    except Exception as e:
        logger.error(f"Error in create_hospital_letterhead: {str(e)}")
        # Continue without the letterhead rather than failing the whole report

def create_footer(canvas, doc, page_num, total_pages):
    """Create a professional footer for each page"""
    try:
        canvas.saveState()
        
        # Add page number
        canvas.setFont("Helvetica", 8)
        page_str = f"Page {page_num} of {total_pages}"
        canvas.drawString(4*inch, 0.25*inch, page_str)
        
        # Add footer text
        canvas.drawString(0.5*inch, 0.25*inch, "ADPPM - Laboratory Management System")
        
        # Add date and time
        curr_date = datetime.now().strftime('%Y-%m-%d')
        canvas.drawString(6*inch, 0.25*inch, curr_date)
        
        # Add separator line
        canvas.setStrokeColorRGB(0.32, 0.32, 0.87)
        canvas.line(0.5*inch, 0.5*inch, 7.5*inch, 0.5*inch)
        
        canvas.restoreState()
    except Exception as e:
        logger.error(f"Error in create_footer: {str(e)}")
        # Continue without the footer rather than failing the whole report

def create_pie_chart(data: Dict[str, int], title: str, width=400, height=200) -> Drawing:
    """Create a pie chart for the report"""
    if not data:
        # Return an empty drawing with text if no data
        drawing = Drawing(width, height)
        drawing.add(String(width/2, height/2, "No data available", 
                          fontSize=12, fontName="Helvetica", textAnchor="middle"))
        return drawing
    
    try:
        # Create drawing and pie chart
        drawing = Drawing(width, height)
        
        # Create pie chart
        pie = Pie()
        pie.x = 100
        pie.y = 25
        pie.width = 150
        pie.height = 150
        
        # Set data - ensure we have values
        values = list(data.values())
        if not values or all(v == 0 for v in values):
            # No values or all zeros
            drawing.add(String(width/2, height/2, "No data available", 
                              fontSize=12, fontName="Helvetica", textAnchor="middle"))
            return drawing
            
        pie.data = values
        pie.labels = list(data.keys())
        
        # Set colors - use a color scheme that works well for reports
        pie.slices.strokeWidth = 0.5
        
        # Standard colors for hospital reports
        standard_colors = [
            colors.cornflower, colors.cyan, colors.lavender,
            colors.lightgreen, colors.pink, colors.lightblue,
            colors.peachpuff, colors.lightcoral
        ]
        
        for i, _ in enumerate(data):
            if i < len(pie.slices):
                pie.slices[i].fillColor = standard_colors[i % len(standard_colors)]
        
        # Add pie chart to drawing
        drawing.add(pie)
        
        # Add legend
        legend = Legend()
        legend.x = 270
        legend.y = 70
        legend.dx = 8
        legend.dy = 8
        legend.fontName = 'Helvetica'
        legend.fontSize = 8
        legend.boxAnchor = 'w'
        legend.columnMaximum = 10
        legend.strokeWidth = 0
        legend.alignment = 'right'
        
        # Ensure legend color pairs match data length
        legend.colorNamePairs = [(standard_colors[i % len(standard_colors)], label) 
                                for i, label in enumerate(data.keys())]
        drawing.add(legend)
        
        # Add title
        drawing.add(String(width/2, height-10, str(title), 
                          fontSize=12, fontName="Helvetica-Bold", textAnchor="middle"))
        
        return drawing
    except Exception as e:
        logger.error(f"Error creating pie chart: {str(e)}")
        # Return an error message in the drawing instead of failing
        drawing = Drawing(width, height)
        drawing.add(String(width/2, height/2, "Chart generation error", 
                          fontSize=12, fontName="Helvetica", textAnchor="middle"))
        return drawing

def create_bar_chart(data: List[Dict[str, Any]], title: str, 
                     x_label: str, y_label: str, width=400, height=200) -> Drawing:
    """Create a bar chart for the report"""
    if not data:
        # Return an empty drawing with text if no data
        drawing = Drawing(width, height)
        drawing.add(String(width/2, height/2, "No data available", 
                         fontSize=12, fontName="Helvetica", textAnchor="middle"))
        return drawing
        
    try:
        # Create drawing
        drawing = Drawing(width, height)
        
        # Create bar chart
        chart = VerticalBarChart()
        chart.x = 50
        chart.y = 25
        chart.height = 150
        chart.width = 300
        
        # Validate data format
        if not all(isinstance(d, dict) for d in data) or not data[0]:
            drawing.add(String(width/2, height/2, "Invalid data format", 
                             fontSize=12, fontName="Helvetica", textAnchor="middle"))
            return drawing
            
        # Extract values safely
        values = []
        try:
            for d in data:
                values.append(list(d.values()))
            
            if not values[0]:
                raise ValueError("No values in data")
                
            chart.data = values
            chart.categoryAxis.categoryNames = list(data[0].keys())
        except (ValueError, KeyError, IndexError) as e:
            drawing.add(String(width/2, height/2, f"Data extraction error: {str(e)}", 
                             fontSize=12, fontName="Helvetica", textAnchor="middle"))
            return drawing
        
        # Set colors
        chart.bars[0].fillColor = colors.cornflower
        
        # Add grid and labels
        chart.valueAxis.labels.fontName = 'Helvetica'
        chart.valueAxis.labels.fontSize = 8
        chart.valueAxis.valueMin = 0
        
        # Safely calculate value step
        max_value = 0
        for series in chart.data:
            if series:
                series_max = max(series)
                if series_max > max_value:
                    max_value = series_max
        
        chart.valueAxis.valueStep = max(1, max_value // 5)
        chart.valueAxis.labelTextFormat = '%d'
        
        # Set axis labels correctly - don't try to set title attribute
        # chart.valueAxis has no title attribute
        
        chart.categoryAxis.labels.fontName = 'Helvetica'
        chart.categoryAxis.labels.fontSize = 8
        
        # Add chart to drawing
        drawing.add(chart)
        
        # Add title and labels as separate text elements
        drawing.add(String(width/2, height-10, str(title), 
                          fontSize=12, fontName="Helvetica-Bold", textAnchor="middle"))
        
        # Add y-axis label
        drawing.add(String(15, height/2, str(y_label), 
                          fontSize=10, fontName="Helvetica-Bold", textAnchor="middle",
                          angle=90))
        
        # Add x-axis label
        drawing.add(String(width/2, 10, str(x_label), 
                          fontSize=10, fontName="Helvetica-Bold", textAnchor="middle"))
        
        return drawing
    except Exception as e:
        logger.error(f"Error creating bar chart: {str(e)}")
        # Return an error message in the drawing instead of failing
        drawing = Drawing(width, height)
        drawing.add(String(width/2, height/2, "Chart generation error", 
                          fontSize=12, fontName="Helvetica", textAnchor="middle"))
        return drawing

def create_line_chart(data: List[Dict[str, Any]], title: str, width=400, height=200) -> Drawing:
    """Create a line chart for daily trends"""
    if not data:
        # Return an empty drawing with text if no data
        drawing = Drawing(width, height)
        drawing.add(String(width/2, height/2, "No data available", 
                         fontSize=12, fontName="Helvetica", textAnchor="middle"))
        return drawing
    
    try:
        # Create drawing
        drawing = Drawing(width, height)
        
        # Sort data by date
        try:
            sorted_data = sorted(data, key=lambda x: x.get("date", ""))
        except (KeyError, TypeError) as e:
            drawing.add(String(width/2, height/2, "Data sorting error", 
                             fontSize=12, fontName="Helvetica", textAnchor="middle"))
            return drawing
        
        # Create line chart
        chart = HorizontalLineChart()
        chart.x = 50
        chart.y = 25
        chart.height = 150
        chart.width = 300
        
        # Extract values and dates safely
        try:
            values = [d.get("count", 0) for d in sorted_data]
            dates = [str(d.get("date", "")) for d in sorted_data]
            
            if not values or all(v == 0 for v in values):
                drawing.add(String(width/2, height/2, "No trend data available", 
                                 fontSize=12, fontName="Helvetica", textAnchor="middle"))
                return drawing
        except Exception as e:
            drawing.add(String(width/2, height/2, "Data extraction error", 
                             fontSize=12, fontName="Helvetica", textAnchor="middle"))
            return drawing
        
        # Limit to at most 10 labels for readability
        display_dates = dates
        if len(dates) > 10:
            step = len(dates) // 10
            display_dates = dates[::step]
        
        chart.data = [values]
        
        # Set colors and style
        chart.lines[0].strokeColor = colors.cornflower
        chart.lines[0].strokeWidth = 2
        
        # DO NOT try to set the symbol directly - it causes errors
        # Instead, we'll draw markers manually after rendering
        
        # Add grid and labels
        chart.valueAxis.labels.fontName = 'Helvetica'
        chart.valueAxis.labels.fontSize = 8
        chart.valueAxis.valueMin = 0
        
        # Safely get max value for axis
        if values:
            max_value = max(values)
            if max_value > 0:
                chart.valueAxis.valueStep = max(1, max_value // 5)
                
        chart.valueAxis.labelTextFormat = '%d'
        
        # Don't set title attributes - add them as separate text elements instead
        
        chart.categoryAxis.labels.fontName = 'Helvetica'
        chart.categoryAxis.labels.fontSize = 8
        chart.categoryAxis.categoryNames = display_dates
        
        # Add chart to drawing
        drawing.add(chart)
        
        # Add title and labels as separate text elements
        drawing.add(String(width/2, height-10, str(title), 
                          fontSize=12, fontName="Helvetica-Bold", textAnchor="middle"))
        
        # Add y-axis label
        drawing.add(String(15, height/2, "Count", 
                          fontSize=10, fontName="Helvetica-Bold", textAnchor="middle",
                          angle=90))
        
        # Add x-axis label
        drawing.add(String(width/2, 10, "Date", 
                          fontSize=10, fontName="Helvetica-Bold", textAnchor="middle"))
        
        return drawing
    except Exception as e:
        logger.error(f"Error creating line chart: {str(e)}")
        # Return an error message in the drawing instead of failing
        drawing = Drawing(width, height)
        drawing.add(String(width/2, height/2, "Chart generation error", 
                          fontSize=12, fontName="Helvetica", textAnchor="middle"))
        return drawing

def create_summary_table(data: Dict[str, Any], styles) -> Table:
    """Create a summary table with key metrics"""
    try:
        summary_data = [
            ['Metric', 'Value'],
            ['Total Requests', data.get("total_requests", 0)],
            ['Completed Requests', data.get("completed_count", 0)],
            ['Unread Requests', data.get("unread_count", 0)]
        ]
        
        # Format completion rate safely
        try:
            completion_rate = f"{data.get('completion_rate', 0):.1f}%"
            summary_data.append(['Completion Rate', completion_rate])
        except (TypeError, ValueError):
            summary_data.append(['Completion Rate', 'N/A'])
        
        # Add average response time if available
        avg_response_time = data.get("avg_response_time")
        if avg_response_time is not None:
            try:
                avg_time_str = f"{avg_response_time:.2f} hours"
                summary_data.append(['Average Response Time', avg_time_str])
            except (TypeError, ValueError):
                summary_data.append(['Average Response Time', 'N/A'])
        
        table = Table(summary_data, colWidths=[2.5*inch, 1.5*inch])
        
        table_style = TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), colors.cornflower),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (1, 0), 6),
            ('BACKGROUND', (0, 1), (1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 1), (1, -1), 'Helvetica'),
        ])
        
        table.setStyle(table_style)
        return table
    except Exception as e:
        logger.error(f"Error creating summary table: {str(e)}")
        # Return a simple table with error message
        error_data = [
            ['Error', 'Could not generate summary table'],
            ['Details', str(e)]
        ]
        error_table = Table(error_data, colWidths=[2.5*inch, 1.5*inch])
        error_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ]))
        return error_table

def create_status_priority_tables(data: Dict[str, Any], styles) -> List[Table]:
    """Create tables for status and priority breakdowns"""
    try:
        # Status breakdown table
        status_counts = data.get("status_counts", {})
        status_data = [['Status', 'Count']]
        
        # Safely add status data
        for status, count in status_counts.items():
            if status:  # Only add if status is not None or empty
                status_data.append([str(status).title(), count])
        
        # If no status data, add placeholder
        if len(status_data) == 1:  # Only header row exists
            status_data.append(['No data', 0])
            
        status_table = Table(status_data, colWidths=[2*inch, 1*inch])
        
        status_style = TableStyle([
            ('BACKGROUND', (0, 0), (1, 0), colors.cornflower),
            ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (1, 0), 6),
            ('BACKGROUND', (0, 1), (1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 1), (1, -1), 'Helvetica'),
        ])
        
        status_table.setStyle(status_style)
        
        # Priority breakdown table
        priority_counts = data.get("priority_counts", {})
        priority_data = [['Priority', 'Count']]
        
        # Safely add priority data
        for priority, count in priority_counts.items():
            if priority:  # Only add if priority is not None or empty
                priority_data.append([str(priority).title(), count])
        
        # If no priority data, add placeholder
        if len(priority_data) == 1:  # Only header row exists
            priority_data.append(['No data', 0])
            
        priority_table = Table(priority_data, colWidths=[2*inch, 1*inch])
        priority_table.setStyle(status_style)  # Reuse the same style
        
        return [status_table, priority_table]
    except Exception as e:
        logger.error(f"Error creating status/priority tables: {str(e)}")
        # Return placeholder tables
        error_table = Table([['Error', 'Table generation failed']], colWidths=[2*inch, 1*inch])
        error_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ]))
        return [error_table, error_table]

def create_detailed_requests_table(data: Dict[str, Any], styles) -> Table:
    """Create a detailed table of lab requests"""
    try:
        # Header row with column titles
        table_data = [['ID', 'Patient', 'Test Type', 'Priority', 'Status', 'Date', 'Technician']]
        
        # Get lab requests safely
        lab_requests = data.get("lab_requests", [])
        
        if not lab_requests:
            table_data.append(['No data available', '', '', '', '', '', ''])
            
        else:
            # Add data rows
            for req in lab_requests:
                try:
                    # Extract ID safely
                    id_str = str(req.get("id", ""))
                    id_display = id_str[-8:] if len(id_str) >= 8 else id_str
                    
                    # Extract and format other fields
                    patient_name = req.get("patient_name", "")
                    
                    test_type = req.get("test_type", "")
                    if test_type:
                        test_type = test_type.replace('_', ' ').title()
                    
                    priority = req.get("priority", "")
                    if priority:
                        priority = priority.title()
                    
                    status = req.get("status", "")
                    if status:
                        status = status.title()
                    
                    # Format date safely
                    created_at = req.get("created_at")
                    date_str = ""
                    if created_at:
                        try:
                            date_str = created_at.strftime("%Y-%m-%d")
                        except (AttributeError, ValueError):
                            date_str = str(created_at)
                    
                    technician_name = req.get("technician_name", "")
                    
                    row = [
                        id_display,
                        patient_name,
                        test_type,
                        priority,
                        status,
                        date_str,
                        technician_name
                    ]
                    table_data.append(row)
                except Exception as row_error:
                    logger.warning(f"Error processing table row: {str(row_error)}")
                    # Add a placeholder row instead of failing
                    table_data.append(['Error', 'Error', 'Error', 'Error', 'Error', 'Error', 'Error'])
        
        # Create table with specific column widths
        table = Table(
            table_data, 
            colWidths=[0.8*inch, 1*inch, 1.4*inch, 0.8*inch, 0.8*inch, 1*inch, 1.2*inch],
            repeatRows=1  # Repeat header row on each page
        )
        
        # Define table style
        table_style = TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.cornflower),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 6),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('ALIGN', (0, 1), (0, -1), 'LEFT'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            # Alternating row colors for readability
            ('BACKGROUND', (0, 1), (-1, -1), colors.whitesmoke),
            ('BACKGROUND', (0, 2), (-1, 2), colors.white),
        ])
        
        # Add alternating row colors for better readability
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                table_style.add('BACKGROUND', (0, i), (-1, i), colors.white)
            else:
                table_style.add('BACKGROUND', (0, i), (-1, i), colors.lightgrey)
        
        table.setStyle(table_style)
        return table
    except Exception as e:
        logger.error(f"Error creating detailed requests table: {str(e)}")
        # Return a simple table with error message
        error_data = [
            ['Error', 'Could not generate detailed table'],
            ['Details', str(e)]
        ]
        error_table = Table(error_data, colWidths=[4*inch, 3*inch])
        error_table.setStyle(TableStyle([
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (1, 0), (1, -1), 'Helvetica'),
        ]))
        return error_table

class ReportCanvas(canvas.Canvas):
    """Custom canvas for PDF generation with page numbers"""
    def __init__(self, *args, **kwargs):
        # Extract and store custom parameters
        self._title = kwargs.pop('title', "")
        self._report_type = kwargs.pop('report_type', "")
        self._date_range = kwargs.pop('date_range', ("", ""))
        self._report_id = kwargs.pop('report_id', "")
        self.pages = []
        
        # Initialize parent class
        try:
            super().__init__(*args, **kwargs)
            # Set page dimensions based on the pagesize
            self.width, self.height = self._pagesize
        except Exception as e:
            logger.error(f"Error initializing ReportCanvas: {str(e)}")
            raise
    
    def showPage(self):
        """Override to save page info when page is complete"""
        try:
            self.pages.append(dict(self.__dict__))
            super().showPage()
        except Exception as e:
            logger.error(f"Error in ReportCanvas.showPage: {str(e)}")
            # Try to continue anyway
            super().showPage()
    
    def save(self):
        """Add page numbers and other info when saving the document"""
        try:
            page_count = len(self.pages)
            
            # Add metadata to each page
            for page in range(page_count):
                try:
                    # Do not call _setPageSize, it doesn't exist
                    self._startPage()
                    
                    # Add letterhead
                    create_hospital_letterhead(
                        self, self, self._title, self._report_type, 
                        self._date_range, self._report_id
                    )
                    
                    # Add footer with page number
                    create_footer(self, self, page + 1, page_count)
                    
                    # Restore state from saved pages
                    self.__dict__.update(self.pages[page])
                    
                    super().showPage()
                except Exception as page_error:
                    logger.error(f"Error processing page {page}: {str(page_error)}")
                    # Continue to next page
                    super().showPage()
            
            super().save()
        except Exception as e:
            logger.error(f"Error in ReportCanvas.save: {str(e)}")
            # Try basic save as fallback
            super().save()

async def generate_pdf_report(
    report_id: uuid.UUID,
    report_type: str,
    start_date: date,
    end_date: date,
    metrics: List[str]
):
    """Generate a professional PDF report"""
    temp_file = None
    conn = None
    
    try:
        logger.info(f"Starting PDF report generation for ID: {report_id}")
        
        # Import necessary modules - moved here for clarity
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import inch
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
        )
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.enums import TA_CENTER
        from reportlab.lib import colors
        
        # Create file path
        filename = f"report_{report_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        # Create upload directory if it doesn't exist
        try:
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        except (PermissionError, OSError) as e:
            logger.error(f"Failed to create upload directory: {str(e)}")
            # Use temporary directory as a fallback
            temp_dir = tempfile.gettempdir()
            logger.info(f"Using temporary directory instead: {temp_dir}")
            file_path = os.path.join(temp_dir, filename)
        else:
            file_path = os.path.join(settings.UPLOAD_DIR, filename)
            
        # Create a temporary file first to avoid partial writes
        temp_file = f"{file_path}.tmp"

        # Fetch report data
        report_data = await get_report_data(start_date, end_date)
        
        # Format date ranges for display
        if isinstance(start_date, datetime):
            start_date = start_date.date()
        if isinstance(end_date, datetime):
            end_date = end_date.date()
            
        date_range = (start_date.isoformat(), end_date.isoformat())
        doc_title = f"Laboratory Requests Report - {report_type.upper()}"

        # Setup document
        buffer = io.BytesIO()
        
        # Create document with error handling
        try:
            doc = SimpleDocTemplate(
                buffer,
                pagesize=A4,
                leftMargin=0.5 * inch,
                rightMargin=0.5 * inch,
                topMargin=1.5 * inch,
                bottomMargin=0.75 * inch,
            )
        except Exception as doc_error:
            logger.error(f"Error creating document: {str(doc_error)}")
            raise

        # Styles
        styles = getSampleStyleSheet()

        # Add custom styles with unique names to avoid conflict
        try:
            styles.add(ParagraphStyle(
                name='CustomTitle',
                parent=styles['Heading1'],
                fontSize=16,
                alignment=TA_CENTER,
                spaceAfter=16
            ))
            styles.add(ParagraphStyle(
                name='CustomHeading2',
                parent=styles['Heading2'],
                fontSize=14,
                spaceBefore=12,
                spaceAfter=6
            ))
            styles.add(ParagraphStyle(
                name='CustomHeading3',
                parent=styles['Heading3'],
                fontSize=12,
                spaceBefore=10,
                spaceAfter=4
            ))
            styles.add(ParagraphStyle(
                name='CustomNormal',
                parent=styles['Normal'],
                fontSize=10,
                spaceBefore=6,
                spaceAfter=6
            ))
        except Exception as style_error:
            logger.error(f"Error creating styles: {str(style_error)}")
            # Continue with default styles
            
        # Initialize elements list for the document
        elements = []

        # Add Executive Summary
        logger.debug("Adding executive summary section")
        elements.append(Paragraph("Executive Summary", styles['Heading2']))
        
        summary_text = (
            f"This report provides an analysis of laboratory requests from {start_date} to {end_date}. "
            f"During this period, {report_data['total_requests']} requests were processed with a "
            f"{report_data['completion_rate']:.1f}% completion rate."
        )
        elements.append(Paragraph(summary_text, styles['Normal']))
        elements.append(Spacer(1, 0.2 * inch))
        
        # Add summary table
        logger.debug("Adding summary table")
        try:
            elements.append(create_summary_table(report_data, styles))
        except Exception as table_error:
            logger.error(f"Error adding summary table: {str(table_error)}")
            elements.append(Paragraph("Error generating summary table", styles['Normal']))
            
        elements.append(Spacer(1, 0.2 * inch))

        # Status and Priority Analysis
        logger.debug("Adding status and priority section")
        elements.append(Paragraph("Status and Priority Analysis", styles['Heading2']))
        elements.append(Paragraph(
            "This section breaks down laboratory requests by their current status and priority levels.",
            styles['Normal']
        ))

        # Add status and priority tables
        try:
            status_priority_tables = create_status_priority_tables(report_data, styles)
            
            # Create a container table for the two tables
            table_container = Table(
                [[status_priority_tables[0], status_priority_tables[1]]],
                style=TableStyle([
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 10),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                ])
            )
            elements.append(table_container)
        except Exception as tables_error:
            logger.error(f"Error adding status/priority tables: {str(tables_error)}")
            elements.append(Paragraph("Error generating status and priority tables", styles['Normal']))
            
        elements.append(Spacer(1, 0.3 * inch))

        # Visualizations
        logger.debug("Adding visualizations section")
        elements.append(Paragraph("Visualizations", styles['Heading2']))

        # Add status distribution chart
        if report_data.get("status_counts"):
            logger.debug("Adding status chart")
            try:
                elements.append(create_pie_chart(report_data["status_counts"], "Status Distribution"))
                elements.append(Spacer(1, 0.2 * inch))
            except Exception as status_chart_error:
                logger.error(f"Error adding status chart: {str(status_chart_error)}")
                elements.append(Paragraph("Error generating status chart", styles['Normal']))
                elements.append(Spacer(1, 0.2 * inch))

        # Add priority distribution chart
        if report_data.get("priority_counts"):
            logger.debug("Adding priority chart")
            try:
                elements.append(create_pie_chart(report_data["priority_counts"], "Priority Distribution"))
                elements.append(Spacer(1, 0.2 * inch))
            except Exception as priority_chart_error:
                logger.error(f"Error adding priority chart: {str(priority_chart_error)}")
                elements.append(Paragraph("Error generating priority chart", styles['Normal']))
                elements.append(Spacer(1, 0.2 * inch))

        # Add trend data chart
        if report_data.get("trend_data"):
            logger.debug("Adding trend chart")
            try:
                line_chart = create_line_chart(report_data["trend_data"], "Daily Request Trend")
                elements.append(line_chart)
                elements.append(Spacer(1, 0.3 * inch))
            except Exception as chart_error:
                logger.error(f"Error adding trend chart: {str(chart_error)}")
                elements.append(Paragraph("Error generating trend chart", styles['Normal']))
                elements.append(Spacer(1, 0.3 * inch))

        # Test Type Analysis
        if report_data.get("test_type_counts"):
            logger.debug("Adding test type section")
            elements.append(Paragraph("Test Type Analysis", styles['Heading2']))
            elements.append(Paragraph(
                "This section analyzes the distribution of different types of laboratory tests requested.",
                styles['Normal']
            ))

            # Create test type table
            try:
                test_type_data = [['Test Type', 'Count']]
                for test_type, count in report_data["test_type_counts"].items():
                    if test_type:  # Only add if test_type is not None or empty
                        test_type_data.append([str(test_type).replace('_', ' ').title(), count])
                
                # Add a placeholder row if no data
                if len(test_type_data) == 1:
                    test_type_data.append(['No data available', 0])
                    
                test_type_table = Table(test_type_data, colWidths=[4 * inch, 1 * inch])
                test_type_table.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (1, 0), colors.cornflower),
                    ('TEXTCOLOR', (0, 0), (1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (1, 0), 'CENTER'),
                    ('FONTNAME', (0, 0), (1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (1, 0), 10),
                    ('BOTTOMPADDING', (0, 0), (1, 0), 6),
                    ('BACKGROUND', (0, 1), (1, -1), colors.white),
                    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                    ('ALIGN', (1, 1), (1, -1), 'RIGHT'),
                    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                    ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),
                    ('FONTNAME', (1, 1), (1, -1), 'Helvetica'),
                ]))
                elements.append(test_type_table)
            except Exception as test_type_error:
                logger.error(f"Error creating test type table: {str(test_type_error)}")
                elements.append(Paragraph("Error generating test type table", styles['Normal']))
                
            elements.append(Spacer(1, 0.3 * inch))

        # Detailed List - on a new page
        elements.append(PageBreak())
        logger.debug("Adding detailed requests section")
        elements.append(Paragraph("Detailed Request List", styles['Heading2']))
        
        # Add description text
        request_count = report_data.get("total_requests", 0)
        elements.append(Paragraph(
            f"This section provides a detailed list of all {request_count} laboratory requests during the reporting period.",
            styles['Normal']
        ))
        elements.append(Spacer(1, 0.2 * inch))
        
        # Add detailed requests table if we have data
        if report_data.get("lab_requests"):
            logger.debug("Adding detailed table")
            try:
                elements.append(create_detailed_requests_table(report_data, styles))
            except Exception as table_error:
                logger.error(f"Error creating detailed requests table: {str(table_error)}")
                elements.append(Paragraph(f"Error generating detailed table: {str(table_error)}", styles['Normal']))
        else:
            elements.append(Paragraph("No laboratory requests found for this period.", styles['Normal']))

        # Generate PDF with custom canvas
        logger.debug("Building PDF document")
        try:
            custom_canvas = ReportCanvas(
                buffer,
                title=doc_title,
                report_type=report_type,
                date_range=date_range,
                report_id=str(report_id)
            )
            doc.build(elements, canvasmaker=lambda *args, **kwargs: custom_canvas)
        except Exception as pdf_error:
            logger.error(f"Error building PDF: {str(pdf_error)}")
            # Try a simpler approach as fallback
            try:
                doc.build(elements)
            except Exception as fallback_error:
                logger.error(f"Fallback PDF generation also failed: {str(fallback_error)}")
                raise

        # Save PDF to temp file first
        logger.debug(f"Writing PDF to temporary file: {temp_file}")
        try:
            with open(temp_file, 'wb') as f:
                f.write(buffer.getvalue())
            
            # Move temp file to final destination
            os.replace(temp_file, file_path)
            logger.info(f"PDF saved to final location: {file_path}")
        except (IOError, OSError) as file_error:
            logger.error(f"Error saving PDF file: {str(file_error)}")
            raise

        # Update DB with file path
        logger.debug("Updating database with file path")
        conn = await get_connection()
        try:
            await conn.execute(
                "UPDATE lab_reports SET file_path = $1 WHERE id = $2",
                file_path, str(report_id)
            )
        except Exception as db_error:
            logger.error(f"Database error updating file path: {str(db_error)}")
            # Don't raise here - the file was still generated
        finally:
            if conn:
                await conn.close()

        return file_path

    except Exception as e:
        logger.error(f"Error generating PDF report: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Clean up temp file if it exists
        if temp_file and os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass
        
        # Update the database with the error state if possible
        try:
            if not conn:
                conn = await get_connection()
                
            error_message = f"error_{str(e)[:100]}"  # Truncate long error messages
            await conn.execute(
                "UPDATE lab_reports SET file_path = $1 WHERE id = $2",
                error_message, str(report_id)
            )
        except Exception as update_error:
            logger.error(f"Failed to update error status: {str(update_error)}")
        finally:
            if conn:
                await conn.close()
                
        raise

# -------- TXT Report Generation Functions --------

def draw_ascii_box(title: str, width: int = 80) -> List[str]:
    """Draw an ASCII box with a title"""
    try:
        lines = []
        lines.append('┌' + '─' * (width - 2) + '┐')
        
        # Add title if provided
        if title:
            # Handle title that's too long
            safe_title = str(title)
            if len(safe_title) > width - 8:
                safe_title = safe_title[:width - 11] + "..."
                
            padding = (width - len(safe_title) - 4) // 2
            title_line = '│ ' + ' ' * padding + safe_title + ' ' * (width - len(safe_title) - padding - 4) + ' │'
            lines.append(title_line)
            lines.append('├' + '─' * (width - 2) + '┤')
        
        return lines
    except Exception as e:
        logger.error(f"Error in draw_ascii_box: {str(e)}")
        # Return a simpler box as fallback
        return [
            '+' + '-' * (width - 2) + '+',
            '|' + ' ' * (width - 2) + '|',
            '+' + '-' * (width - 2) + '+'
        ]

def close_ascii_box(width: int = 80) -> str:
    """Close an ASCII box"""
    try:
        return '└' + '─' * (width - 2) + '┘'
    except Exception as e:
        logger.error(f"Error in close_ascii_box: {str(e)}")
        return '+' + '-' * (width - 2) + '+'

def format_ascii_table(headers: List[str], data: List[List[str]], column_widths: List[int] = None) -> List[str]:
    """Format data as an ASCII table"""
    try:
        lines = []
        
        # Ensure headers and data are strings
        safe_headers = [str(h) for h in headers]
        safe_data = []
        for row in data:
            safe_data.append([str(item) for item in row])
        
        # Calculate column widths if not provided
        if not column_widths:
            column_widths = []
            for i in range(len(safe_headers)):
                max_width = len(safe_headers[i])
                for row in safe_data:
                    if i < len(row):
                        max_width = max(max_width, len(row[i]))
                column_widths.append(max_width + 2)  # Add padding
        
        # Limit column widths to reasonable sizes
        column_widths = [min(w, 40) for w in column_widths]  # Cap at 40 chars per column
        
        # Draw top border
        top_border = '┌'
        for width in column_widths:
            top_border += '─' * width + '┬'
        top_border = top_border[:-1] + '┐'  # Replace last ┬ with ┐
        lines.append(top_border)
        
        # Draw header row
        header_row = '│'
        for i, header in enumerate(safe_headers):
            if i < len(column_widths):
                # Truncate header if too long
                if len(header) > column_widths[i] - 2:
                    header = header[:column_widths[i] - 5] + "..."
                header_row += header.ljust(column_widths[i]) + '│'
        lines.append(header_row)
        
        # Draw separator after header
        separator = '├'
        for width in column_widths:
            separator += '─' * width + '┼'
        separator = separator[:-1] + '┤'  # Replace last ┼ with ┤
        lines.append(separator)
        
        # Draw data rows
        for row in safe_data:
            data_row = '│'
            for i, item in enumerate(row):
                if i < len(column_widths):
                    # Truncate data if too long
                    if len(item) > column_widths[i] - 2:
                        item = item[:column_widths[i] - 5] + "..."
                    data_row += item.ljust(column_widths[i]) + '│'
            lines.append(data_row)
        
        # Draw bottom border
        bottom_border = '└'
        for width in column_widths:
            bottom_border += '─' * width + '┴'
        bottom_border = bottom_border[:-1] + '┘'  # Replace last ┴ with ┘
        lines.append(bottom_border)
        
        return lines
    except Exception as e:
        logger.error(f"Error in format_ascii_table: {str(e)}")
        # Return a simple error message
        return [
            "+------------------+",
            "| Table generation |",
            "| error occurred   |",
            "+------------------+"
        ]

async def generate_txt_report(
    report_id: uuid.UUID,
    report_type: str,
    start_date: date,
    end_date: date,
    metrics: List[str]
):
    """Generate a well-formatted TXT report with ASCII art"""
    temp_file = None
    conn = None
    
    try:
        logger.info(f"Starting TXT report generation for ID: {report_id}")
        
        # Create file path
        filename = f"report_{report_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        
        # Create upload directory if it doesn't exist
        try:
            os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        except (PermissionError, OSError) as e:
            logger.error(f"Failed to create upload directory: {str(e)}")
            # Use temporary directory as a fallback
            temp_dir = tempfile.gettempdir()
            logger.info(f"Using temporary directory instead: {temp_dir}")
            file_path = os.path.join(temp_dir, filename)
        else:
            file_path = os.path.join(settings.UPLOAD_DIR, filename)
            
        # Create a temporary file first to avoid partial writes
        temp_file = f"{file_path}.tmp"
        
        # Get report data with a fresh connection
        report_data = await get_report_data(start_date, end_date)
        
        # Format dates
        if isinstance(start_date, datetime):
            start_date = start_date.date()
        if isinstance(end_date, datetime):
            end_date = end_date.date()
        
        # Set report width
        width = 100
        
        # Create report content
        lines = []
        
        # Add report header
        lines.append('=' * width)
        title = f"ARBAMINCH REFERRAL HOSPITAL - LABORATORY REPORT"
        lines.append(title.center(width))
        subtitle = f"Report Type: {report_type.upper()} - Period: {start_date} to {end_date}"
        lines.append(subtitle.center(width))
        lines.append('=' * width)
        lines.append('')
        
        # Add generation info
        lines.append(f"Report ID: {report_id}")
        lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"Total Requests: {report_data.get('total_requests', 0)}")
        lines.append('')
        
        # Add executive summary
        lines.extend(draw_ascii_box("EXECUTIVE SUMMARY", width))
        lines.append('│ This report provides an analysis of laboratory requests for the specified period.  │')
        lines.append('│                                                                                    │')
        
        # Format key metrics safely
        try:
            completion_rate = f"{report_data.get('completion_rate', 0):.1f}%"
        except (TypeError, ValueError):
            completion_rate = "N/A"
            
        try:
            avg_response_time = report_data.get('avg_response_time')
            avg_time = f"{avg_response_time:.2f} hours" if avg_response_time is not None else "N/A"
        except (TypeError, ValueError):
            avg_time = "N/A"
        
        # Add metrics with proper padding
        total_requests_line = f"│  ✦ Total Requests: {report_data.get('total_requests', 0):<5}"
        lines.append(total_requests_line + ' ' * (width - len(total_requests_line) - 1) + '│')
        
        completed_line = f"│  ✦ Completed: {report_data.get('completed_count', 0):<5}"
        lines.append(completed_line + ' ' * (width - len(completed_line) - 1) + '│')
        
        unread_line = f"│  ✦ Unread: {report_data.get('unread_count', 0):<5}"
        lines.append(unread_line + ' ' * (width - len(unread_line) - 1) + '│')
        
        completion_line = f"│  ✦ Completion Rate: {completion_rate:<6}"
        lines.append(completion_line + ' ' * (width - len(completion_line) - 1) + '│')
        
        avg_time_line = f"│  ✦ Average Response Time: {avg_time:<12}"
        lines.append(avg_time_line + ' ' * (width - len(avg_time_line) - 1) + '│')
        
        lines.append(close_ascii_box(width))
        lines.append('')
        
        # Add status breakdown section if we have status data
        status_counts = report_data.get("status_counts", {})
        if status_counts:
            lines.extend(draw_ascii_box("STATUS BREAKDOWN", width))
            
            status_headers = ["Status", "Count", "Percentage"]
            status_data = []
            
            total_requests = report_data.get("total_requests", 0)
            for status, count in status_counts.items():
                try:
                    if total_requests > 0:
                        percentage = (count / total_requests * 100)
                        percentage_str = f"{percentage:.1f}%"
                    else:
                        percentage_str = "0.0%"
                    
                    status_data.append([str(status).title(), count, percentage_str])
                except (TypeError, ValueError) as stat_error:
                    logger.warning(f"Error calculating status percentage: {str(stat_error)}")
                    status_data.append([str(status).title(), count, "Error"])
            
            # Sort status data for better readability
            try:
                status_data.sort(key=lambda x: x[1], reverse=True)
            except Exception as sort_error:
                logger.warning(f"Error sorting status data: {str(sort_error)}")
            
            # Add status table
            status_table = format_ascii_table(status_headers, status_data, [20, 10, 15])
            for line in status_table:
                padding = (width - len(line)) // 2
                table_line = '│' + ' ' * padding + line + ' ' * (width - len(line) - padding - 2) + '│'
                lines.append(table_line)
            
            lines.append(close_ascii_box(width))
            lines.append('')
        
        # Add priority breakdown section if we have priority data
        priority_counts = report_data.get("priority_counts", {})
        if priority_counts:
            lines.extend(draw_ascii_box("PRIORITY BREAKDOWN", width))
            
            priority_headers = ["Priority", "Count", "Percentage"]
            priority_data = []
            
            total_requests = report_data.get("total_requests", 0)
            for priority, count in priority_counts.items():
                try:
                    if total_requests > 0:
                        percentage = (count / total_requests * 100)
                        percentage_str = f"{percentage:.1f}%"
                    else:
                        percentage_str = "0.0%"
                    
                    priority_data.append([str(priority).title(), count, percentage_str])
                except (TypeError, ValueError) as prio_error:
                    logger.warning(f"Error calculating priority percentage: {str(prio_error)}")
                    priority_data.append([str(priority).title(), count, "Error"])
            
            # Sort priority data for better readability
            try:
                priority_data.sort(key=lambda x: x[1], reverse=True)
            except Exception as sort_error:
                logger.warning(f"Error sorting priority data: {str(sort_error)}")
            
            # Add priority table
            priority_table = format_ascii_table(priority_headers, priority_data, [20, 10, 15])
            for line in priority_table:
                padding = (width - len(line)) // 2
                table_line = '│' + ' ' * padding + line + ' ' * (width - len(line) - padding - 2) + '│'
                lines.append(table_line)
            
            lines.append(close_ascii_box(width))
            lines.append('')
        
        # Add test type breakdown section if we have test type data
        test_type_counts = report_data.get("test_type_counts", {})
        if test_type_counts:
            lines.extend(draw_ascii_box("TEST TYPE BREAKDOWN", width))
            
            test_type_headers = ["Test Type", "Count", "Percentage"]
            test_type_data = []
            
            total_requests = report_data.get("total_requests", 0)
            for test_type, count in test_type_counts.items():
                try:
                    if total_requests > 0:
                        percentage = (count / total_requests * 100)
                        percentage_str = f"{percentage:.1f}%"
                    else:
                        percentage_str = "0.0%"
                    
                    formatted_type = str(test_type).replace('_', ' ').title()
                    test_type_data.append([formatted_type, count, percentage_str])
                except (TypeError, ValueError) as type_error:
                    logger.warning(f"Error calculating test type percentage: {str(type_error)}")
                    formatted_type = str(test_type).replace('_', ' ').title()
                    test_type_data.append([formatted_type, count, "Error"])
            
            # Sort test type data for better readability
            try:
                test_type_data.sort(key=lambda x: x[1], reverse=True)
            except Exception as sort_error:
                logger.warning(f"Error sorting test type data: {str(sort_error)}")
            
            # Add test type table
            test_type_table = format_ascii_table(test_type_headers, test_type_data, [30, 10, 15])
            for line in test_type_table:
                padding = (width - len(line)) // 2
                table_line = '│' + ' ' * padding + line + ' ' * (width - len(line) - padding - 2) + '│'
                lines.append(table_line)
            
            lines.append(close_ascii_box(width))
            lines.append('')
        
        # Add daily trend section if we have trend data
        trend_data = report_data.get("trend_data", [])
        if trend_data:
            try:
                lines.extend(draw_ascii_box("DAILY REQUEST TREND", width))
                
                # Sort trend data by date
                sorted_trend = sorted(trend_data, key=lambda x: x.get("date", ""))
                
                # Find max count for scaling, with a fallback to prevent division by zero
                try:
                    max_count = max(item.get("count", 0) for item in sorted_trend)
                    max_count = max(max_count, 1)  # Ensure at least 1 to prevent division by zero
                    scale_factor = 40 / max_count
                except (ValueError, ZeroDivisionError):
                    max_count = 1
                    scale_factor = 1
                
                # Add a simple ASCII chart
                for item in sorted_trend:
                    try:
                        date_str = str(item.get("date", "Unknown"))
                        count = item.get("count", 0)
                        
                        # Calculate bar length
                        bar_length = max(0, int(count * scale_factor))
                        bar = '█' * bar_length
                        
                        # Format line with date, count, and bar
                        chart_line = f"│ {date_str} | {count:3d} | {bar}"
                        lines.append(chart_line + ' ' * (width - len(chart_line) - 1) + '│')
                    except Exception as item_error:
                        logger.warning(f"Error processing trend item: {str(item_error)}")
                        lines.append(f"│ Error processing trend data" + ' ' * (width - 31) + '│')
                
                lines.append(close_ascii_box(width))
                lines.append('')
            except Exception as trend_error:
                logger.error(f"Error generating trend visualization: {str(trend_error)}")
                # Skip this section if there's an error
        
        # Add detailed lab requests section if we have requests
        lab_requests = report_data.get("lab_requests", [])
        if lab_requests:
            lines.extend(draw_ascii_box("DETAILED LAB REQUESTS", width))
            
            # Add a header line explaining the data
            request_count = len(lab_requests)
            detail_header = f"│ Showing details for {request_count} laboratory requests:"
            lines.append(detail_header + ' ' * (width - len(detail_header) - 1) + '│')
            lines.append('│' + ' ' * (width - 2) + '│')
            
            # Define headers and column widths for the table
            request_headers = ["ID", "Patient", "Test Type", "Priority", "Status", "Requested At", "Technician"]
            column_widths = [10, 15, 20, 10, 12, 12, 15]
            
            # Start the table
            request_table_header = format_ascii_table(request_headers, [], column_widths)[0:3]  # Get just the header part
            for line in request_table_header:
                padding = (width - len(line)) // 2
                header_line = '│' + ' ' * padding + line + ' ' * (width - len(line) - padding - 2) + '│'
                lines.append(header_line)
            
            # Add data rows
            for req in lab_requests:
                try:
                    # Extract ID safely
                    id_str = str(req.get("id", "Unknown"))
                    id_display = id_str[-8:] if len(id_str) >= 8 else id_str
                    
                    # Extract other fields safely
                    patient_name = str(req.get("patient_name", ""))
                    
                    test_type = str(req.get("test_type", ""))
                    if test_type:
                        test_type = test_type.replace('_', ' ').title()
                    
                    priority = str(req.get("priority", ""))
                    if priority:
                        priority = priority.title()
                    
                    status = str(req.get("status", ""))
                    if status:
                        status = status.title()
                    
                    # Format date safely
                    created_at = req.get("created_at")
                    date_str = ""
                    if created_at:
                        try:
                            date_str = created_at.strftime("%Y-%m-%d")
                        except (AttributeError, ValueError):
                            date_str = str(created_at)
                    
                    technician_name = str(req.get("technician_name", ""))
                    
                    row = [
                        id_display,
                        patient_name,
                        test_type,
                        priority,
                        status,
                        date_str,
                        technician_name
                    ]
                    
                    # Format data row as a table row
                    data_row = '│'
                    for i, item in enumerate(row):
                        if i < len(column_widths):
                            # Truncate if too long
                            if len(item) > column_widths[i] - 2:
                                item = item[:column_widths[i] - 5] + "..."
                            data_row += item.ljust(column_widths[i]) + '│'
                    
                    # Add to lines with padding
                    padding = (width - len(data_row)) // 2
                    row_line = '│' + ' ' * padding + data_row[1:-1] + ' ' * (width - len(data_row) - padding - 2 + 2) + '│'
                    lines.append(row_line)
                except Exception as row_error:
                    logger.warning(f"Error processing request row: {str(row_error)}")
                    error_line = f"│ Error processing request data"
                    lines.append(error_line + ' ' * (width - len(error_line) - 1) + '│')
            
            # Close the table
            table_footer = format_ascii_table([], [], column_widths)[-1:]  # Get just the footer part
            for line in table_footer:
                padding = (width - len(line)) // 2
                footer_line = '│' + ' ' * padding + line + ' ' * (width - len(line) - padding - 2) + '│'
                lines.append(footer_line)
            
            lines.append(close_ascii_box(width))
            lines.append('')
        else:
            lines.extend(draw_ascii_box("DETAILED LAB REQUESTS", width))
            lines.append('│ No laboratory requests found for this period.                                    │')
            lines.append(close_ascii_box(width))
            lines.append('')
        
        # Add footer
        lines.append('-' * width)
        lines.append(f"End of Report - ADPPM Laboratory Management System - {datetime.now().strftime('%Y-%m-%d')}")
        lines.append('-' * width)
        
        # Write content to file - use temp file first
        logger.debug(f"Writing TXT to temporary file: {temp_file}")
        try:
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            
            # Move temp file to final destination
            os.replace(temp_file, file_path)
            logger.info(f"TXT saved to final location: {file_path}")
        except Exception as file_error:
            logger.error(f"Error writing TXT file: {str(file_error)}")
            raise
        
        # Update the lab_reports table with the file path
        logger.debug("Updating database with file path")
        conn = await get_connection()
        try:
            update_query = "UPDATE lab_reports SET file_path = $1 WHERE id = $2"
            await conn.execute(update_query, file_path, str(report_id))
        except Exception as db_error:
            logger.error(f"Database error updating file path: {str(db_error)}")
            # Don't raise - the file was still generated
        finally:
            if conn:
                await conn.close()
        
        return file_path
    except Exception as e:
        logger.error(f"Error generating TXT report: {str(e)}")
        logger.error(traceback.format_exc())
        
        # Clean up temp file if it exists
        if temp_file and os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass
        
        # Update the database with the error state if possible
        try:
            if not conn:
                conn = await get_connection()
                
            error_message = f"error_{str(e)[:100]}"  # Truncate long error messages
            await conn.execute(
                "UPDATE lab_reports SET file_path = $1 WHERE id = $2",
                error_message, str(report_id)
            )
        except Exception as update_error:
            logger.error(f"Failed to update error status: {str(update_error)}")
        finally:
            if conn:
                await conn.close()
                
        raise

# -------- Report Generation Endpoint --------

@router.post("/generate", response_model=ReportResponse)
async def generate_report(
    report_data: ReportGenerateRequest,
    background_tasks: BackgroundTasks,
    labtechnician_id: Optional[uuid.UUID] = Query(None, description="Lab Technician ID from frontend"),
):
    """
    Generate a professional report for lab requests with various metrics.
    Supports PDF and TXT formats.
    """
    conn = None
    
    try:
        # Validate report parameters
        if report_data.report_type not in ["daily", "weekly", "monthly", "custom"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid report type. Must be one of: daily, weekly, monthly, custom"
            )
        
        if report_data.format not in ["pdf", "txt"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid format. Must be one of: pdf, txt"
            )
        
        # Determine date range based on report type
        end_date = date.today()
        
        if report_data.report_type == "daily":
            start_date = end_date
        elif report_data.report_type == "weekly":
            start_date = end_date - timedelta(days=7)
        elif report_data.report_type == "monthly":
            start_date = end_date - timedelta(days=30)
        else:  # custom
            if not report_data.start_date or not report_data.end_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Custom reports require both start_date and end_date"
                )
            
            # Handle datetime objects correctly
            start_date = report_data.start_date
            if isinstance(start_date, datetime):
                start_date = start_date.date()
            
            end_date = report_data.end_date
            if isinstance(end_date, datetime):
                end_date = end_date.date()
            
            # Validate date range
            if start_date > end_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Start date cannot be after end date"
                )
            
            # Limit range to prevent resource exhaustion
            if (end_date - start_date).days > 366:  # 1 year plus leap day
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Date range cannot exceed 1 year"
                )
        
        # Create report record in database
        report_id = uuid.uuid4()
        temp_path = f"generating_{report_id}"
        
        # Use retry pattern for database operations
        retries = 0
        while retries < MAX_DB_RETRIES:
            try:
                conn = await get_connection()
                
                report_query = """
                    INSERT INTO lab_reports (
                        id, report_type, report_format, date_range_start,
                        date_range_end, file_path
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id
                """
                
                await conn.execute(
                    report_query,
                    str(report_id),
                    report_data.report_type,
                    report_data.format,
                    start_date,
                    end_date,
                    temp_path
                )
                
                await conn.close()
                conn = None
                break
            except Exception as db_error:
                retries += 1
                logger.error(f"Database error (attempt {retries}/{MAX_DB_RETRIES}): {str(db_error)}")
                
                if conn:
                    try:
                        await conn.close()
                        conn = None
                    except:
                        pass
                        
                if retries < MAX_DB_RETRIES:
                    await asyncio.sleep(DB_RETRY_DELAY * retries)  # Exponential backoff
                else:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Database error: {str(db_error)}"
                    )
        
        # Generate report in background task based on format
        if report_data.format == "pdf":
            background_tasks.add_task(
                generate_pdf_report,
                report_id,
                report_data.report_type,
                start_date,
                end_date,
                report_data.include_metrics
            )
        elif report_data.format == "txt":
            background_tasks.add_task(
                generate_txt_report,
                report_id,
                report_data.report_type,
                start_date,
                end_date,
                report_data.include_metrics
            )
        
        # Generate download URL
        report_url = f"/api/reports/{report_id}/download"
        
        return {
            "success": True,
            "report_id": report_id,
            "report_url": report_url,
            "report_type": report_data.report_type,
            "format": report_data.format,
            "generated_at": datetime.now()
        }
    except HTTPException:
        # Re-raise HTTP exceptions directly
        raise
    except Exception as e:
        logger.error(f"Error generating report: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to initiate report generation: {str(e)}"
        )
    finally:
        # Ensure connection is closed
        if conn:
            try:
                await conn.close()
            except:
                pass

@router.get("/{report_id}/download")
async def download_report(
    report_id: uuid.UUID = Path(...),
    labtechnician_id: Optional[uuid.UUID] = Query(None, description="Lab Technician ID from frontend"),
):
    """
    Download a generated report (PDF or TXT format).
    """
    conn = None
    
    try:
        # Validate report_id format
        try:
            str(report_id)  # Ensure UUID is valid
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid report ID format"
            )
        
        # Retry pattern for database operations
        retries = 0
        report = None
        
        while retries < MAX_DB_RETRIES:
            try:
                conn = await get_connection()
                
                # Check if report exists
                query = """
                    SELECT * FROM lab_reports
                    WHERE id = $1 AND is_deleted = FALSE
                """
                
                row = await conn.fetchrow(query, str(report_id))
                
                if row:
                    report = dict(row)
                    
                await conn.close()
                conn = None
                break
            except Exception as db_error:
                retries += 1
                logger.error(f"Database error (attempt {retries}/{MAX_DB_RETRIES}): {str(db_error)}")
                
                if conn:
                    try:
                        await conn.close()
                        conn = None
                    except:
                        pass
                
                if retries < MAX_DB_RETRIES:
                    await asyncio.sleep(DB_RETRY_DELAY * retries)
                else:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Database error: {str(db_error)}"
                    )
        
        if not report:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Report with ID {report_id} not found"
            )
        
        # Check if report has been generated
        if not report["file_path"] or report["file_path"].startswith("generating_"):
            return JSONResponse(
                status_code=status.HTTP_202_ACCEPTED,
                content={
                    "success": False,
                    "message": "Report is still being generated. Please try again later.",
                    "status": "generating"
                }
            )
        
        # Check if there was an error during generation
        if report["file_path"].startswith("error_"):
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "success": False,
                    "message": f"Error generating report: {report['file_path'][6:]}",
                    "status": "error"
                }
            )
        
        # Check if file exists
        if not os.path.exists(report["file_path"]):
            return JSONResponse(
                status_code=status.HTTP_404_NOT_FOUND,
                content={
                    "success": False,
                    "message": "Report file not found. It may have been deleted.",
                    "status": "missing"
                }
            )
        
        # Determine filename for download
        filename = os.path.basename(report["file_path"])
        
        # Set appropriate media type based on format
        if report["report_format"] == "pdf":
            media_type = "application/pdf"
        elif report["report_format"] == "txt":
            media_type = "text/plain"
        else:
            media_type = "application/octet-stream"
        
        # Return file with error handling
        try:
            return FileResponse(
                path=report["file_path"],
                filename=filename,
                media_type=media_type
            )
        except (IOError, OSError) as file_error:
            logger.error(f"Error reading file: {str(file_error)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error reading report file: {str(file_error)}"
            )
    except HTTPException:
        # Re-raise HTTP exceptions directly
        raise
    except Exception as e:
        logger.error(f"Error downloading report: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download report: {str(e)}"
        )
    finally:
        # Ensure connection is closed
        if conn:
            try:
                await conn.close()
            except:
                pass

@router.get("/", response_model=Dict[str, Any])
async def list_reports(
    report_type: Optional[str] = Query(None, description="Filter by report type"),
    from_date: Optional[date] = Query(None, description="Filter by generation date (from)"),
    to_date: Optional[date] = Query(None, description="Filter by generation date (to)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    labtechnician_id: Optional[uuid.UUID] = Query(None, description="Lab Technician ID from frontend"),
):
    """
    List all generated reports with pagination and filtering.
    """
    conn = None
    
    try:
        # Validate parameters
        if page < 1:
            page = 1
        
        if page_size < 1:
            page_size = 1
        elif page_size > 100:
            page_size = 100
        
        # Build query
        query_parts = ["""
            SELECT * FROM lab_reports
            WHERE is_deleted = FALSE
        """]
        
        params = []
        param_index = 1
        
        # Add filters
        if report_type:
            query_parts.append(f"AND report_type = ${param_index}")
            params.append(report_type)
            param_index += 1
        
        if from_date:
            query_parts.append(f"AND DATE(created_at) >= ${param_index}")
            params.append(from_date)
            param_index += 1
        
        if to_date:
            query_parts.append(f"AND DATE(created_at) <= ${param_index}")
            params.append(to_date)
            param_index += 1
        
        # Retry pattern for database operations
        retries = 0
        rows = []
        total = 0
        
        while retries < MAX_DB_RETRIES:
            try:
                conn = await get_connection()
                
                # Get total count
                count_query = f"SELECT COUNT(*) FROM ({' '.join(query_parts)}) as filtered_reports"
                total = await conn.fetchval(count_query, *params)
                
                # Add ordering and pagination
                query_parts.append("ORDER BY created_at DESC")
                query_parts.append(f"LIMIT ${param_index} OFFSET ${param_index + 1}")
                
                # Calculate offset safely
                offset = max(0, (page - 1) * page_size)
                params.extend([page_size, offset])
                
                # Execute main query
                rows = await conn.fetch(' '.join(query_parts), *params)
                
                await conn.close()
                conn = None
                break
            except Exception as db_error:
                retries += 1
                logger.error(f"Database error (attempt {retries}/{MAX_DB_RETRIES}): {str(db_error)}")
                
                if conn:
                    try:
                        await conn.close()
                        conn = None
                    except:
                        pass
                
                if retries < MAX_DB_RETRIES:
                    await asyncio.sleep(DB_RETRY_DELAY * retries)
                else:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Database error: {str(db_error)}"
                    )
        
        # Process results
        reports = []
        
        for row in rows:
            try:
                report = dict(row)
                
                # Determine status
                if not report.get("file_path"):
                    report["status"] = "unknown"
                elif report["file_path"].startswith("generating_"):
                    report["status"] = "generating"
                elif report["file_path"].startswith("error_"):
                    report["status"] = "error"
                    report["error_message"] = report["file_path"][6:]  # Extract error message
                elif os.path.exists(report["file_path"]):
                    report["status"] = "ready"
                else:
                    report["status"] = "missing"
                
                # Add download URL
                report["download_url"] = f"/api/reports/{report['id']}/download"
                
                # Ensure created_at is serializable
                if "created_at" in report and report["created_at"]:
                    report["created_at"] = report["created_at"].isoformat()
                
                # Ensure date range is serializable
                if "date_range_start" in report and report["date_range_start"]:
                    report["date_range_start"] = report["date_range_start"].isoformat()
                if "date_range_end" in report and report["date_range_end"]:
                    report["date_range_end"] = report["date_range_end"].isoformat()
                
                reports.append(report)
            except Exception as row_error:
                logger.warning(f"Error processing report row: {str(row_error)}")
                # Skip this row instead of failing
        
        # Calculate total pages (minimum 1)
        total_pages = max(1, ceil(total / page_size) if total > 0 else 1)
        
        # Ensure current page is within bounds
        current_page = min(page, total_pages)
        
        return {
            "success": True,
            "reports": reports,
            "pagination": {
                "total": total,
                "page": current_page,
                "page_size": page_size,
                "total_pages": total_pages
            }
        }
    except HTTPException:
        # Re-raise HTTP exceptions directly
        raise
    except Exception as e:
        logger.error(f"Error listing reports: {str(e)}")
        logger.error(traceback.format_exc())
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list reports: {str(e)}"
        )
    finally:
        # Ensure connection is closed
        if conn:
            try:
                await conn.close()
            except:
                pass