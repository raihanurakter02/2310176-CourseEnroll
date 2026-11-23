"""
build_full_report_docx.py
Builds the complete, final, publication-grade Word (.docx) project report for:
Course: CSE309 Web Application & Internet (Autumn 2026)
University: Independent University, Bangladesh (IUB)
Instructor: Sayef Reyadh
Student: Raihanur Akter (ID: 2310176)
Project: CourseEnroll — Secure Multi-User University Course Registration & Academic Administration Platform
"""

import os
import re
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, hex_color):
    """Set the background color of a table cell."""
    shading_elm = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{hex_color}"/>')
    cell._tc.get_or_add_tcPr().append(shading_elm)

def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
    """Set padding/margins for a table cell in dxa (1 pt = 20 dxa)."""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'<w:top w:w="{top}" w:type="dxa"/>'
        f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'<w:left w:w="{left}" w:type="dxa"/>'
        f'<w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    tcPr.append(tcMar)

def set_table_borders(table, color="CBD5E1", sz="4", val="single"):
    """Apply clean, subtle borders to a table."""
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:left w:val="none"/>'
        f'<w:bottom w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:right w:val="none"/>'
        f'<w:insideH w:val="{val}" w:sz="{sz}" w:space="0" w:color="{color}"/>'
        f'<w:insideV w:val="none"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)

def setup_page_layout(doc):
    """Configure page dimensions, margins, header, and footer."""
    section = doc.sections[0]
    section.top_margin = Inches(1.0)
    section.bottom_margin = Inches(1.0)
    section.left_margin = Inches(1.0)
    section.right_margin = Inches(1.0)
    section.page_width = Inches(8.5)
    section.page_height = Inches(11.0)
    
    # Running Header
    header = section.header
    p_hdr = header.paragraphs[0]
    p_hdr.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r_hdr = p_hdr.add_run("CSE309 Final Project Report — CourseEnroll (ID: 2310176)")
    r_hdr.font.name = "Arial"
    r_hdr.font.size = Pt(8.5)
    r_hdr.font.color.rgb = RGBColor(148, 163, 184)
    
    # Running Footer
    footer = section.footer
    p_ftr = footer.paragraphs[0]
    p_ftr.alignment = WD_ALIGN_PARAGRAPH.LEFT
    r_ftr = p_ftr.add_run("Independent University, Bangladesh (IUB) | Department of CSE | Autumn 2026")
    r_ftr.font.name = "Arial"
    r_ftr.font.size = Pt(8.5)
    r_ftr.font.color.rgb = RGBColor(148, 163, 184)

def parse_inline_formatting(paragraph, text, base_font="Arial", base_size=Pt(10.0), base_color=RGBColor(30, 41, 59), bold=False, italic=False):
    """Parse bold, italic, inline code, and links in markdown text and add runs to paragraph."""
    pattern = re.compile(r'(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))')
    tokens = pattern.split(text)
    
    for token in tokens:
        if not token:
            continue
        if token.startswith('**') and token.endswith('**'):
            inner = token[2:-2]
            run = paragraph.add_run(inner)
            run.font.name = base_font
            run.font.size = base_size
            run.font.bold = True
            run.font.italic = italic
            run.font.color.rgb = base_color
        elif token.startswith('*') and token.endswith('*') and not token.startswith('**'):
            inner = token[1:-1]
            run = paragraph.add_run(inner)
            run.font.name = base_font
            run.font.size = base_size
            run.font.bold = bold
            run.font.italic = True
            run.font.color.rgb = base_color
        elif token.startswith('`') and token.endswith('`'):
            inner = token[1:-1]
            run = paragraph.add_run(inner)
            run.font.name = "Consolas"
            run.font.size = Pt(base_size.pt * 0.9)
            run.font.bold = bold
            run.font.italic = italic
            run.font.color.rgb = RGBColor(15, 23, 42)
        elif token.startswith('[') and '](' in token and token.endswith(')'):
            m = re.match(r'\[([^\]]+)\]\(([^)]+)\)', token)
            if m:
                label, url = m.groups()
                run = paragraph.add_run(label)
                run.font.name = base_font
                run.font.size = base_size
                run.font.bold = bold
                run.font.italic = italic
                run.font.underline = True
                run.font.color.rgb = RGBColor(37, 99, 235)
            else:
                run = paragraph.add_run(token)
                run.font.name = base_font
                run.font.size = base_size
                run.font.bold = bold
                run.font.italic = italic
                run.font.color.rgb = base_color
        else:
            run = paragraph.add_run(token)
            run.font.name = base_font
            run.font.size = base_size
            run.font.bold = bold
            run.font.italic = italic
            run.font.color.rgb = base_color

def add_title_page(doc):
    """Add the official title page conforming strictly to IUB sample report."""
    p_inst = doc.add_paragraph()
    p_inst.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_inst.paragraph_format.space_before = Pt(36)
    p_inst.paragraph_format.space_after = Pt(2)
    r_inst = p_inst.add_run("Independent University, Bangladesh\n")
    r_inst.bold = True
    r_inst.font.name = "Arial"
    r_inst.font.size = Pt(20)
    r_inst.font.color.rgb = RGBColor(30, 58, 138)
    
    r_dept = p_inst.add_run("Department of Computer Science & Engineering\n")
    r_dept.bold = True
    r_dept.font.name = "Arial"
    r_dept.font.size = Pt(13)
    r_dept.font.color.rgb = RGBColor(71, 85, 105)
    
    r_course = p_inst.add_run("CSE309 Web Application & Internet")
    r_course.bold = True
    r_course.font.name = "Arial"
    r_course.font.size = Pt(16)
    r_course.font.color.rgb = RGBColor(30, 58, 138)
    
    # Divider line
    p_div = doc.add_paragraph()
    p_div.paragraph_format.space_before = Pt(12)
    p_div.paragraph_format.space_after = Pt(16)
    borders = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="12" w:space="1" w:color="1E3A8A"/></w:pBdr>')
    p_div._p.get_or_add_pPr().append(borders)
    
    p_title = doc.add_paragraph()
    p_title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_title.paragraph_format.space_before = Pt(8)
    p_title.paragraph_format.space_after = Pt(4)
    r_rep = p_title.add_run("FINAL PROJECT SUBMISSION REPORT\n")
    r_rep.bold = True
    r_rep.font.name = "Arial"
    r_rep.font.size = Pt(20)
    r_rep.font.color.rgb = RGBColor(15, 23, 42)
    
    p_sub = doc.add_paragraph()
    p_sub.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(24)
    r_sub = p_sub.add_run("CourseEnroll — Secure Multi-User University Course Registration & Academic Administration Platform")
    r_sub.italic = True
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(11)
    r_sub.font.color.rgb = RGBColor(71, 85, 105)
    
    # Metadata Table
    table = doc.add_table(rows=1, cols=2)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    # Left Cell: Submitted By
    c_left = table.rows[0].cells[0]
    c_left.width = Inches(3.6)
    set_cell_background(c_left, "F8FAFC")
    set_cell_margins(c_left, top=140, bottom=140, left=140, right=140)
    p_l = c_left.paragraphs[0]
    p_l.paragraph_format.space_before = Pt(0)
    p_l.paragraph_format.space_after = Pt(0)
    p_l.paragraph_format.line_spacing = 1.25
    
    r_by = p_l.add_run("SUBMITTED BY:\n")
    r_by.bold = True
    r_by.font.name = "Arial"
    r_by.font.size = Pt(10)
    r_by.font.color.rgb = RGBColor(30, 58, 138)
    
    p_l.add_run("Name: ").bold = True
    p_l.add_run("Raihanur Akter\n")
    p_l.add_run("Student ID: ").bold = True
    p_l.add_run("2310176\n")
    p_l.add_run("Section: ").bold = True
    p_l.add_run("1\n")
    p_l.add_run("Team Number: ").bold = True
    p_l.add_run("Team 2310176 (Individual Project)\n")
    p_l.add_run("Project Title: ").bold = True
    p_l.add_run("CourseEnroll\n")
    p_l.add_run("Vercel URL: ").bold = True
    p_l.add_run("https://2310176-course-enroll.vercel.app\n")
    p_l.add_run("GitHub Repo: ").bold = True
    p_l.add_run("https://github.com/raihanurakter02/2310176-CourseEnroll")
    
    # Right Cell: Submitted To
    c_right = table.rows[0].cells[1]
    c_right.width = Inches(2.9)
    set_cell_background(c_right, "F8FAFC")
    set_cell_margins(c_right, top=140, bottom=140, left=140, right=140)
    p_r = c_right.paragraphs[0]
    p_r.paragraph_format.space_before = Pt(0)
    p_r.paragraph_format.space_after = Pt(0)
    p_r.paragraph_format.line_spacing = 1.25
    
    r_to = p_r.add_run("SUBMITTED TO:\n")
    r_to.bold = True
    r_to.font.name = "Arial"
    r_to.font.size = Pt(10)
    r_to.font.color.rgb = RGBColor(30, 58, 138)
    
    p_r.add_run("Sayef Reyadh\n").bold = True
    p_r.add_run("Adjunct Lecturer\n")
    p_r.add_run("Department of CSE\n")
    p_r.add_run("Independent University, Bangladesh\n\n")
    p_r.add_run("Semester: ").bold = True
    p_r.add_run("Autumn 2026\n")
    p_r.add_run("Date: ").bold = True
    p_r.add_run("24 November 2026")
    
    # Bottom border
    tblPr = table._tbl.tblPr
    borders = parse_xml(
        f'<w:tblBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>'
        f'<w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>'
        f'<w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>'
        f'<w:insideH w:val="none"/>'
        f'<w:insideV w:val="single" w:sz="4" w:space="0" w:color="CBD5E1"/>'
        f'</w:tblBorders>'
    )
    tblPr.append(borders)
    
    doc.add_page_break()

def add_table_of_contents_page(doc):
    """Add Table of Contents and List of Figures and Tables."""
    p_toc_hdr = doc.add_paragraph()
    p_toc_hdr.paragraph_format.space_before = Pt(12)
    p_toc_hdr.paragraph_format.space_after = Pt(6)
    r = p_toc_hdr.add_run("Table of Contents")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(15)
    r.font.color.rgb = RGBColor(30, 58, 138)
    
    toc_items = [
        ("1. Executive Summary", "1"),
        ("   1.1 Project Overview", "1"),
        ("   1.2 What Was Built Since the Mid Assessment", "1"),
        ("   1.3 Live Links (Table 1)", "2"),
        ("Part A. Product Requirements (PRD)", "3"),
        ("   A1. Problem Statement", "3"),
        ("   A2. Users and Roles (Table 2)", "3"),
        ("   A3. Goals and Success Measures (Table 3)", "4"),
        ("   A4. Scope and Non-Goals", "4"),
        ("   A5. User Stories (Table 4: US-01 to US-12)", "5"),
        ("Part B. Software Requirements (SRS)", "6"),
        ("   B1. Introduction & Definitions", "6"),
        ("   B2. Functional Requirements (Tables 5 to 8)", "7"),
        ("   B3. Non-Functional Requirements (Table 9)", "8"),
        ("   B4. Roles and Permission Matrix (Tables 10 to 12)", "9"),
        ("   B5. Use Cases (Table 13 & Sequence Workflows)", "11"),
        ("   B6. Acceptance Criteria (Table 14: AC-01 to AC-04)", "12"),
        ("   B7. Requirements Traceability Matrix (Table 15)", "13"),
        ("Part C. Technical Design (TDD)", "14"),
        ("   C1. Technology Stack (Table 16)", "14"),
        ("   C2. System Architecture & Component Interactions", "15"),
        ("   C3. Codebase Structure & Directory Responsibilities", "16"),
        ("   C4. Data Model & Database Schema Dictionary (Table 17)", "17"),
        ("   C5. API Design & Endpoint Specification (Table 18)", "18"),
        ("   C6. Authentication & JWT Design (Table 19)", "20"),
        ("   C7. RBAC Design & Authorization Flow", "21"),
        ("   C8. Admin Dashboard Design (Table 20)", "22"),
        ("   C9. Security Design & STRIDE Threat Model (Table 21)", "23"),
        ("   C10. Deployment Topology & Environment Variables (Table 22)", "24"),
        ("   C11. Testing Strategy & Automated Test Suite (Table 23)", "25"),
        ("Part D. Evidence: Screenshots of the Running Application", "26"),
        ("   D1. User Side (Figures S1 to S6)", "26"),
        ("   D2. Security Behaviour (Figures S7 to S9)", "28"),
        ("   D3. Admin Dashboard (Figures S10 to S17)", "29"),
        ("   D4. Deployment Evidence (Figures S18 to S20)", "32"),
        ("   D5. Automated Test Execution Evidence (Figure S21)", "33"),
        ("Part E. Project Management and Conclusion", "34"),
        ("   E1. How to Run and Test Locally", "34"),
        ("   E2. GitHub Work & Feature Breakdown (Table 24)", "35"),
        ("   E3. Known Limitations & Technical Constraints", "36"),
        ("   E4. Future Work Roadmap", "36"),
        ("   E5. Sources, Libraries, and AI Usage Disclosure (Table 25)", "37"),
        ("Appendix. Test Accounts and Video Demo", "38"),
        ("   Evaluator Demo Accounts (Table 26)", "38"),
        ("   Group Collaboration Test Setup (Table 27)", "38"),
        ("   Video Walkthrough Details", "38")
    ]
    
    for item, page in toc_items:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(1.5)
        p.paragraph_format.line_spacing = 1.15
        
        is_major = not item.startswith("   ")
        r_item = p.add_run(item)
        r_item.font.name = "Arial"
        r_item.font.size = Pt(9.0)
        r_item.bold = is_major
        r_item.font.color.rgb = RGBColor(30, 58, 138) if is_major else RGBColor(51, 65, 85)
        
        # Dots leader
        dots_count = max(4, 75 - len(item) - len(page))
        r_dots = p.add_run(" " + "." * dots_count + " ")
        r_dots.font.name = "Arial"
        r_dots.font.size = Pt(8.0)
        r_dots.font.color.rgb = RGBColor(203, 213, 225)
        
        r_page = p.add_run(page)
        r_page.font.name = "Arial"
        r_page.font.size = Pt(9.0)
        r_page.bold = is_major
        r_page.font.color.rgb = RGBColor(30, 58, 138) if is_major else RGBColor(71, 85, 105)
        
    doc.add_page_break()

def add_styled_table(doc, table_data):
    """Render a markdown table with navy header, white text, zebra rows, and clean borders."""
    if not table_data or len(table_data) < 2:
        return
        
    headers = table_data[0]
    data_rows = table_data[1:]
    num_cols = len(headers)
    
    table = doc.add_table(rows=len(data_rows) + 1, cols=num_cols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table, color="CBD5E1")
    
    # Calculate column proportions based on max character lengths
    col_max_lens = [len(h) for h in headers]
    for row in data_rows:
        for c_idx in range(num_cols):
            if c_idx < len(row):
                col_max_lens[c_idx] = max(col_max_lens[c_idx], len(row[c_idx]))
                
    total_len = max(1, sum(col_max_lens))
    total_width = 6.5  # inches
    col_widths = [Inches(max(0.8, (l / total_len) * total_width)) for l in col_max_lens]
    
    # Normalize widths to total 6.5 inches
    curr_sum = sum(w.inches for w in col_widths)
    scale = total_width / curr_sum
    col_widths = [Inches(w.inches * scale) for w in col_widths]
    
    # Header Row
    hdr_row = table.rows[0]
    hdr_row._tr.get_or_add_trPr().append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
    
    for i, title in enumerate(headers):
        cell = hdr_row.cells[i]
        cell.width = col_widths[i]
        set_cell_background(cell, "1E3A8A")  # Navy Blue
        set_cell_margins(cell, top=120, bottom=120, left=120, right=120)
        p = cell.paragraphs[0]
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.15
        run = p.add_run(title.strip())
        run.bold = True
        run.font.name = "Arial"
        run.font.size = Pt(8.5)
        run.font.color.rgb = RGBColor(255, 255, 255)
        
    # Data Rows
    for r_idx, row_data in enumerate(data_rows):
        row = table.rows[r_idx + 1]
        bg_color = "F8FAFC" if (r_idx % 2 == 1) else "FFFFFF"
        for c_idx in range(num_cols):
            val = row_data[c_idx] if c_idx < len(row_data) else ""
            cell = row.cells[c_idx]
            cell.width = col_widths[c_idx]
            if bg_color != "FFFFFF":
                set_cell_background(cell, bg_color)
            set_cell_margins(cell, top=90, bottom=90, left=120, right=120)
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            parse_inline_formatting(p, val.strip(), base_font="Arial", base_size=Pt(8.0), base_color=RGBColor(30, 41, 59))
            
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(2)
    p_after.paragraph_format.space_after = Pt(6)

def add_code_block(doc, code_str, lang=""):
    """Render a code or diagram block with dark slate background and Consolas font."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.rows[0].cells[0]
    cell.width = Inches(6.5)
    
    # Dark slate background
    set_cell_background(cell, "0F172A")
    set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
    
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="single" w:sz="6" w:space="0" w:color="334155"/>'
        f'<w:left w:val="single" w:sz="6" w:space="0" w:color="334155"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="334155"/>'
        f'<w:right w:val="single" w:sz="6" w:space="0" w:color="334155"/>'
        f'</w:tcBorders>'
    )
    cell._tc.get_or_add_tcPr().append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(code_str.strip())
    run.font.name = "Consolas"
    run.font.size = Pt(8.0)
    run.font.color.rgb = RGBColor(241, 245, 249)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(2)
    p_after.paragraph_format.space_after = Pt(6)

def add_callout(doc, text):
    """Render a blockquote callout box."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.rows[0].cells[0]
    cell.width = Inches(6.5)
    set_cell_background(cell, "F1F5F9")  # Slate-100
    set_cell_margins(cell, top=120, bottom=120, left=180, right=180)
    
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="none"/>'
        f'<w:left w:val="single" w:sz="24" w:space="0" w:color="1E3A8A"/>'
        f'<w:bottom w:val="none"/>'
        f'<w:right w:val="none"/>'
        f'</w:tcBorders>'
    )
    cell._tc.get_or_add_tcPr().append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    parse_inline_formatting(p, text.strip(), base_font="Arial", base_size=Pt(9.0), base_color=RGBColor(51, 65, 85), italic=True)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(2)
    p_after.paragraph_format.space_after = Pt(6)

def add_screenshot_card(doc, s_id, title, req_text, caption_text):
    """Add a structured evidence screenshot card with caption and screenshot placement box."""
    table = doc.add_table(rows=2, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    # Metadata Header Cell
    cell_meta = table.rows[0].cells[0]
    cell_meta.width = Inches(6.5)
    set_cell_background(cell_meta, "1E3A8A")
    set_cell_margins(cell_meta, top=100, bottom=100, left=140, right=140)
    p_m = cell_meta.paragraphs[0]
    p_m.paragraph_format.space_before = Pt(0)
    p_m.paragraph_format.space_after = Pt(0)
    r_id = p_m.add_run(f"FIGURE {s_id}: {title.upper()}\n")
    r_id.bold = True
    r_id.font.name = "Arial"
    r_id.font.size = Pt(9.0)
    r_id.font.color.rgb = RGBColor(255, 255, 255)
    
    r_sub = p_m.add_run(f"Requirement Mappings: {req_text}")
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(8.0)
    r_sub.font.color.rgb = RGBColor(224, 231, 255)
    
    # Body Frame Cell
    cell_body = table.rows[1].cells[0]
    cell_body.width = Inches(6.5)
    set_cell_background(cell_body, "F8FAFC")
    set_cell_margins(cell_body, top=120, bottom=120, left=160, right=160)
    
    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'<w:top w:val="none"/>'
        f'<w:left w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>'
        f'<w:bottom w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>'
        f'<w:right w:val="single" w:sz="6" w:space="0" w:color="CBD5E1"/>'
        f'</w:tcBorders>'
    )
    cell_body._tc.get_or_add_tcPr().append(borders)
    
    p_b = cell_body.paragraphs[0]
    p_b.paragraph_format.space_before = Pt(0)
    p_b.paragraph_format.space_after = Pt(4)
    
    # Screenshot Frame
    r_frame = p_b.add_run("┌────────────────────────────────────────────────────────────────────────┐\n")
    r_frame.font.name = "Consolas"
    r_frame.font.size = Pt(7.5)
    r_frame.font.color.rgb = RGBColor(148, 163, 184)
    
    r_frame2 = p_b.add_run(f"│  [SCREENSHOT CAPTURE {s_id}] — Deployed URL: https://2310176-course-enroll.vercel.app\n")
    r_frame2.font.name = "Consolas"
    r_frame2.font.size = Pt(7.5)
    r_frame2.font.color.rgb = RGBColor(100, 116, 139)
    
    r_frame3 = p_b.add_run("└────────────────────────────────────────────────────────────────────────┘\n\n")
    r_frame3.font.name = "Consolas"
    r_frame3.font.size = Pt(7.5)
    r_frame3.font.color.rgb = RGBColor(148, 163, 184)
    
    r_c_lbl = p_b.add_run("Verification Proof & Caption: ")
    r_c_lbl.bold = True
    r_c_lbl.font.name = "Arial"
    r_c_lbl.font.size = Pt(8.5)
    r_c_lbl.font.color.rgb = RGBColor(15, 23, 42)
    
    r_c = p_b.add_run(caption_text)
    r_c.font.name = "Arial"
    r_c.font.size = Pt(8.5)
    r_c.font.color.rgb = RGBColor(51, 65, 85)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(2)
    p_after.paragraph_format.space_after = Pt(8)

def add_appendix_tables(doc):
    """Add the official evaluator test accounts and group permissions tables in Appendix."""
    p_app_hdr = doc.add_paragraph()
    p_app_hdr.paragraph_format.space_before = Pt(14)
    p_app_hdr.paragraph_format.space_after = Pt(4)
    r = p_app_hdr.add_run("Table 26: Evaluator Demo Test Accounts for Grading & Viva Verification")
    r.bold = True
    r.font.name = "Arial"
    r.font.size = Pt(10.0)
    r.font.color.rgb = RGBColor(30, 58, 138)
    
    accounts_headers = ["Account Role", "User ID / Email", "Password", "Permissions & Evaluation Focus"]
    accounts_rows = [
        ["Primary Administrator", "admin@courseenroll.edu", "Admin@12345!", "Full admin access: moderation, user ban/unban, audit telemetry, data CSV export."],
        ["Secondary Administrator", "security_audit@courseenroll.edu", "Audit@12345!", "Co-admin account: verifies admin immutability rule (cannot ban or demote peer admin)."],
        ["Faculty Member 1", "faculty.smith@courseenroll.edu", "Faculty@12345!", "Instructor for CSE220: grade submission, student roster, daily roll-call attendance."],
        ["Faculty Member 2", "faculty.rahman@courseenroll.edu", "Faculty@12345!", "Instructor for CSE307: tests ownership isolation (cannot grade CSE220 students)."],
        ["Student 1 (Enrolled)", "student.doe@courseenroll.edu", "Student@12345!", "Enrolled in CSE220 & CSE307: weekly timetable, tuition breakdown, session revocation."],
        ["Student 2 (Enrolled)", "student.jane@courseenroll.edu", "Student@12345!", "Enrolled in CSE115: tests horizontal isolation (cannot see Student 1 records)."],
        ["Student 3 (Waitlisted)", "student.alice@courseenroll.edu", "Student@12345!", "Tests waitlist queue placement, course capacity full condition, drop action."]
    ]
    add_styled_table(doc, [accounts_headers] + accounts_rows)
    
    p_grp_hdr = doc.add_paragraph()
    p_grp_hdr.paragraph_format.space_before = Pt(14)
    p_grp_hdr.paragraph_format.space_after = Pt(4)
    r_g = p_grp_hdr.add_run("Table 27: Study Group Collaboration Setup with Mixed Permissions")
    r_g.bold = True
    r_g.font.name = "Arial"
    r_g.font.size = Pt(10.0)
    r_g.font.color.rgb = RGBColor(30, 58, 138)
    
    group_headers = ["Member Email", "Group Role", "Granted Permissions", "Forbidden Operations"]
    group_rows = [
        ["faculty.smith@courseenroll.edu", "Owner", "Full management, invite members, modify roles, delete group.", "Cannot demote self if sole owner."],
        ["student.doe@courseenroll.edu", "Editor", "Upload shared notes, create discussion posts, edit resources.", "Cannot remove members or alter roles."],
        ["student.jane@courseenroll.edu", "Viewer", "View discussions, download study materials, read group notes.", "Cannot post, upload, edit, or invite."]
    ]
    add_styled_table(doc, [group_headers] + group_rows)

def build_report_docx(md_path, docx_path):
    """Main builder: converts markdown content into the final formatted DOCX."""
    with open(md_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    doc = docx.Document()
    setup_page_layout(doc)
    
    # 1. Official Title Page
    add_title_page(doc)
    
    # 2. Table of Contents
    add_table_of_contents_page(doc)
    
    # 3. Parse Markdown Content (skipping old markdown title block)
    # Find start of Executive Summary
    idx_start = content.find("# 1. Executive Summary")
    if idx_start != -1:
        body_content = content[idx_start:]
    else:
        body_content = content
        
    lines = body_content.split("\n")
    total_lines = len(lines)
    
    in_code_block = False
    code_lang = ""
    code_lines = []
    
    in_table = False
    table_rows = []
    
    i = 0
    while i < total_lines:
        line = lines[i].rstrip("\r\n")
        stripped = line.strip()
        
        # Handle code blocks
        if stripped.startswith("```"):
            if not in_code_block:
                in_code_block = True
                code_lang = stripped[3:].strip()
                code_lines = []
            else:
                in_code_block = False
                add_code_block(doc, "\n".join(code_lines), code_lang)
                code_lines = []
            i += 1
            continue
            
        if in_code_block:
            code_lines.append(line)
            i += 1
            continue
            
        # Handle tables
        if stripped.startswith("|") and "|" in stripped[1:]:
            # Check separator with escaped dash!
            if re.match(r'^\|[\s:\-|]+\|$', stripped):
                i += 1
                continue
            cols = [c.strip() for c in stripped.strip("|").split("|")]
            table_rows.append(cols)
            in_table = True
            i += 1
            continue
        else:
            if in_table:
                add_styled_table(doc, table_rows)
                table_rows = []
                in_table = False
                
        # Empty line
        if not stripped:
            i += 1
            continue
            
        # Check screenshot entry: * **[Screenshot S1]: ...
        s_match = re.match(r'^\*\s+\*\*\[Screenshot\s+(S\d+)\]:\s*(.*?)\*\*', stripped)
        if s_match:
            s_id, s_title = s_match.groups()
            req_text = ""
            caption_text = ""
            
            # Check if requirement is in title
            req_match = re.search(r'\(([^)]+)\)', s_title)
            if req_match:
                req_text = req_match.group(1)
                s_title = s_title.replace(f"({req_text})", "").strip()
                
            # Look ahead for caption line
            if i + 1 < total_lines and "*Caption:*" in lines[i + 1]:
                caption_text = lines[i + 1].strip().replace("*Caption:*", "").strip()
                i += 1
                
            add_screenshot_card(doc, s_id, s_title, req_text, caption_text)
            i += 1
            continue
            
        # Horizontal rules
        if stripped in ("---", "***", "___"):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(4)
            p.paragraph_format.space_after = Pt(8)
            borders = parse_xml(f'<w:pBdr {nsdecls("w")}><w:bottom w:val="single" w:sz="6" w:space="1" w:color="CBD5E1"/></w:pBdr>')
            p._p.get_or_add_pPr().append(borders)
            i += 1
            continue
            
        # Headings
        if stripped.startswith("#"):
            major_sections = [
                "# 1. Executive Summary",
                "# Part A.",
                "# Part B.",
                "# Part C.",
                "# Part D.",
                "# Part E.",
                "# Appendix"
            ]
            for ms in major_sections:
                if stripped.startswith(ms):
                    doc.add_page_break()
                    break
                    
            if stripped.startswith("####"):
                heading_text = stripped[4:].strip()
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(8)
                p.paragraph_format.space_after = Pt(2)
                p.paragraph_format.keep_with_next = True
                parse_inline_formatting(p, heading_text, base_font="Arial", base_size=Pt(9.5), base_color=RGBColor(71, 85, 105), bold=True)
            elif stripped.startswith("###"):
                heading_text = stripped[3:].strip()
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(10)
                p.paragraph_format.space_after = Pt(3)
                p.paragraph_format.keep_with_next = True
                parse_inline_formatting(p, heading_text, base_font="Arial", base_size=Pt(11.0), base_color=RGBColor(30, 58, 138), bold=True)
            elif stripped.startswith("##"):
                heading_text = stripped[2:].strip()
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(13)
                p.paragraph_format.space_after = Pt(4)
                p.paragraph_format.keep_with_next = True
                parse_inline_formatting(p, heading_text, base_font="Arial", base_size=Pt(13.0), base_color=RGBColor(15, 23, 42), bold=True)
            elif stripped.startswith("#"):
                heading_text = stripped[1:].strip()
                p = doc.add_paragraph()
                p.paragraph_format.space_before = Pt(16)
                p.paragraph_format.space_after = Pt(6)
                p.paragraph_format.keep_with_next = True
                parse_inline_formatting(p, heading_text, base_font="Arial", base_size=Pt(15.0), base_color=RGBColor(30, 58, 138), bold=True)
            i += 1
            continue
            
        # Blockquote
        if stripped.startswith(">"):
            quote_text = stripped.lstrip("> ").strip()
            add_callout(doc, quote_text)
            i += 1
            continue
            
        # Bullet list items
        if stripped.startswith(("* ", "- ")):
            item_text = stripped[2:].strip()
            p = doc.add_paragraph(style='List Bullet')
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            parse_inline_formatting(p, item_text, base_font="Arial", base_size=Pt(9.5), base_color=RGBColor(30, 41, 59))
            i += 1
            continue
            
        # Numbered list items
        num_match = re.match(r'^(\d+)\.\s+(.*)$', stripped)
        if num_match:
            num_val, item_text = num_match.groups()
            p = doc.add_paragraph(style='List Number')
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            parse_inline_formatting(p, item_text, base_font="Arial", base_size=Pt(9.5), base_color=RGBColor(30, 41, 59))
            i += 1
            continue
            
        # Regular paragraph
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        parse_inline_formatting(p, stripped, base_font="Arial", base_size=Pt(9.5), base_color=RGBColor(30, 41, 59))
        i += 1
        
    # Flush any remaining table
    if in_table and table_rows:
        add_styled_table(doc, table_rows)
        
    # Add Appendix Tables (Demo Test Accounts and Group Permissions)
    add_appendix_tables(doc)
    
    # Save output docx
    os.makedirs(os.path.dirname(os.path.abspath(docx_path)), exist_ok=True)
    doc.save(docx_path)
    print(f"Successfully created complete submission DOCX at: {docx_path}")

if __name__ == "__main__":
    md_file = "docs/FINAL_REPORT.md"
    docx_file = "docs/Final_Project_Submission_Report_2310176.docx"
    build_report_docx(md_file, docx_file)
