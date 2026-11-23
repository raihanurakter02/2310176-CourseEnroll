"""
build_final_report_docx.py
Generates the comprehensive Word (.docx) report for CSE309 Web Application & Internet (Autumn 2026),
Independent University, Bangladesh.

Student: Raihanur Akter (ID: 2310176)
Instructor: Sayef Reyadh
Project: CourseEnroll — Secure Multi-User University Course Registration & Academic Administration Platform
"""

import os
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

def set_cell_margins(cell, top=120, bottom=120, left=160, right=160):
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

def add_table_to_doc(doc, headers, rows, col_widths=None, col_alignments=None):
    """Add a beautifully formatted table with navy headers and alternating rows."""
    table = doc.add_table(rows=len(rows) + 1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    set_table_borders(table, color="CBD5E1")
    
    # Header Row
    hdr_row = table.rows[0]
    hdr_row._tr.get_or_add_trPr().append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))
    
    for i, title in enumerate(headers):
        cell = hdr_row.cells[i]
        if col_widths and i < len(col_widths):
            cell.width = col_widths[i]
        set_cell_background(cell, "1E3A8A")  # Navy Blue
        set_cell_margins(cell, top=140, bottom=140, left=160, right=160)
        p = cell.paragraphs[0]
        p.alignment = col_alignments[i] if col_alignments else WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(0)
        p.paragraph_format.line_spacing = 1.15
        run = p.add_run(title)
        run.bold = True
        run.font.name = "Arial"
        run.font.size = Pt(9.5)
        run.font.color.rgb = RGBColor(255, 255, 255)
        
    # Data Rows
    for r_idx, row_data in enumerate(rows):
        row = table.rows[r_idx + 1]
        bg_color = "F8FAFC" if (r_idx % 2 == 1) else "FFFFFF"
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            if col_widths and c_idx < len(col_widths):
                cell.width = col_widths[c_idx]
            if bg_color != "FFFFFF":
                set_cell_background(cell, bg_color)
            set_cell_margins(cell, top=120, bottom=120, left=160, right=160)
            p = cell.paragraphs[0]
            p.alignment = col_alignments[c_idx] if col_alignments else WD_ALIGN_PARAGRAPH.LEFT
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            run = p.add_run(str(val))
            run.font.name = "Arial"
            run.font.size = Pt(9.0)
            run.font.color.rgb = RGBColor(30, 41, 59)
            
    # Add small spacing after table
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(2)
    p_after.paragraph_format.space_after = Pt(6)
    return table

def add_callout(doc, text, title="SECURITY PROPERTY / ARCHITECTURAL NOTE"):
    """Add a shaded callout box for critical security / architectural requirements."""
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.rows[0].cells[0]
    cell.width = Inches(6.5)
    set_cell_background(cell, "F1F5F9")  # Slate-100
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    
    # Left border highlight (Navy blue, thick)
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
    p.paragraph_format.space_after = Pt(2)
    run_title = p.add_run(f"✦ {title}\n")
    run_title.bold = True
    run_title.font.name = "Arial"
    run_title.font.size = Pt(9.5)
    run_title.font.color.rgb = RGBColor(30, 58, 138)
    
    run_text = p.add_run(text)
    run_text.font.name = "Arial"
    run_text.font.size = Pt(9.0)
    run_text.font.color.rgb = RGBColor(51, 65, 85)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(2)
    p_after.paragraph_format.space_after = Pt(6)

def add_code_block(doc, code_str, caption=None):
    """Add a nicely styled code snippet block."""
    if caption:
        p_cap = doc.add_paragraph()
        p_cap.paragraph_format.space_before = Pt(6)
        p_cap.paragraph_format.space_after = Pt(2)
        r = p_cap.add_run(caption)
        r.font.name = "Arial"
        r.font.size = Pt(9.0)
        r.font.bold = True
        r.font.color.rgb = RGBColor(71, 85, 105)

    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = table.rows[0].cells[0]
    cell.width = Inches(6.5)
    set_cell_background(cell, "0F172A")  # Slate-900 dark background
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
    run.font.size = Pt(8.5)
    run.font.color.rgb = RGBColor(241, 245, 249)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(2)
    p_after.paragraph_format.space_after = Pt(6)

def add_screenshot_card(doc, fig_id, title, req_id, test_url, verification_text, proof_text):
    """Add a structured, beautiful evidence screenshot card."""
    table = doc.add_table(rows=2, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    # Metadata Header Cell
    cell_meta = table.rows[0].cells[0]
    cell_meta.width = Inches(6.5)
    set_cell_background(cell_meta, "1E3A8A")
    set_cell_margins(cell_meta, top=120, bottom=120, left=160, right=160)
    p_m = cell_meta.paragraphs[0]
    p_m.paragraph_format.space_before = Pt(0)
    p_m.paragraph_format.space_after = Pt(0)
    r_id = p_m.add_run(f"FIGURE {fig_id}: {title.upper()}\n")
    r_id.bold = True
    r_id.font.name = "Arial"
    r_id.font.size = Pt(9.5)
    r_id.font.color.rgb = RGBColor(255, 255, 255)
    
    r_sub = p_m.add_run(f"Requirement Mapped: {req_id}  |  Live URL: {test_url}")
    r_sub.font.name = "Arial"
    r_sub.font.size = Pt(8.5)
    r_sub.font.color.rgb = RGBColor(224, 231, 255)
    
    # Body Frame Cell (Placeholder for actual screenshot)
    cell_body = table.rows[1].cells[0]
    cell_body.width = Inches(6.5)
    set_cell_background(cell_body, "F8FAFC")
    set_cell_margins(cell_body, top=140, bottom=140, left=180, right=180)
    
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
    
    # Visual Frame Representation
    r_frame = p_b.add_run("┌────────────────────────────────────────────────────────────────────────┐\n")
    r_frame.font.name = "Consolas"
    r_frame.font.size = Pt(7.5)
    r_frame.font.color.rgb = RGBColor(148, 163, 184)
    
    r_frame2 = p_b.add_run(f"│  [BROWSER SCREENSHOT FRAME]  —  {test_url[:50]}...\n")
    r_frame2.font.name = "Consolas"
    r_frame2.font.size = Pt(7.5)
    r_frame2.font.color.rgb = RGBColor(100, 116, 139)
    
    r_frame3 = p_b.add_run("└────────────────────────────────────────────────────────────────────────┘\n\n")
    r_frame3.font.name = "Consolas"
    r_frame3.font.size = Pt(7.5)
    r_frame3.font.color.rgb = RGBColor(148, 163, 184)
    
    r_v_lbl = p_b.add_run("Test Condition / Action: ")
    r_v_lbl.bold = True
    r_v_lbl.font.name = "Arial"
    r_v_lbl.font.size = Pt(9.0)
    r_v_lbl.font.color.rgb = RGBColor(15, 23, 42)
    
    r_v = p_b.add_run(f"{verification_text}\n")
    r_v.font.name = "Arial"
    r_v.font.size = Pt(9.0)
    r_v.font.color.rgb = RGBColor(51, 65, 85)
    
    r_p_lbl = p_b.add_run("Proof Objective: ")
    r_p_lbl.bold = True
    r_p_lbl.font.name = "Arial"
    r_p_lbl.font.size = Pt(9.0)
    r_p_lbl.font.color.rgb = RGBColor(15, 23, 42)
    
    r_p = p_b.add_run(proof_text)
    r_p.font.name = "Arial"
    r_p.font.size = Pt(9.0)
    r_p.font.color.rgb = RGBColor(51, 65, 85)
    
    p_after = doc.add_paragraph()
    p_after.paragraph_format.space_before = Pt(4)
    p_after.paragraph_format.space_after = Pt(10)

print("Card and formatting functions created successfully.")
